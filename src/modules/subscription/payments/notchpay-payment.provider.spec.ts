import { createHmac } from 'crypto';
import { SubscriptionStatus } from '@prisma/client';
import { NotchPayPaymentProvider, normalizeNotchPayStatus } from './notchpay-payment.provider';
import { SubscriptionPaymentsService } from './subscription-payments.service';

// Réponse réelle de la sandbox NotchPay (POST /payments, 2026-10-02) : pas de champ `id`,
// `reference` = identifiant NotchPay (trx.…), notre référence dans merchant_reference/trxref.
const SANDBOX_TRANSACTION = {
  amount: 45_000,
  callback: null,
  currency: 'XAF',
  customer: 'cus.test_eFXEE5EqAhrikdvz',
  description: 'Atelier Maitre Pro - mensuel',
  locked_currency: 'XAF',
  merchant_reference: 'sub_e144fcbc2ade4a548f811670463b0894',
  reference: 'trx.test_00eZRSp5Bx037lwQlXcDo8yA',
  sandbox: true,
  status: 'pending',
  trxref: 'sub_e144fcbc2ade4a548f811670463b0894',
};

describe('NotchPayPaymentProvider', () => {
  const previousPublicKey = process.env.NOTCHPAY_PUBLIC_KEY;
  const previousWebhookHash = process.env.NOTCHPAY_WEBHOOK_HASH;
  const previousMode = process.env.NOTCHPAY_MODE;
  const previousTestPublicKey = process.env.NOTCHPAY_TEST_PUBLIC_KEY;
  const previousTestWebhookHash = process.env.NOTCHPAY_TEST_WEBHOOK_HASH;
  const previousLivePublicKey = process.env.NOTCHPAY_LIVE_PUBLIC_KEY;
  const previousLiveWebhookHash = process.env.NOTCHPAY_LIVE_WEBHOOK_HASH;
  const previousApiUrl = process.env.NOTCHPAY_API_URL;
  const previousFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NOTCHPAY_PUBLIC_KEY = 'pk_test_example';
    process.env.NOTCHPAY_WEBHOOK_HASH = 'test_hash_example';
    process.env.NOTCHPAY_MODE = 'test';
    process.env.NOTCHPAY_TEST_PUBLIC_KEY = 'pk_test_dedicated';
    process.env.NOTCHPAY_TEST_WEBHOOK_HASH = 'test_hash_example';
    process.env.NOTCHPAY_API_URL = 'https://api.notchpay.co';
    globalThis.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.NOTCHPAY_PUBLIC_KEY = previousPublicKey;
    process.env.NOTCHPAY_WEBHOOK_HASH = previousWebhookHash;
    process.env.NOTCHPAY_MODE = previousMode;
    process.env.NOTCHPAY_TEST_PUBLIC_KEY = previousTestPublicKey;
    process.env.NOTCHPAY_TEST_WEBHOOK_HASH = previousTestWebhookHash;
    process.env.NOTCHPAY_LIVE_PUBLIC_KEY = previousLivePublicKey;
    process.env.NOTCHPAY_LIVE_WEBHOOK_HASH = previousLiveWebhookHash;
    process.env.NOTCHPAY_API_URL = previousApiUrl;
    globalThis.fetch = previousFetch;
  });

  it('initializes a hosted checkout with the documented Authorization header', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'Accepted',
        transaction: 'trx_123',
        authorization_url: 'https://pay.notchpay.co/pay_123',
      }),
    });
    const provider = new NotchPayPaymentProvider();

    const result = await provider.initializePayment({
      amount: 45_000,
      currency: 'XAF',
      email: 'garage@example.com',
      customerName: 'Garage Test',
      description: 'Atelier Maitre Pro',
      reference: 'sub_123',
      callback: 'https://atelier.example/subscription/payment-return',
    });

    expect(result).toEqual({
      providerTransactionId: 'trx_123',
      authorizationUrl: 'https://pay.notchpay.co/pay_123',
      providerStatus: 'Accepted',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.notchpay.co/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'pk_test_dedicated' }),
      }),
    );
    const init = (globalThis.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: 45_000,
      currency: 'XAF',
      reference: 'sub_123',
      locked_currency: 'XAF',
      locked_country: 'CM',
    });
  });

  it('selects live credentials only when NOTCHPAY_MODE is live', async () => {
    process.env.NOTCHPAY_MODE = 'live';
    process.env.NOTCHPAY_LIVE_PUBLIC_KEY = 'pk_live_dedicated';
    process.env.NOTCHPAY_LIVE_WEBHOOK_HASH = 'live_hash_example';
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        transaction: 'trx_live',
        authorization_url: 'https://pay.notchpay.co/trx_live',
      }),
    });
    const provider = new NotchPayPaymentProvider();

    await provider.initializePayment({
      amount: 45_000,
      currency: 'XAF',
      email: 'garage@example.com',
      customerName: 'Garage Test',
      description: 'Atelier Maitre Pro',
      reference: 'sub_live',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.notchpay.co/payments',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'pk_live_dedicated' }),
      }),
    );
  });

  it('verifies x-notch-signature with HMAC SHA-256 in constant-length buffers', () => {
    const provider = new NotchPayPaymentProvider();
    const payload = Buffer.from('{"type":"payment.complete"}');
    const signature = createHmac('sha256', 'test_hash_example').update(payload).digest('hex');

    expect(provider.verifyWebhookSignature(payload, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(payload, '0'.repeat(64))).toBe(false);
    expect(provider.verifyWebhookSignature(payload, undefined)).toBe(false);
  });

  it('parses the documented payment.complete webhook shape', () => {
    const provider = new NotchPayPaymentProvider();

    expect(
      provider.parseWebhook({
        type: 'payment.complete',
        data: { id: 'trx_123', reference: 'sub_123' },
      }),
    ).toEqual({
      type: 'payment.complete',
      status: 'COMPLETE',
      providerTransactionId: 'trx_123',
      reference: 'sub_123',
    });
  });

  it.each([
    ['complete', 'COMPLETE'],
    ['paid', 'COMPLETE'],
    ['failed', 'FAILED'],
    ['cancelled', 'CANCELED'],
    ['pending', 'PENDING'],
    ['unexpected', 'UNKNOWN'],
  ] as const)('normalizes provider status %s to %s', (providerStatus, expected) => {
    expect(normalizeNotchPayStatus(providerStatus)).toBe(expected);
  });

  describe('real sandbox payload shape (trx.… reference + merchant_reference)', () => {
    it('stores the NotchPay transaction id from initialize, not our reference', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'Accepted',
          code: 201,
          transaction: SANDBOX_TRANSACTION,
          authorization_url: 'https://pay.notchpay.co/test.abc',
        }),
      });

      const result = await new NotchPayPaymentProvider().initializePayment({
        amount: 45_000, currency: 'XAF', email: 'qa@example.com', customerName: 'QA',
        description: 'Atelier Maitre Pro - mensuel', reference: SANDBOX_TRANSACTION.merchant_reference,
      });

      expect(result.providerTransactionId).toBe('trx.test_00eZRSp5Bx037lwQlXcDo8yA');
    });

    it('parses a webhook built on the transaction object', () => {
      expect(
        new NotchPayPaymentProvider().parseWebhook({
          type: 'payment.complete',
          data: { ...SANDBOX_TRANSACTION, status: 'complete' },
        }),
      ).toEqual({
        type: 'payment.complete',
        status: 'COMPLETE',
        providerTransactionId: 'trx.test_00eZRSp5Bx037lwQlXcDo8yA',
        reference: 'sub_e144fcbc2ade4a548f811670463b0894',
      });
    });

    it('accepts the event name under "event" as well as "type"', () => {
      expect(
        new NotchPayPaymentProvider().parseWebhook({ event: 'payment.complete', data: SANDBOX_TRANSACTION }).type,
      ).toBe('payment.complete');
    });

    it('retrieves a payment by its NotchPay id and returns our reference', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ code: 200, transaction: { ...SANDBOX_TRANSACTION, status: 'complete' } }),
      });

      const verified = await new NotchPayPaymentProvider().retrievePayment('trx.test_00eZRSp5Bx037lwQlXcDo8yA');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.notchpay.co/payments/trx.test_00eZRSp5Bx037lwQlXcDo8yA',
        expect.anything(),
      );
      expect(verified).toMatchObject({
        providerTransactionId: 'trx.test_00eZRSp5Bx037lwQlXcDo8yA',
        reference: 'sub_e144fcbc2ade4a548f811670463b0894',
        amount: 45_000,
        currency: 'XAF',
        status: 'COMPLETE',
      });
    });

    it('activates the subscription end to end (real provider + service)', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ transaction: { ...SANDBOX_TRANSACTION, status: 'complete' } }),
      });
      const stored = {
        id: 'payment-1', tenantId: 'tenant-1', provider: 'notchpay',
        providerTransactionId: 'trx.test_00eZRSp5Bx037lwQlXcDo8yA',
        reference: 'sub_e144fcbc2ade4a548f811670463b0894',
        amountXaf: 45_000, currency: 'XAF', plan: 'pro', billingCycle: 'monthly', status: 'PENDING',
      };
      const tx = {
        subscriptionPayment: {
          findFirst: jest.fn(async ({ where }: { where: { OR: Array<Record<string, string>> } }) =>
            where.OR.some((c) => c.providerTransactionId === stored.providerTransactionId || c.reference === stored.reference)
              ? stored
              : null),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        subscriptionPaymentEvent: { create: jest.fn().mockResolvedValue({}) },
        $queryRaw: jest.fn().mockResolvedValue([]),
        tenant: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            subscriptionStatus: SubscriptionStatus.TRIAL, subscriptionStartedAt: null, subscriptionEndsAt: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const prisma = { $transaction: jest.fn((callback: (t: unknown) => unknown) => callback(tx)) };
      const service = new SubscriptionPaymentsService(prisma as never, new NotchPayPaymentProvider());
      const body = Buffer.from(JSON.stringify({ type: 'payment.complete', data: { ...SANDBOX_TRANSACTION, status: 'complete' } }));
      const signature = createHmac('sha256', 'test_hash_example').update(body).digest('hex');

      const result = await service.handleWebhook(body, signature, JSON.parse(body.toString()));

      expect(result).toMatchObject({ received: true, activated: true });
      expect(tx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: SubscriptionStatus.ACTIVE }) }),
      );
    });
  });
});
