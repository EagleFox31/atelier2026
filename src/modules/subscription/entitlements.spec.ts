import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { featureRequiredError, hasFeature, normalizePlan } from './entitlements';

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

  describe('sms (Pro / Business actif uniquement, refus par défaut)', () => {
    it.each([
      [SubscriptionStatus.ACTIVE, 'pro', true],
      [SubscriptionStatus.ACTIVE, 'business', true],
      [SubscriptionStatus.ACTIVE, ' PRO ', true],
      [SubscriptionStatus.ACTIVE, 'essential', false],
      [SubscriptionStatus.ACTIVE, 'starter', false],
      [SubscriptionStatus.ACTIVE, 'enterprise', false],
      [SubscriptionStatus.ACTIVE, '', false],
      [SubscriptionStatus.TRIAL, 'pro', false],
      [SubscriptionStatus.GRACE_PERIOD, 'business', false],
      [SubscriptionStatus.EXPIRED, 'pro', false],
      [SubscriptionStatus.SUSPENDED, 'business', false],
    ])('%s / "%s" → %s', (status, plan, expected) => {
      expect(hasFeature({ status, plan }, 'sms')).toBe(expected);
    });

    it('refus SMS : errorCode SMS_SUBSCRIPTION_REQUIRED avec statut et forfait', () => {
      const err = featureRequiredError('sms', { status: SubscriptionStatus.ACTIVE, plan: 'essential' });
      expect(err.getResponse()).toMatchObject({
        errorCode: 'SMS_SUBSCRIPTION_REQUIRED',
        feature: 'sms',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        plan: 'essential',
      });
    });
  });

  describe('whatsapp (Pro / Business actif uniquement, refus par défaut)', () => {
    it.each([
      [SubscriptionStatus.ACTIVE, 'pro', true],
      [SubscriptionStatus.ACTIVE, 'business', true],
      [SubscriptionStatus.ACTIVE, 'essential', false],
      [SubscriptionStatus.ACTIVE, 'enterprise', false],
      [SubscriptionStatus.TRIAL, 'pro', false],
      [SubscriptionStatus.GRACE_PERIOD, 'business', false],
      [SubscriptionStatus.EXPIRED, 'pro', false],
      [SubscriptionStatus.SUSPENDED, 'business', false],
    ])('%s / "%s" → %s', (status, plan, expected) => {
      expect(hasFeature({ status, plan }, 'whatsapp')).toBe(expected);
    });

    it('refus WhatsApp : errorCode WHATSAPP_SUBSCRIPTION_REQUIRED', () => {
      const err = featureRequiredError('whatsapp', { status: SubscriptionStatus.TRIAL, plan: 'pro' });
      expect(err.getResponse()).toMatchObject({ errorCode: 'WHATSAPP_SUBSCRIPTION_REQUIRED', feature: 'whatsapp' });
    });
  });

  it.each([
    ['starter', 'essential'],
    ['Essential', 'essential'],
    ['pro', 'pro'],
    ['BUSINESS', 'business'],
    ['enterprise', null],
  ])('normalizePlan("%s") → %s', (input, expected) => {
    expect(normalizePlan(input)).toBe(expected);
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
