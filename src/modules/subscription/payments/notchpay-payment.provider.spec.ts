import { createHmac } from 'crypto';
import { NotchPayPaymentProvider, normalizeNotchPayStatus } from './notchpay-payment.provider';

describe('NotchPayPaymentProvider', () => {
  const previousPublicKey = process.env.NOTCHPAY_PUBLIC_KEY;
  const previousWebhookHash = process.env.NOTCHPAY_WEBHOOK_HASH;
  const previousApiUrl = process.env.NOTCHPAY_API_URL;
  const previousFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NOTCHPAY_PUBLIC_KEY = 'pk_test_example';
    process.env.NOTCHPAY_WEBHOOK_HASH = 'test_hash_example';
    process.env.NOTCHPAY_API_URL = 'https://api.notchpay.co';
    globalThis.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.NOTCHPAY_PUBLIC_KEY = previousPublicKey;
    process.env.NOTCHPAY_WEBHOOK_HASH = previousWebhookHash;
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
        headers: expect.objectContaining({ Authorization: 'pk_test_example' }),
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
});
