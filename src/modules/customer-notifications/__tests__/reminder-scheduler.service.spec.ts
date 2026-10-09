import { Prisma } from '@prisma/client';
import {
  APPOINTMENT_REMINDER_LEAD_MS,
  APPOINTMENT_REMINDER_MIN_LEAD_MS,
  DEFAULT_INVOICE_REMINDER_DAYS,
  ReminderSchedulerService,
  daysOverdue,
  doualaHour,
  dueReminderStep,
  parseInvoiceReminderDays,
} from '../reminder-scheduler.service';

const HOUR = 60 * 60 * 1000;
// 10 h à Douala (UTC+1).
const NOW = new Date('2026-10-09T09:00:00Z');

function makeService() {
  const prisma = {
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    garageNotificationSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const emitter = {
    emitSafely: jest.fn().mockImplementation(async () => ({ outcome: 'QUEUED', notificationId: 'n1' })),
  };
  const service = new ReminderSchedulerService(prisma as never, emitter as never);
  return { service, prisma, emitter };
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt-1',
    garageId: 'g1',
    customerId: 'c1',
    scheduledAt: new Date(NOW.getTime() + 20 * HOUR),
    createdAt: new Date(NOW.getTime() - 3 * 24 * HOUR),
    ...overrides,
  };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    garageId: 'g1',
    customerId: 'c1',
    serviceOrderId: 'so-1',
    reference: 'FAC-2026-0001',
    balanceXaf: new Prisma.Decimal('119250'),
    dueDate: new Date('2026-10-02T00:00:00Z'),
    ...overrides,
  };
}

describe('fonctions pures du planificateur de rappels', () => {
  it('heure de Douala', () => {
    expect(doualaHour(NOW)).toBe(10);
    expect(doualaHour(new Date('2026-10-09T23:30:00Z'))).toBe(0);
  });

  it('jours de retard comptés au calendrier de Douala', () => {
    const due = new Date('2026-10-02T00:00:00Z');
    expect(daysOverdue(due, NOW)).toBe(7);
    // 23 h 30 UTC = 0 h 30 le lendemain à Douala.
    expect(daysOverdue(due, new Date('2026-10-08T23:30:00Z'))).toBe(7);
    expect(daysOverdue(due, new Date('2026-10-08T22:30:00Z'))).toBe(6);
  });

  it('politique de relance : défaut, surcharge triée, valeurs invalides refusées', () => {
    expect(parseInvoiceReminderDays(null)).toEqual(DEFAULT_INVOICE_REMINDER_DAYS);
    expect(parseInvoiceReminderDays({})).toEqual(DEFAULT_INVOICE_REMINDER_DAYS);
    expect(parseInvoiceReminderDays({ reminderDaysAfterDue: [15, 3] })).toEqual([3, 15]);
    for (const invalid of [[], [0], [91], [1.5], [7, 7], [1, 2, 3, 4], 'x']) {
      expect(parseInvoiceReminderDays({ reminderDaysAfterDue: invalid })).toBeNull();
    }
    expect(parseInvoiceReminderDays([7] as never)).toBeNull();
  });

  it('étape due : la dernière atteinte, rattrapée 7 jours au plus', () => {
    const days = [7, 15];
    expect([6, 7, 13, 14, 15, 21, 22].map((d) => dueReminderStep(days, d))).toEqual([null, 1, 1, null, 2, 2, null]);
    // Étapes rapprochées : seule la plus récente part.
    expect(dueReminderStep([3, 5], 6)).toBe(2);
  });
});

