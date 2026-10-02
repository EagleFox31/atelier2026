/**
 * Lot 2C : statut d'abonnement calculé en mémoire (0 requête par appel API)
 * et droits du forfait exposés au front (features).
 */
import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import {
  SubscriptionService,
  resolveSubscriptionStatus,
  subscriptionFeatures,
} from '../subscription.service';
import { SubscriptionGuard } from '../../../guards/subscription.guard';

const DAY = 24 * 60 * 60 * 1000;
const trialEnds = new Date('2026-10-31T08:00:00.000Z');
const graceEnds = new Date(trialEnds.getTime() + 7 * DAY);

function makeService(now: Date) {
  const prisma = {
    tenant: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const clock = { now: jest.fn().mockReturnValue(now) };
  return { service: new SubscriptionService(prisma as never, clock as never), prisma };
}

function context(method: string, tenant: Record<string, unknown>, path = '/api/workshop/ot') {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        user: { tenantId: 't1', roles: [{ role: { code: 'ADMIN' } }], tenant },
      }),
    }),
  } as never;
}

const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

describe('resolveSubscriptionStatus (pure)', () => {
  it.each([
    ['avant la fin du pilote', SubscriptionStatus.TRIAL, trialEnds.getTime() - 1, SubscriptionStatus.TRIAL],
    ['pilote terminé, en grâce', SubscriptionStatus.TRIAL, trialEnds.getTime() + 1, SubscriptionStatus.GRACE_PERIOD],
    ['grâce terminée', SubscriptionStatus.GRACE_PERIOD, graceEnds.getTime() + 1, SubscriptionStatus.EXPIRED],
    ['ACTIVE reste ACTIVE', SubscriptionStatus.ACTIVE, graceEnds.getTime() + DAY, SubscriptionStatus.ACTIVE],
    ['SUSPENDED reste SUSPENDED', SubscriptionStatus.SUSPENDED, 0, SubscriptionStatus.SUSPENDED],
  ])('%s', (_label, stored, nowMs, expected) => {
    expect(
      resolveSubscriptionStatus({ subscriptionStatus: stored, trialEndsAt: trialEnds, graceEndsAt: graceEnds }, new Date(nowMs)),
    ).toBe(expected);
  });

  it('tenant historique sans dates : ACTIVE (jamais coupé par erreur)', () => {
    expect(
      resolveSubscriptionStatus({ subscriptionStatus: SubscriptionStatus.TRIAL, trialEndsAt: null, graceEndsAt: null }, new Date()),
    ).toBe(SubscriptionStatus.ACTIVE);
  });
});

describe('subscriptionFeatures (exposé au front)', () => {
  it.each([
    [SubscriptionStatus.TRIAL, 'pro', { sms: false, branding: false }],
    [SubscriptionStatus.ACTIVE, 'essential', { sms: false, branding: true }],
    [SubscriptionStatus.ACTIVE, 'pro', { sms: true, branding: true }],
    [SubscriptionStatus.ACTIVE, 'business', { sms: true, branding: true }],
    [SubscriptionStatus.GRACE_PERIOD, 'business', { sms: false, branding: false }],
  ])('%s / %s', (status, plan, expected) => {
    expect(subscriptionFeatures(status, plan)).toEqual(expected);
  });
});

describe('SubscriptionService.statusFromLoadedTenant', () => {
  it('calcule le statut sans aucune requête, avec l’horloge du service', () => {
    const { service, prisma } = makeService(new Date(trialEnds.getTime() + 60_000));

    const res = service.statusFromLoadedTenant({
      plan: 'pro',
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: trialEnds,
      graceEndsAt: graceEnds,
    });

    expect(res).toEqual({ status: SubscriptionStatus.GRACE_PERIOD, plan: 'pro' });
    expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('champs absents (appel hors requête HTTP) : null → repli sur getSummary()', () => {
    const { service } = makeService(new Date());
    expect(service.statusFromLoadedTenant(undefined)).toBeNull();
    expect(service.statusFromLoadedTenant({ plan: 'pro' })).toBeNull();
  });
});

describe('SubscriptionGuard — zéro requête par appel API', () => {
  it('pilote en cours : autorisé sans lire la base', async () => {
    const { service, prisma } = makeService(new Date(trialEnds.getTime() - DAY));
    const guard = new SubscriptionGuard(reflector as never, service);

    await expect(
      guard.canActivate(context('POST', { plan: 'pro', subscriptionStatus: 'TRIAL', trialEndsAt: trialEnds, graceEndsAt: graceEnds })),
    ).resolves.toBe(true);
    expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('fin du pilote dépassée d’une seconde (cron pas encore passé) : écriture refusée TRIAL_READ_ONLY', async () => {
    const { service, prisma } = makeService(new Date(trialEnds.getTime() + 1000));
    const guard = new SubscriptionGuard(reflector as never, service);

    const result = guard.canActivate(
      context('POST', { plan: 'pro', subscriptionStatus: 'TRIAL', trialEndsAt: trialEnds, graceEndsAt: graceEnds }),
    );

    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'TRIAL_READ_ONLY' }) });
    expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
