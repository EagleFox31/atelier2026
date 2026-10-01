import { SubscriptionStatus } from '@prisma/client';
import type { PaymentProvider } from './payment-provider';
import {
  addBillingPeriod,
  calculateProPrice,
  SubscriptionPaymentsService,
} from './subscription-payments.service';

describe('subscription payment pricing', () => {
  it.each([
    ['monthly', 1, 45_000],
    ['monthly', 2, 65_000],
    ['annual', 1, 450_000],
    ['annual', 2, 690_000],
    ['annual', 3, 930_000],
  ] as const)('prices %s with %d garage(s) at %d XAF', (cycle, garages, amount) => {
    expect(calculateProPrice(cycle, garages)).toBe(amount);
  });

  it('clamps a monthly renewal to the last valid day of the target month', () => {
    expect(addBillingPeriod(new Date('2027-01-31T10:30:00.000Z'), 'monthly').toISOString()).toBe(
      '2027-02-28T10:30:00.000Z',
    );
  });

  it('clamps an annual leap-day renewal', () => {
    expect(addBillingPeriod(new Date('2028-02-29T10:30:00.000Z'), 'annual').toISOString()).toBe(
      '2029-02-28T10:30:00.000Z',
    );
  });
});

describe('SubscriptionPaymentsService', () => {
  function makeProvider(): jest.Mocked<PaymentProvider> {
    return {
      name: 'notchpay',
      initializePayment: jest.fn(),
      retrievePayment: jest.fn(),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      parseWebhook: jest.fn(),
    };
  }

  it('derives checkout amount and garage count on the server', async () => {
    const prisma = {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          name: 'Garage Test',
          email: 'garage@example.com',
          subscriptionStatus: SubscriptionStatus.EXPIRED,
        }),
      },
      garage: { count: jest.fn().mockResolvedValue(2) },
      subscriptionPayment: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
      },
    };
    const provider = makeProvider();
    provider.initializePayment.mockResolvedValue({
      providerTransactionId: 'trx-1',
      authorizationUrl: 'https://pay.notchpay.co/trx-1',
      providerStatus: 'Accepted',
    });
    const service = new SubscriptionPaymentsService(prisma as never, provider);

    const result = await service.createCheckout('tenant-1', 'annual');

    expect(result).toMatchObject({ amountXaf: 690_000, garageCount: 2, billingCycle: 'annual' });
    expect(provider.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 690_000, currency: 'XAF' }),
    );
    expect(prisma.subscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        amountXaf: 690_000,
        garageCount: 2,
        status: 'PENDING',
      }),
    });
  });

  it('activates an expired tenant only after provider-side verification', async () => {
    const payment = {
      id: 'payment-1',
      tenantId: 'tenant-1',
      provider: 'notchpay',
      providerTransactionId: 'trx-1',
      reference: 'sub-1',
      amountXaf: 45_000,
      currency: 'XAF',
      plan: 'pro',
      billingCycle: 'monthly',
      status: 'PENDING',
    };
    const tx = {
      subscriptionPayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscriptionPaymentEvent: { create: jest.fn().mockResolvedValue({}) },
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          subscriptionStatus: SubscriptionStatus.EXPIRED,
          subscriptionStartedAt: null,
          subscriptionEndsAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const provider = makeProvider();
    provider.parseWebhook.mockReturnValue({
      type: 'payment.complete',
      status: 'COMPLETE',
      providerTransactionId: 'trx-1',
      reference: 'sub-1',
    });
    provider.retrievePayment.mockResolvedValue({
      providerTransactionId: 'trx-1',
      reference: 'sub-1',
      amount: 45_000,
      currency: 'XAF',
      status: 'COMPLETE',
      providerStatus: 'complete',
    });
    const service = new SubscriptionPaymentsService(prisma as never, provider);

    const result = await service.handleWebhook(
      Buffer.from('{"type":"payment.complete"}'),
      'signature',
      { type: 'payment.complete', data: { id: 'trx-1' } },
    );

    expect(result).toMatchObject({ received: true, activated: true });
    expect(provider.retrievePayment).toHaveBeenCalledWith('trx-1');
    expect(tx.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: expect.objectContaining({
        plan: 'pro',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      }),
    });
  });

  it('does not unlock access for a failed payment', async () => {
    const tx = {
      subscriptionPayment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payment-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscriptionPaymentEvent: { create: jest.fn().mockResolvedValue({}) },
      tenant: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const provider = makeProvider();
    provider.parseWebhook.mockReturnValue({
      type: 'payment.failed',
      status: 'FAILED',
      providerTransactionId: 'trx-1',
      reference: null,
    });
    const service = new SubscriptionPaymentsService(prisma as never, provider);

    const result = await service.handleWebhook(
      Buffer.from('{"type":"payment.failed"}'),
      'signature',
      { type: 'payment.failed', data: { id: 'trx-1' } },
    );

    expect(result).toEqual({ received: true, activated: false });
    expect(provider.retrievePayment).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.subscriptionPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { not: 'COMPLETE' } },
      data: { status: 'FAILED', providerStatus: 'FAILED' },
    });
  });

  it('treats an already-recorded webhook fingerprint as a duplicate', async () => {
    const prisma = { $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }) };
    const provider = makeProvider();
    provider.parseWebhook.mockReturnValue({
      type: 'payment.failed',
      status: 'FAILED',
      providerTransactionId: 'trx-1',
      reference: null,
    });
    const service = new SubscriptionPaymentsService(prisma as never, provider);

    await expect(
      service.handleWebhook(
        Buffer.from('{"type":"payment.failed"}'),
        'signature',
        { type: 'payment.failed', data: { id: 'trx-1' } },
      ),
    ).resolves.toEqual({ received: true, duplicate: true, activated: false });
  });

  it('rejects a completed webhook when the verified amount differs', async () => {
    const tx = {
      subscriptionPayment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment-1',
          tenantId: 'tenant-1',
          providerTransactionId: 'trx-1',
          reference: 'sub-1',
          amountXaf: 45_000,
          currency: 'XAF',
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const provider = makeProvider();
    provider.parseWebhook.mockReturnValue({
      type: 'payment.complete',
      status: 'COMPLETE',
      providerTransactionId: 'trx-1',
      reference: 'sub-1',
    });
    provider.retrievePayment.mockResolvedValue({
      providerTransactionId: 'trx-1',
      reference: 'sub-1',
      amount: 1,
      currency: 'XAF',
      status: 'COMPLETE',
      providerStatus: 'complete',
    });
    const service = new SubscriptionPaymentsService(prisma as never, provider);

    await expect(
      service.handleWebhook(
        Buffer.from('{"type":"payment.complete"}'),
        'signature',
        { type: 'payment.complete', data: { id: 'trx-1' } },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PAYMENT_AMOUNT_MISMATCH' }),
    });
  });
});
