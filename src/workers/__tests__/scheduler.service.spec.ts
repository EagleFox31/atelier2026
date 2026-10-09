import { SchedulerService } from '../scheduler.service';

function makeDeps() {
  const prismaMock = {
    vehicleImmobilization: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new SchedulerService(prismaMock as any);
  return { service, prismaMock };
}

describe('SchedulerService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ne porte plus les rappels clients (déplacés dans ReminderSchedulerService)', () => {
    const { service } = makeDeps();
    expect((service as any).handleUnpaidInvoices).toBeUndefined();
    expect((service as any).sendAppointmentReminders).toBeUndefined();
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
