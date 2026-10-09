import { notificationKeys } from '../notification-keys';
import { NotificationStalenessService } from '../notification-staleness.service';

const NOW = new Date('2026-10-12T08:00:00Z');
const SCHEDULED = new Date('2026-10-13T09:00:00Z');

function makeService(rows: Record<string, unknown>) {
  const find = (key: string) => ({ findFirst: jest.fn().mockResolvedValue(rows[key] ?? null) });
  const prisma = {
    appointment: find('appointment'),
    serviceOrder: find('serviceOrder'),
    quote: find('quote'),
    invoice: find('invoice'),
    payment: find('payment'),
  };
  return { service: new NotificationStalenessService(prisma as never), prisma };
}

const target = (overrides: Record<string, unknown>) => ({
  garageId: 'g1',
  idempotencyKey: '',
  appointmentId: null,
  serviceOrderId: null,
  quoteId: null,
  invoiceId: null,
  paymentId: null,
  ...overrides,
}) as never;

describe('NotificationStalenessService', () => {
  const reminder = (key = notificationKeys.appointmentReminder('a1', SCHEDULED)) =>
    target({ eventType: 'APPOINTMENT_REMINDER', appointmentId: 'a1', idempotencyKey: key });

  it('RDV à jour : non périmé, recherche scopée par garage', async () => {
    const { service, prisma } = makeService({ appointment: { status: 'SCHEDULED', scheduledAt: SCHEDULED } });
    await expect(service.isStale(reminder(), NOW)).resolves.toBe(false);
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', garageId: 'g1' } }));
  });

  it.each([
    ['annulé', { status: 'CANCELLED', scheduledAt: SCHEDULED }],
    ['déplacé', { status: 'SCHEDULED', scheduledAt: new Date('2026-10-14T09:00:00Z') }],
    ['passé', { status: 'SCHEDULED', scheduledAt: new Date('2026-10-11T09:00:00Z') }],
    ['introuvable (autre garage)', null],
  ])('RDV %s : périmé', async (_, appointment) => {
    const { service } = makeService({ appointment });
    await expect(service.isStale(reminder(), NOW)).resolves.toBe(true);
  });

  it.each([
    ['READY', false],
    ['IN_PROGRESS', true],
    ['CANCELLED', true],
  ])('véhicule prêt, OT %s → périmé=%s', async (status, expected) => {
    const { service } = makeService({ serviceOrder: { status } });
    await expect(service.isStale(target({ eventType: 'VEHICLE_READY', serviceOrderId: 'o1' }), NOW)).resolves.toBe(expected);
  });

  it.each([
    ['SENT', false],
    ['REVISED', true],
    ['APPROVED', true],
  ])('devis %s → périmé=%s', async (status, expected) => {
    const { service } = makeService({ quote: { status } });
    await expect(service.isStale(target({ eventType: 'QUOTE_APPROVAL_REQUESTED', quoteId: 'q1' }), NOW)).resolves.toBe(expected);
  });

  it.each([
    ['ISSUED', '5000', false],
    ['PARTIAL', '1000', false],
    ['PAID', '0', true],
    ['ISSUED', '0', true],
  ])('relance facture %s, solde %s → périmé=%s', async (status, balance, expected) => {
    const { service } = makeService({ invoice: { status, balanceXaf: balance } });
    await expect(
      service.isStale(target({ eventType: 'INVOICE_PAYMENT_REMINDER', invoiceId: 'i1' }), NOW),
    ).resolves.toBe(expected);
  });

  it('facture disponible : une facture payée reste à notifier, un brouillon non', async () => {
    const paid = makeService({ invoice: { status: 'PAID', balanceXaf: '0' } });
    await expect(paid.service.isStale(target({ eventType: 'INVOICE_AVAILABLE', invoiceId: 'i1' }), NOW)).resolves.toBe(false);
    const draft = makeService({ invoice: { status: 'DRAFT', balanceXaf: '0' } });
    await expect(draft.service.isStale(target({ eventType: 'INVOICE_AVAILABLE', invoiceId: 'i1' }), NOW)).resolves.toBe(true);
  });

  it('paiement non confirmé : périmé', async () => {
    const { service } = makeService({ payment: { status: 'CANCELLED' } });
    await expect(service.isStale(target({ eventType: 'PAYMENT_CONFIRMED', paymentId: 'p1' }), NOW)).resolves.toBe(true);
  });

  it('référence absente : périmé sans requête', async () => {
    const { service, prisma } = makeService({});
    await expect(service.isStale(target({ eventType: 'VEHICLE_READY' }), NOW)).resolves.toBe(true);
    expect(prisma.serviceOrder.findFirst).not.toHaveBeenCalled();
  });
});
