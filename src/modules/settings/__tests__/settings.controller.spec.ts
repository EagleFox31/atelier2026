import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { SettingsController } from '../settings.controller';

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

function makeController(status: SubscriptionStatus | null, plan = 'pro') {
  const settings = {
    shopName: 'Garage Test',
    tagline: 't',
    niu: null,
    email: 'g@test.cm',
    phone: '+237',
    address: 'Douala',
    logoUrl: LOGO,
    defaultLaborRateXaf: 15000,
    taxRatePct: 19.25,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
  const settingsService = {
    getWorkshopSettings: jest.fn().mockResolvedValue(settings),
    updateWorkshopSettings: jest.fn().mockResolvedValue(settings),
    updateLogo: jest.fn().mockResolvedValue(settings),
  };
  const subscriptions = {
    getSummary: jest.fn().mockResolvedValue({ status, plan }),
    statusFromLoadedTenant: jest.fn().mockReturnValue(null),
  };
  const controller = new SettingsController(settingsService as never, subscriptions as never);
  const user = status === null
    ? { id: 'u1', garageId: 'g1', tenantId: null }
    : { id: 'u1', garageId: 'g1', tenantId: 't1' };
  return { controller, settingsService, subscriptions, user };
}

describe('SettingsController — droit « branding »', () => {
  it('masque le logo (sans le supprimer) pendant le pilote', async () => {
    const { controller, settingsService, user } = makeController(SubscriptionStatus.TRIAL);

    const res = await controller.getWorkshopSettings(user);

    expect(res.logoUrl).toBeNull();
    expect(res.brandingEnabled).toBe(false);
    expect(settingsService.updateLogo).not.toHaveBeenCalled();
  });

  it.each([SubscriptionStatus.EXPIRED, SubscriptionStatus.SUSPENDED, SubscriptionStatus.GRACE_PERIOD])(
    'masque le logo quand l’abonnement est %s',
    async (status) => {
      const { controller, user } = makeController(status);
      expect((await controller.getWorkshopSettings(user)).logoUrl).toBeNull();
    },
  );

  it('renvoie le logo avec un forfait payant actif', async () => {
    const { controller, user } = makeController(SubscriptionStatus.ACTIVE, 'essential');

    const res = await controller.getWorkshopSettings(user);

    expect(res.logoUrl).toBe(LOGO);
    expect(res.brandingEnabled).toBe(true);
  });

  it('applique aussi le masquage à la réponse de PATCH /settings/workshop', async () => {
    const { controller, user } = makeController(SubscriptionStatus.TRIAL);

    const res = await controller.updateWorkshopSettings({} as never, user);

    expect(res.logoUrl).toBeNull();
  });

  it('refuse l’envoi d’un logo hors forfait payant actif (PAID_FEATURE_REQUIRED)', async () => {
    const { controller, settingsService, user } = makeController(SubscriptionStatus.TRIAL);

    await expect(controller.updateLogo({ logoUrl: LOGO }, user)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateLogo({ logoUrl: LOGO }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAID_FEATURE_REQUIRED' }),
    });
    expect(settingsService.updateLogo).not.toHaveBeenCalled();
  });

  it('accepte l’envoi d’un logo avec un forfait payant actif', async () => {
    const { controller, settingsService, user } = makeController(SubscriptionStatus.ACTIVE);

    const res = await controller.updateLogo({ logoUrl: LOGO }, user);

    expect(settingsService.updateLogo).toHaveBeenCalledWith(LOGO, 'u1', 'g1');
    expect(res.logoUrl).toBe(LOGO);
  });

  it('ne change rien pour un compte sans tenant (plateforme / données historiques)', async () => {
    const { controller, subscriptions, user } = makeController(null);

    const res = await controller.getWorkshopSettings(user);

    expect(subscriptions.getSummary).not.toHaveBeenCalled();
    expect(res.logoUrl).toBe(LOGO);
    await expect(controller.updateLogo({ logoUrl: LOGO }, user)).resolves.toBeDefined();
  });
});
