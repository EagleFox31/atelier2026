import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  InitializePaymentInput,
  InitializedPayment,
  PaymentProvider,
  PaymentWebhookEvent,
  ProviderPaymentStatus,
  RetrievedPayment,
} from './payment-provider';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeNotchPayStatus(value: unknown): ProviderPaymentStatus {
  const status = asString(value)?.toLowerCase();
  if (!status) return 'UNKNOWN';
  if (['complete', 'completed', 'success', 'successful', 'paid'].includes(status)) return 'COMPLETE';
  if (['failed', 'failure', 'declined'].includes(status)) return 'FAILED';
  if (['canceled', 'cancelled'].includes(status)) return 'CANCELED';
  if (status === 'expired') return 'EXPIRED';
  if (['pending', 'processing', 'created', 'initialized'].includes(status)) return 'PENDING';
  return 'UNKNOWN';
}

@Injectable()
export class NotchPayPaymentProvider implements PaymentProvider {
  readonly name = 'notchpay';

  async initializePayment(input: InitializePaymentInput): Promise<InitializedPayment> {
    const payload = await this.request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        email: input.email,
        customer: { name: input.customerName, email: input.email },
        description: input.description,
        reference: input.reference,
        ...(input.callback ? { callback: input.callback } : {}),
        locked_currency: input.currency,
        locked_country: 'CM',
      }),
    });

    const transaction = asObject(payload.transaction);
    const providerTransactionId =
      asString(payload.transaction) ??
      asString(transaction?.id) ??
      asString(transaction?.transaction) ??
      asString(transaction?.reference);
    const authorizationUrl =
      asString(payload.authorization_url) ?? asString(transaction?.authorization_url);

    if (!providerTransactionId || !authorizationUrl) {
      throw new BadGatewayException({
        message: 'NotchPay a renvoye une reponse de paiement incomplete.',
        errorCode: 'PAYMENT_PROVIDER_INVALID_RESPONSE',
      });
    }

    return {
      providerTransactionId,
      authorizationUrl,
      providerStatus: asString(transaction?.status) ?? asString(payload.status),
    };
  }

  async retrievePayment(reference: string): Promise<RetrievedPayment> {
    const payload = await this.request(`/payments/${encodeURIComponent(reference)}`, { method: 'GET' });
    const transaction = asObject(payload.transaction);
    const data = transaction ?? asObject(payload.data) ?? payload;
    const providerStatus = asString(data.status);

    return {
      providerTransactionId:
        asString(data.id) ??
        asString(data.transaction) ??
        asString(payload.transaction) ??
        reference,
      reference: asString(data.reference),
      amount: asNumber(data.amount),
      currency: asString(data.currency)?.toUpperCase() ?? null,
      status: normalizeNotchPayStatus(providerStatus),
      providerStatus,
    };
  }

  verifyWebhookSignature(rawPayload: Buffer, signature: string | undefined): boolean {
    const hash = process.env.NOTCHPAY_WEBHOOK_HASH?.trim();
    if (!hash) {
      throw new ServiceUnavailableException({
        message: 'La verification des webhooks NotchPay n\'est pas configuree.',
        errorCode: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      });
    }
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;

    const expected = createHmac('sha256', hash).update(rawPayload).digest('hex');
    return timingSafeEqual(Buffer.from(signature.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'));
  }

  parseWebhook(payload: unknown): PaymentWebhookEvent {
    const root = asObject(payload);
    const data = asObject(root?.data);
    const transaction = asObject(data?.transaction);
    const type = asString(root?.type);
    if (!root || !data || !type) {
      throw new BadRequestException({
        message: 'Webhook NotchPay invalide.',
        errorCode: 'INVALID_PAYMENT_WEBHOOK',
      });
    }

    const statusFromType = type.startsWith('payment.') ? type.slice('payment.'.length) : null;
    const providerTransactionId =
      asString(data.id) ?? asString(data.transaction) ?? asString(transaction?.id);
    const reference = asString(data.reference) ?? asString(transaction?.reference);

    if (!providerTransactionId && !reference) {
      throw new BadRequestException({
        message: 'Le webhook NotchPay ne contient aucune reference de paiement.',
        errorCode: 'INVALID_PAYMENT_WEBHOOK',
      });
    }

    return {
      type,
      status: normalizeNotchPayStatus(asString(data.status) ?? statusFromType),
      providerTransactionId,
      reference,
    };
  }

  private async request(path: string, init: RequestInit): Promise<JsonObject> {
    const publicKey = process.env.NOTCHPAY_PUBLIC_KEY?.trim();
    if (!publicKey) {
      throw new ServiceUnavailableException({
        message: 'NotchPay n\'est pas configure.',
        errorCode: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      });
    }

    const baseUrl = (process.env.NOTCHPAY_API_URL || 'https://api.notchpay.co').replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: publicKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const providerMessage = asString(asObject(payload)?.message);
        throw new BadGatewayException({
          message: providerMessage || 'NotchPay a refuse la requete.',
          errorCode: 'PAYMENT_PROVIDER_ERROR',
        });
      }

      const object = asObject(payload);
      if (!object) {
        throw new BadGatewayException({
          message: 'NotchPay a renvoye une reponse illisible.',
          errorCode: 'PAYMENT_PROVIDER_INVALID_RESPONSE',
        });
      }
      return object;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new BadGatewayException({
        message: 'NotchPay est temporairement indisponible.',
        errorCode: 'PAYMENT_PROVIDER_UNAVAILABLE',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
