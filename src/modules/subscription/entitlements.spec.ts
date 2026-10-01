import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { featureRequiredError, hasFeature } from './entitlements';

describe('entitlements', () => {
  describe('branding (logo personnalisé)', () => {
    it.each([
      [SubscriptionStatus.ACTIVE, 'essential', true],
      [SubscriptionStatus.ACTIVE, 'pro', true],
      [SubscriptionStatus.ACTIVE, 'business', true],
      [SubscriptionStatus.TRIAL, 'pro', false],
      [SubscriptionStatus.GRACE_PERIOD, 'pro', false],
      [SubscriptionStatus.EXPIRED, 'pro', false],
      [SubscriptionStatus.SUSPENDED, 'business', false],
    ])('%s / %s → %s', (status, plan, expected) => {
      expect(hasFeature({ status, plan }, 'branding')).toBe(expected);
    });
  });

  it('featureRequiredError conserve le contrat PAID_FEATURE_REQUIRED du logo', () => {
    const err = featureRequiredError('branding', { status: SubscriptionStatus.TRIAL, plan: 'pro' });

    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({
      errorCode: 'PAID_FEATURE_REQUIRED',
      feature: 'branding',
      subscriptionStatus: SubscriptionStatus.TRIAL,
    });
  });
});
