import {
  PermanentMessagingError,
  TemporaryMessagingError,
  type PermanentMessagingErrorCode,
} from '../messaging.errors';
import { detectCameroonOperator, maskPhone, toE164 } from '../shared/phone';
import type {
  SendSmsRequest,
  SendSmsResult,
  SenderValidation,
  SmsDeliveryStatus,
  SmsProvider,
} from './sms-provider.interface';

const DEFAULT_API_URL = 'https://api.unimtx.com';
const REQUEST_TIMEOUT_MS = 10_000;

/** `signature` Unimtx : 2 à 16 caractères (lettres, chiffres, espace, tiret, `_`). */
const UNIMTX_SENDER_RE = /^[A-Za-z0-9 _-]{2,16}$/;

/** Codes « réseau » traités comme temporaires (voir docs/api/error-codes). */
const TEMPORARY_UNIMTX_CODES = new Set(['101000', '101303', '105100', '105300']);

/** Signature / Sender ID refusés ou absents (10712x, 10714x). */
const SENDER_REJECTED_UNIMTX_CODES = new Set([
  '107120',
  '107121',
  '107122',
  '107123',
  '107143',
  '107144',
  '107145',
]);

/** Mapping d'un code Unimtx définitif → famille d'erreur interne. */
function mapPermanentUnimtxCode(code: string): PermanentMessagingErrorCode {
  if (code === '105400') return 'INSUFFICIENT_CREDIT';
  if (code === '107111') return 'INVALID_RECIPIENT';
  if (SENDER_REJECTED_UNIMTX_CODES.has(code)) return 'SENDER_REJECTED';
  if (code.startsWith('104') || code === '105001') return 'PROVIDER_CONFIGURATION';
  if (code.startsWith('107')) return 'CONTENT_REJECTED';
  return 'CONTENT_REJECTED';
}

