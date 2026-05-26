import { SchedulerService } from '../scheduler.service';

function makeDeps() {
  const prismaMock = {
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    vehicleImmobilization: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const smsQueue = { add: jest.fn().mockResolvedValue({}) };
  const service = new SchedulerService(prismaMock as any, smsQueue as any);
  return { service, prismaMock, smsQueue };
}

describe('SchedulerService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('handleUnpaidInvoices() — relance J+7', () => {
    it('envoie SMS et marque reminder1SentAt pour factures échues', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      const invoice = {
        id: 'inv-1',
        reference: 'FAC-001',
        customerId: 'cust-1',
        customer: { phonePrimary: '+237690000001', lastName: 'Ngono', lang: 'fr' },
      };
      prismaMock.invoice.findMany.mockResolvedValue([invoice]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).toHaveBeenCalledWith(
        'reminder_j7',
        expect.objectContaining({
          phone: '+237690000001',
          customerId: 'cust-1',
        }),
      );
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { reminder1SentAt: expect.any(Date) },
      });
    });

    it('ignore les factures sans téléphone client', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      prismaMock.invoice.findMany.mockResolvedValue([
        { id: 'inv-2', reference: 'FAC-002', customer: { phonePrimary: null } },
      ]);

      await service.handleUnpaidInvoices();

      expect(smsQueue.add).not.toHaveBeenCalled();
      expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('handleUnpaidInvoicesJ15() — relance J+15', () => {
    it('envoie reminder_j15 et marque reminder2SentAt', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      const invoice = {
        id: 'inv-3',
        reference: 'FAC-003',
        customerId: 'cust-2',
        customer: { phonePrimary: '+237690000002', lastName: 'Mbarga', lang: 'fr' },
      };
      prismaMock.invoice.findMany.mockResolvedValue([invoice]);

      await service.handleUnpaidInvoicesJ15();

      expect(smsQueue.add).toHaveBeenCalledWith('reminder_j15', expect.any(Object));
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-3' },
        data: { reminder2SentAt: expect.any(Date) },
      });
    });
  });

  describe('sendAppointmentReminders() — RDV J-1', () => {
    it('envoie un SMS par rendez-vous confirmé', async () => {
      const { service, prismaMock, smsQueue } = makeDeps();
      const scheduledAt = new Date('2026-05-24T10:00:00Z');
      prismaMock.appointment.findMany.mockResolvedValue([
        {
          scheduledAt,
          customer: {
            id: 'cust-3',
            phonePrimary: '+237690000003',
            firstName: 'Alice',
            lastName: 'Fotso',
            lang: 'fr',
          },
          vehicle: { make: { name: 'Toyota' }, model: { name: 'Corolla' } },
        },
      ]);

      await service.sendAppointmentReminders();

      expect(smsQueue.add).toHaveBeenCalledWith(
        'appointment_reminder',
        expect.objectContaining({
          phone: '+237690000003',
          message: expect.stringContaining('rendez-vous demain'),
        }),
      );
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
