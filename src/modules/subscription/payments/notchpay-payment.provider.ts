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
  WebhookHeaders,
} from './payment-provider';

type JsonObject = Record<string, unknown>;
type NotchPayMode = 'test' | 'live';

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

/**
 * NotchPay a DEUX identifiants (constaté sur la sandbox, 2026-10-02) :
 * - `reference` = SON identifiant de transaction (`trx.test_…` / `trx.…`), sans champ `id` ;
 * - `merchant_reference` / `trxref` = NOTRE référence (`sub_…`) passée à l'initialisation.
 * Lire `reference` comme notre référence faisait ignorer tous les webhooks (LESSON-2026-013).
 */
export function notchPayIdentifiers(source: JsonObject | null): {
  providerTransactionId: string | null;
  merchantReference: string | null;
} {
  if (!source) return { providerTransactionId: null, merchantReference: null };
  const rawReference = asString(source.reference);
  const isProviderReference = rawReference?.startsWith('trx.') ?? false;
  return {
    providerTransactionId:
      asString(source.id) ??
      asString(source.transaction) ??
      (isProviderReference ? rawReference : null),
    merchantReference:
      asString(source.merchant_reference) ??
      asString(source.trxref) ??
      (isProviderReference ? null : rawReference),
  };
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

function notchPayMode(): NotchPayMode {
  const mode = process.env.NOTCHPAY_MODE?.trim().toLowerCase() || 'test';
  if (mode !== 'test' && mode !== 'live') {
    throw new ServiceUnavailableException({
      message: 'NOTCHPAY_MODE doit valoir test ou live.',
      errorCode: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    });
  }
  return mode;
}

function credentialForMode(kind: 'PUBLIC_KEY' | 'WEBHOOK_HASH'): string | undefined {
  const mode = notchPayMode();
  const dedicated = process.env[`NOTCHPAY_${mode.toUpperCase()}_${kind}`]?.trim();
  if (dedicated) return dedicated;

  // Compatibilite avec la premiere configuration, sans jamais melanger
  // silencieusement une cle live et un environnement de test (ou inversement).
  const legacyName = kind === 'PUBLIC_KEY' ? 'NOTCHPAY_PUBLIC_KEY' : 'NOTCHPAY_WEBHOOK_HASH';
  const legacy = process.env[legacyName]?.trim();
  const expectedPrefix = kind === 'PUBLIC_KEY' ? `pk_${mode}_` : `hsk_${mode}_`;
  return legacy?.startsWith(expectedPrefix) ? legacy : undefined;
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
      asString(payload.transaction) ?? notchPayIdentifiers(transaction).providerTransactionId;
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
    const ids = notchPayIdentifiers(data);

    return {
      providerTransactionId: ids.providerTransactionId ?? asString(payload.transaction) ?? reference,
      reference: ids.merchantReference,
      amount: asNumber(data.amount),
      currency: asString(data.currency)?.toUpperCase() ?? null,
      status: normalizeNotchPayStatus(providerStatus),
      providerStatus,
    };
  }

  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): boolean {
    const signature = headers['x-notch-signature'];
    return this.verifyWebhookSignature(rawBody, Array.isArray(signature) ? signature[0] : signature);
  }

  verifyWebhookSignature(rawPayload: Buffer, signature: string | undefined): boolean {
    const hash = credentialForMode('WEBHOOK_HASH');
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
    const type = asString(root?.type) ?? asString(root?.event);
    if (!root || !data || !type) {
      throw new BadRequestException({
        message: 'Webhook NotchPay invalide.',
        errorCode: 'INVALID_PAYMENT_WEBHOOK',
      });
    }

    const statusFromType = type.startsWith('payment.') ? type.slice('payment.'.length) : null;
    const fromData = notchPayIdentifiers(data);
    const fromTransaction = notchPayIdentifiers(transaction);
    const providerTransactionId =
      fromData.providerTransactionId ?? fromTransaction.providerTransactionId;
    const reference = fromData.merchantReference ?? fromTransaction.merchantReference;

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
    const publicKey = credentialForMode('PUBLIC_KEY');
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
