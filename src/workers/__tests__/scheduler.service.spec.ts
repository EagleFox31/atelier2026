import { SubscriptionStatus } from '@prisma/client';
import { SchedulerService } from '../scheduler.service';

const GARAGE_PRO = 'garage-pro';
const GARAGE_PILOT = 'garage-pilot';

function makeDeps() {
  const prismaMock = {
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    garage: {
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
        tenantId: where.id === GARAGE_PRO ? 'tenant-pro' : where.id === GARAGE_PILOT ? 'tenant-pilot' : null,
      })),
    },
    vehicleImmobilization: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const smsQueue = { add: jest.fn().mockResolvedValue({}) };
  const subscriptions = {
    getSummary: jest.fn().mockImplementation(async (tenantId: string) =>
      tenantId === 'tenant-pro'
        ? { status: SubscriptionStatus.ACTIVE, plan: 'pro' }
        : { status: SubscriptionStatus.TRIAL, plan: 'pro' },
    ),
  };
  const service = new SchedulerService(prismaMock as any, smsQueue as any, subscriptions as any);
  return { service, prismaMock, smsQueue, subscriptions };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    garageId: GARAGE_PRO,
    reference: 'FAC-001',
    customerId: 'cust-1',
    customer: { phonePrimary: '+237690000001', firstName: 'Paul', lastName: 'Ngono', companyName: null, lang: 'fr' },
    ...overrides,
  };
}

describe('SchedulerService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('handleUnpaidInvoices() — relance J+7', () => {
    it('met en file la relance avec tenant/facture, sans marquer reminder1SentAt (marqué après envoi réel)', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([invoice()]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).toHaveBeenCalledWith(
        'reminder_j7',
        expect.objectContaining({
          tenantId: 'tenant-pro',
          garageId: GARAGE_PRO,
          phone: '+237690000001',
          customerId: 'cust-1',
          invoiceId: 'inv-1',
          invoiceReminder: 1,
          message: expect.stringContaining('Bonjour Ngono'),
        }),
        {
          jobId: 'invoice-reminder-j7_inv-1',
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 20 * 60 * 60 },
        },
      );
      expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    });

    it('ignore les factures sans téléphone client', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([
        invoice({ id: 'inv-2', customer: { phonePrimary: null, firstName: null, lastName: 'X', companyName: null, lang: 'fr' } }),
      ]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).not.toHaveBeenCalled();
    });

    it('n’envoie rien aux ateliers sans droit SMS (pilote, Essentiel…) et ne lit l’abonnement qu’une fois par tenant', async () => {
      const { service, prismaMock, smsQueue, subscriptions } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([
        invoice({ id: 'a', garageId: GARAGE_PILOT }),
        invoice({ id: 'b', garageId: GARAGE_PILOT }),
        invoice({ id: 'c', garageId: GARAGE_PRO }),
      ]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).toHaveBeenCalledTimes(1);
      expect(smsQueue.add.mock.calls[0][1]).toMatchObject({ invoiceId: 'c' });
      expect(subscriptions.getSummary).toHaveBeenCalledTimes(2); // tenant-pilot + tenant-pro
    });

    it('refus par défaut : facture sans garage ou garage sans tenant', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([
        invoice({ id: 'x', garageId: null }),
        invoice({ id: 'y', garageId: 'garage-orphelin' }),
      ]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).not.toHaveBeenCalled();
    });

    it('abonnement illisible (panne) : SMS ignorés ce passage, sans faire échouer le cron', async () => {
      const { service, prismaMock, smsQueue, subscriptions } = makeDeps();
      subscriptions.getSummary.mockRejectedValue(new Error('DB down'));
      prismaMock.invoice.findMany.mockResolvedValue([invoice()]);

      await expect(service.handleUnpaidInvoices()).resolves.toBeUndefined();
      expect(smsQueue.add).not.toHaveBeenCalled();
    });

    it.each([
      [{ firstName: 'Paul', lastName: null, companyName: 'Garage SA' }, 'Bonjour Garage SA,'],
      [{ firstName: 'Paul', lastName: null, companyName: null }, 'Bonjour Paul,'],
      [{ firstName: null, lastName: null, companyName: null }, 'Bonjour, la facture'],
    ])('jamais « Bonjour null » : %o → %s', async (names, expected) => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([
        invoice({ customer: { phonePrimary: '+237690000001', lang: 'fr', ...names } }),
      ]);

      await service.handleUnpaidInvoices();

      const message = smsQueue.add.mock.calls[0][1].message as string;
      expect(message.startsWith(expected)).toBe(true);
      expect(message).not.toContain('null');
    });
  });

  describe('handleUnpaidInvoicesJ15() — relance J+15', () => {
    it('met en file reminder_j15 (invoiceReminder 2) sans marquer reminder2SentAt', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([invoice({ id: 'inv-3' })]);

      await service.handleUnpaidInvoicesJ15();

      expect(smsQueue.add).toHaveBeenCalledWith(
        'reminder_j15',
        expect.objectContaining({ invoiceId: 'inv-3', invoiceReminder: 2, tenantId: 'tenant-pro' }),
        expect.objectContaining({ jobId: 'invoice-reminder-j15_inv-3' }),
      );
      expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('sendAppointmentReminders() — RDV J-1', () => {
    const appointment = (overrides: Record<string, unknown> = {}) => ({
      id: 'apt-1',
      garageId: GARAGE_PRO,
      scheduledAt: new Date('2026-05-24T10:00:00Z'),
      customer: { id: 'cust-3', phonePrimary: '+237690000003', firstName: 'Alice', lastName: 'Fotso', lang: 'fr' },
      vehicle: { make: { name: 'Toyota' }, model: { name: 'Corolla' } },
      ...overrides,
    });

    it('envoie un SMS par rendez-vous d’un atelier avec droit SMS (dédupliqué par rendez-vous)', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.appointment.findMany.mockResolvedValue([appointment()]);

      await service.sendAppointmentReminders();

      expect(smsQueue.add).toHaveBeenCalledWith(
        'appointment_reminder',
        expect.objectContaining({
          tenantId: 'tenant-pro',
          phone: '+237690000003',
          message: expect.stringContaining('rendez-vous demain'),
        }),
        expect.objectContaining({ jobId: 'appointment-reminder_apt-1' }),
      );
    });

    it('aucun rappel pour un atelier en pilote', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.appointment.findMany.mockResolvedValue([appointment({ garageId: GARAGE_PILOT })]);

      await service.sendAppointmentReminders();

      expect(smsQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('checkImmobilizations()', () => {
    it('marque alertSent24h pour immobilisations > 24h', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicleImmobilization.findMany.mockResolvedValue([
        { id: 'immob-1', vehicleId: 'veh-1' },
      ]);

      await service.checkImmobilizations();

      expect(prismaMock.vehicleImmobilization.update).toHaveBeenCalledWith({
        where: { id: 'immob-1' },
        data: { alertSent24h: true },
      });
    });
  });
});