describe('ReminderSchedulerService.sendAppointmentReminders', () => {
  it('hors de la plage 7 h - 21 h à Douala : aucun scan', async () => {
    const { service, prisma } = makeService();

    await expect(service.sendAppointmentReminders(new Date('2026-10-09T20:00:00Z'))).resolves.toBeNull();
    await expect(service.sendAppointmentReminders(new Date('2026-10-09T05:59:00Z'))).resolves.toBeNull();
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('scanne les RDV actifs avec garage entre +2 h et +24 h', async () => {
    const { service, prisma } = makeService();

    await service.sendAppointmentReminders(NOW);

    const { where } = prisma.appointment.findMany.mock.calls[0][0];
    expect(where).toEqual({
      garageId: { not: null },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: {
        gt: new Date(NOW.getTime() + APPOINTMENT_REMINDER_MIN_LEAD_MS),
        lte: new Date(NOW.getTime() + APPOINTMENT_REMINDER_LEAD_MS),
      },
    });
  });

  it('émet le rappel avec la clé liée à l’horaire et la date/heure de Douala', async () => {
    const { service, prisma, emitter } = makeService();
    const apt = appointment({ scheduledAt: new Date('2026-10-10T07:30:00Z') });
    prisma.appointment.findMany.mockResolvedValue([apt]);

    const run = await service.sendAppointmentReminders(NOW);

    expect(emitter.emitSafely).toHaveBeenCalledWith({
      garageId: 'g1',
      eventType: 'APPOINTMENT_REMINDER',
      idempotencyKey: `appointment.reminder:apt-1:${apt.scheduledAt.getTime() / 1000}`,
      customerId: 'c1',
      refs: { appointmentId: 'apt-1' },
      variables: { date: '10/10/2026', time: '08:30' },
    });
    expect(run).toEqual({ scanned: 1, queued: 1, existing: 0, skipped: 0 });
  });

  it('RDV pris moins de 24 h à l’avance : pas de rappel (la confirmation vient de partir)', async () => {
    const { service, prisma, emitter } = makeService();
    const scheduledAt = new Date(NOW.getTime() + 20 * HOUR);
    prisma.appointment.findMany.mockResolvedValue([
      appointment({ scheduledAt, createdAt: new Date(scheduledAt.getTime() - 23 * HOUR) }),
    ]);

    const run = await service.sendAppointmentReminders(NOW);

    expect(emitter.emitSafely).not.toHaveBeenCalled();
    expect(run).toMatchObject({ scanned: 1, skipped: 1 });
  });

  it('passage répété : déjà émis compté à part, émission échouée comptée ignorée', async () => {
    const { service, prisma, emitter } = makeService();
    prisma.appointment.findMany.mockResolvedValue([appointment(), appointment({ id: 'apt-2' }), appointment({ id: 'apt-3' })]);
    emitter.emitSafely
      .mockResolvedValueOnce({ outcome: 'ALREADY_EXISTS', notificationId: 'n1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ outcome: 'DISABLED_BY_GARAGE' });

    await expect(service.sendAppointmentReminders(NOW)).resolves.toEqual({ scanned: 3, queued: 0, existing: 1, skipped: 2 });
  });
});

describe('ReminderSchedulerService.sendInvoiceReminders', () => {
  it('scanne les factures impayées avec garage et solde positif', async () => {
    const { service, prisma } = makeService();

    await service.sendInvoiceReminders(NOW);

    const { where } = prisma.invoice.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      garageId: { not: null },
      status: { in: ['ISSUED', 'PARTIAL'] },
      balanceXaf: { gt: 0 },
      dueDate: { lt: NOW },
    });
  });

  it('J+7 : relance étape 1 avec le solde restant dû', async () => {
    const { service, prisma, emitter } = makeService();
    prisma.invoice.findMany.mockResolvedValue([invoice()]);

    await service.sendInvoiceReminders(NOW);

    expect(emitter.emitSafely).toHaveBeenCalledWith({
      garageId: 'g1',
      eventType: 'INVOICE_PAYMENT_REMINDER',
      idempotencyKey: 'invoice.reminder:inv-1:s1',
      customerId: 'c1',
      refs: { invoiceId: 'inv-1', serviceOrderId: 'so-1' },
      variables: { invoiceNumber: 'FAC-2026-0001', amount: '119 250 FCFA' },
    });
  });

  it('politique du garage lue une fois par passage ; hors étape = ignorée', async () => {
    const { service, prisma, emitter } = makeService();
    prisma.garageNotificationSetting.findUnique.mockResolvedValue({ params: { reminderDaysAfterDue: [3] } });
    prisma.invoice.findMany.mockResolvedValue([
      invoice({ id: 'inv-a', dueDate: new Date('2026-10-06T00:00:00Z') }), // J+3
      invoice({ id: 'inv-b', dueDate: new Date('2026-10-08T00:00:00Z') }), // J+1
    ]);

    const run = await service.sendInvoiceReminders(NOW);

    expect(prisma.garageNotificationSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(emitter.emitSafely).toHaveBeenCalledTimes(1);
    expect(emitter.emitSafely.mock.calls[0][0].idempotencyKey).toBe('invoice.reminder:inv-a:s1');
    expect(run).toEqual({ scanned: 2, queued: 1, existing: 0, skipped: 1 });
  });

  it('politique invalide : défaut J+7 / J+15 appliqué sans faire échouer le passage', async () => {
    const { service, prisma, emitter } = makeService();
    prisma.garageNotificationSetting.findUnique.mockResolvedValue({ params: { reminderDaysAfterDue: 'tous les jours' } });
    prisma.invoice.findMany.mockResolvedValue([invoice({ dueDate: new Date('2026-09-24T00:00:00Z') })]); // J+15

    await service.sendInvoiceReminders(NOW);

    expect(emitter.emitSafely.mock.calls[0][0].idempotencyKey).toBe('invoice.reminder:inv-1:s2');
  });
});
