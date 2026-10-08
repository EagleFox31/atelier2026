import {
  PermanentMessagingError,
  TemporaryMessagingError,
  type PermanentMessagingErrorCode,
} from '../messaging.errors';
import { detectCameroonOperator, isValidAlphanumericSenderId, maskPhone, toE164 } from '../shared/phone';
import type {
  SendSmsRequest,
  SendSmsResult,
  SenderValidation,
  SmsDeliveryStatus,
  SmsProvider,
} from './sms-provider.interface';

const DEFAULT_API_URL = 'https://api.sms.to';
const REQUEST_TIMEOUT_MS = 10_000;

/** Statuts SMS.to → contrat interne ; tout le reste reste `UNKNOWN`. */
function mapDeliveryStatus(raw: unknown): SmsDeliveryStatus['status'] {
  switch (typeof raw === 'string' ? raw.trim().toUpperCase() : '') {
    case 'QUEUED':
    case 'PENDING':
    case 'SCHEDULED':
      return 'QUEUED';
    case 'SENT':
      return 'SENT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'FAILED':
    case 'REJECTED':
    case 'UNDELIVERED':
    case 'EXPIRED':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

/** `updated_at` SMS.to ("2022-02-01 07:19:04"), supposé UTC. */
function parseSmsToDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string') return undefined;
  const date = new Date(`${raw.trim().replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export type SmsToConfig = {
  apiKey: string;
  senderId: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
};

/**
 * Adaptateur SMS.to (https://api.sms.to/sms/send, auth Bearer).
 *
 * - La clé vient de `SMSTO_API_KEY` (SSM en prod) ; absente → l'API refuse de démarrer.
 * - Le corps du message et la clé ne sont jamais journalisés ni placés dans une erreur.
 * - SMS.to n'offre pas de clé d'idempotence : un retry après timeout peut produire
 *   un doublon ; le worker borne `attempts` pour limiter ce risque.
 * - Statut de remise par interrogation (`getDeliveryStatus`) ; callback non branché.
 */
export class SmsToSmsProvider implements SmsProvider {
  readonly name = 'smsto';

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: SmsToConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): SmsToSmsProvider {
    const apiKey = env.SMSTO_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'SMS_PROVIDER="smsto" exige SMSTO_API_KEY (clé API SMS.to ; SSM /atelier-maitre/prod/env en production).',
      );
    }
    const senderId = env.SMSTO_SENDER_ID?.trim() || 'AtelierMtr';
    if (!isValidAlphanumericSenderId(senderId)) {
      throw new Error(
        `SMSTO_SENDER_ID="${senderId}" invalide : 1 à 11 caractères alphanumériques, au moins une lettre.`,
      );
    }
    const apiUrl = (env.SMSTO_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
    return new SmsToSmsProvider({ apiKey, senderId, apiUrl, fetchImpl });
  }

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    const to = toE164(request.to);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', `Numéro invalide : ${maskPhone(request.to)}.`, this.name);
    }
    const senderId = request.senderId ?? this.config.senderId;
    if (!isValidAlphanumericSenderId(senderId)) {
      throw new PermanentMessagingError('SENDER_REJECTED', `Expéditeur invalide : "${senderId}".`, this.name);
    }

    const { status, body } = await this.request('POST', '/sms/send', {
      message: request.text,
      to,
      sender_id: senderId,
    });

    if (status >= 200 && status < 300 && body.success !== false) {
      const messageId = typeof body.message_id === 'string' ? body.message_id : undefined;
      if (messageId) {
        return { providerMessageId: messageId, status: 'QUEUED', operator: detectCameroonOperator(to) };
      }
      // Réponse 2xx sans identifiant : message probablement parti, mais intraçable.
      throw new TemporaryMessagingError('UNAVAILABLE', 'Réponse SMS.to sans message_id.', this.name);
    }
    throw this.toError(status, body);
  }

  /**
   * Statut par interrogation (`GET /message/{id}`). Statut absent ou non reconnu → `UNKNOWN`
   * (jamais supposé livré). Un message introuvable (404) ou une réponse illisible est aussi `UNKNOWN`.
   */
  async getDeliveryStatus(providerMessageId: string): Promise<SmsDeliveryStatus> {
    const { status, body } = await this.request('GET', `/message/${encodeURIComponent(providerMessageId)}`);
    if (status === 404) return { status: 'UNKNOWN' };
    if (status < 200 || status >= 300) throw this.toError(status, body);

    const mapped = mapDeliveryStatus(body.status);
    if (mapped === 'DELIVERED') {
      const deliveredAt = parseSmsToDate(body.updated_at);
      return deliveredAt ? { status: mapped, deliveredAt } : { status: mapped };
    }
    if (mapped === 'FAILED') {
      const reason = typeof body.failed_reason === 'string' ? body.failed_reason.trim() : '';
      return reason ? { status: mapped, errorCode: reason.slice(0, 80) } : { status: mapped };
    }
    return { status: mapped };
  }

  async validateSender(senderId: string): Promise<SenderValidation> {
    return isValidAlphanumericSenderId(senderId)
      ? { valid: true }
      : { valid: false, reason: '1 à 11 caractères alphanumériques, au moins une lettre.' };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${this.config.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });
      const parsed: unknown = await response.json().catch(() => ({}));
      const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      return { status: response.status, body };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new TemporaryMessagingError(
        aborted ? 'TIMEOUT' : 'UNAVAILABLE',
        aborted ? 'SMS.to : délai dépassé.' : 'SMS.to injoignable.',
        this.name,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Traduit un refus SMS.to ; n'expose jamais le corps brut (peut citer message ou clé). */
  private toError(status: number, body: Record<string, unknown>): Error {
    if (status === 429) return new TemporaryMessagingError('RATE_LIMITED', 'SMS.to : limite de débit.', this.name);
    if (status >= 500 || status === 408) {
      return new TemporaryMessagingError('UNAVAILABLE', `SMS.to indisponible (HTTP ${status}).`, this.name);
    }
    const detail = JSON.stringify(body).toLowerCase();
    let code: PermanentMessagingErrorCode;
    if (status === 401 || status === 403) code = 'PROVIDER_CONFIGURATION';
    else if (status === 402 || /balance|credit|fund/.test(detail)) code = 'INSUFFICIENT_CREDIT';
    else if (/sender/.test(detail)) code = 'SENDER_REJECTED';
    else if (/\bto\b|phone|number|recipient/.test(detail)) code = 'INVALID_RECIPIENT';
    else code = 'CONTENT_REJECTED';
    return new PermanentMessagingError(code, `SMS.to a refusé l'envoi (HTTP ${status}, ${code}).`, this.name);
  }
}