function mapDeliveryStatus(raw: unknown): SmsDeliveryStatus['status'] {
  switch (typeof raw === 'string' ? raw.trim().toLowerCase() : '') {
    case 'queued':
    case 'pending':
    case 'accepted':
      return 'QUEUED';
    case 'sent':
    case 'sending':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'failed':
    case 'rejected':
    case 'undelivered':
    case 'expired':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

/** ISO 8601 (UTC) retourné par Unimtx. */
function parseUnimtxDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string') return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export type UnimtxConfig = {
  accessKeyId: string;
  senderId: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
};

/**
 * Adaptateur Unimatrix (https://api.unimtx.com, action-based).
 *
 * - `UNIMTX_ACCESS_KEY_ID` dans l'env (SSM en prod) ; absent → l'API refuse de démarrer.
 * - Mode d'authentification « Simple » : `accessKeyId` passé en query (HMAC optionnel).
 * - Aucun secret ni corps de message dans les logs ou les erreurs.
 * - Pas d'idempotence côté fournisseur : un retry après timeout peut doubler l'envoi
 *   (le worker borne `attempts`).
 * - Statut de remise : via DLR webhook (préféré) ; `getDeliveryStatus` interroge
 *   `sms.message.get` en secours et retourne `UNKNOWN` plutôt que de supposer livré.
 */
export class UnimtxSmsProvider implements SmsProvider {
  readonly name = 'unimtx';
  readonly simulated = false;

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: UnimtxConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): UnimtxSmsProvider {
    const accessKeyId = env.UNIMTX_ACCESS_KEY_ID?.trim();
    if (!accessKeyId) {
      throw new Error(
        'SMS_PROVIDER="unimtx" exige UNIMTX_ACCESS_KEY_ID (clé Unimatrix ; SSM /atelier-maitre/prod/env en production).',
      );
    }
    const senderId = env.UNIMTX_SENDER_ID?.trim() || 'AtelierM';
    if (!UNIMTX_SENDER_RE.test(senderId)) {
      throw new Error(
        `UNIMTX_SENDER_ID="${senderId}" invalide : 2 à 16 caractères (lettres, chiffres, espace, "-", "_").`,
      );
    }
    const apiUrl = (env.UNIMTX_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
    return new UnimtxSmsProvider({ accessKeyId, senderId, apiUrl, fetchImpl });
  }

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    const to = toE164(request.to);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', `Numéro invalide : ${maskPhone(request.to)}.`, this.name);
    }
    const senderId = request.senderId ?? this.config.senderId;
    if (!UNIMTX_SENDER_RE.test(senderId)) {
      throw new PermanentMessagingError('SENDER_REJECTED', `Expéditeur invalide : "${senderId}".`, this.name);
    }

    const { status, body } = await this.request('sms.message.send', {
      to,
      text: request.text,
      signature: senderId,
    });

    const code = extractCode(body);
    if (status >= 200 && status < 300 && code === '0') {
      const first = extractFirstMessage(body);
      const id = typeof first?.id === 'string' ? first.id : undefined;
      if (id) {
        return { providerMessageId: id, status: 'QUEUED', operator: detectCameroonOperator(to) };
      }
      throw new TemporaryMessagingError('UNAVAILABLE', 'Réponse Unimatrix sans message id.', this.name);
    }
    throw this.toError(status, code);
  }

  async getDeliveryStatus(providerMessageId: string): Promise<SmsDeliveryStatus> {
    const { status, body } = await this.request('sms.message.get', { id: providerMessageId });
    const code = extractCode(body);

    if (status === 404 || code === '107112' || code === '107141') return { status: 'UNKNOWN' };
    if (status < 200 || status >= 300 || code !== '0') throw this.toError(status, code);

    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const message = extractFirstMessage(body) ?? data;
    const mapped = mapDeliveryStatus(message.status ?? data.status);
    if (mapped === 'DELIVERED') {
      const deliveredAt = parseUnimtxDate(message.doneDate ?? data.doneDate);
      return deliveredAt ? { status: mapped, deliveredAt } : { status: mapped };
    }
    if (mapped === 'FAILED') {
      const raw = message.errorCode ?? data.errorCode;
      const reason = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
      return reason ? { status: mapped, errorCode: reason } : { status: mapped };
    }
    return { status: mapped };
  }

  async validateSender(senderId: string): Promise<SenderValidation> {
    return UNIMTX_SENDER_RE.test(senderId)
      ? { valid: true }
      : { valid: false, reason: '2 à 16 caractères (lettres, chiffres, espace, "-", "_").' };
  }

  private async request(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const url = `${this.config.apiUrl}/?action=${encodeURIComponent(action)}&accessKeyId=${encodeURIComponent(this.config.accessKeyId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const parsed: unknown = await response.json().catch(() => ({}));
      const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      return { status: response.status, body };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new TemporaryMessagingError(
        aborted ? 'TIMEOUT' : 'UNAVAILABLE',
        aborted ? 'Unimatrix : délai dépassé.' : 'Unimatrix injoignable.',
        this.name,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Traduit un refus Unimtx — pas de corps brut (peut citer la clé ou le message). */
  private toError(status: number, code: string | undefined): Error {
    if (status === 429 || (code && TEMPORARY_UNIMTX_CODES.has(code))) {
      return new TemporaryMessagingError('RATE_LIMITED', `Unimatrix : limite de débit (${code ?? status}).`, this.name);
    }
    if (status >= 500 || status === 408) {
      return new TemporaryMessagingError('UNAVAILABLE', `Unimatrix indisponible (HTTP ${status}).`, this.name);
    }
    if (!code) {
      return new PermanentMessagingError('CONTENT_REJECTED', `Unimatrix a refusé l'envoi (HTTP ${status}).`, this.name);
    }
    const mapped = mapPermanentUnimtxCode(code);
    return new PermanentMessagingError(mapped, `Unimatrix a refusé l'envoi (code ${code}, ${mapped}).`, this.name);
  }
}

function extractCode(body: Record<string, unknown>): string | undefined {
  const raw = body.code;
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number') return String(raw);
  return undefined;
}

function extractFirstMessage(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const data = body.data as Record<string, unknown> | undefined;
  const messages = data?.messages;
  if (Array.isArray(messages) && messages.length > 0 && typeof messages[0] === 'object' && messages[0] !== null) {
    return messages[0] as Record<string, unknown>;
  }
  return undefined;
}
