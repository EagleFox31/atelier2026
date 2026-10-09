import { NotificationPreferencesService } from '../notification-preferences.service';
import { NOTIFICATION_CATALOG } from '../customer-notification-catalog';

function makeService(rows: { eventType: string; enabled: boolean }[] = []) {
  const prisma = {
    garageNotificationSetting: {
      findMany: jest.fn().mockResolvedValue(rows),
      upsert: jest.fn((args) => args),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  return { service: new NotificationPreferencesService(prisma as never), prisma };
}

describe('NotificationPreferencesService', () => {
  it('liste chaque événement du catalogue : surcharge du garage, sinon défaut', async () => {
    const { service } = makeService([{ eventType: 'VEHICLE_READY', enabled: false }]);

    const prefs = await service.list('g1');
    expect(prefs.map((p) => p.eventType)).toEqual(Object.keys(NOTIFICATION_CATALOG));
    expect(prefs.find((p) => p.eventType === 'VEHICLE_READY')).toEqual({
      eventType: 'VEHICLE_READY', enabled: false, defaultEnabled: true,
    });
    expect(prefs.find((p) => p.eventType === 'SERVICE_ORDER_RECEIVED')).toEqual({
      eventType: 'SERVICE_ORDER_RECEIVED', enabled: false, defaultEnabled: false,
    });
  });

  it('n’écrit que les valeurs effectives qui changent', async () => {
    const { service, prisma } = makeService();

    await service.update('g1', [
      { eventType: 'VEHICLE_READY', enabled: true },            // déjà le défaut : no-op
      { eventType: 'SERVICE_ORDER_RECEIVED', enabled: true },   // change
    ], 'u1');

    expect(prisma.garageNotificationSetting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.garageNotificationSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { garageId_eventType: { garageId: 'g1', eventType: 'SERVICE_ORDER_RECEIVED' } },
      create: expect.objectContaining({ enabled: true, updatedById: 'u1' }),
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('état déjà convergé : zéro écriture', async () => {
    const { service, prisma } = makeService([{ eventType: 'VEHICLE_READY', enabled: false }]);

    await service.update('g1', [{ eventType: 'VEHICLE_READY', enabled: false }], 'u1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
