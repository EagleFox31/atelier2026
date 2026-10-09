import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook WhatsApp Cloud API (Meta) — partie propre au fournisseur, sans Nest ni base.
 *
 * - Vérification d'abonnement (GET) : `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.
 * - Notifications (POST) : signées `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 du corps
 *   brut avec le secret de l'application Meta (pas le jeton d'accès).
 * - Le parseur ne garde que ce dont le moteur a besoin (identifiants, statut, horodatage,
 *   code d'erreur) : aucun contenu de conversation, aucun numéro de client.
 */

/** Nom du fournisseur Cloud API : `CustomerNotification.provider` des lignes envoyées par Meta. */
export const WHATSAPP_CLOUD_PROVIDER = 'whatsapp-cloud';

export type WhatsAppWebhookConfig =
  | { enabled: false }
  | { enabled: true; verifyToken: string; appSecret: string };

/** Corps accepté au plus (une notification Meta pèse quelques Ko). */
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
/** Bornes de structure : au-delà, la charge est refusée (413) sans être lue. */
export const MAX_WEBHOOK_ENTRIES = 100;
export const MAX_WEBHOOK_STATUSES = 1_000;

const MIN_SECRET_LENGTH = 16;

export class WhatsAppWebhookConfigurationError extends Error {
  constructor(message: string) {
    super(`${message} Corriger la variable (SSM /atelier-maitre/prod/env en production).`);
    this.name = 'WhatsAppWebhookConfigurationError';
  }
}

/**
 * Les deux secrets ensemble, ou aucun (webhook désactivé : 404). Un seul = configuration
 * incohérente : l'API refuse de démarrer plutôt que d'accepter des appels non vérifiables.
 */
export function loadWhatsAppWebhookConfig(
  env: Record<string, string | undefined> = process.env,
): WhatsAppWebhookConfig {
  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? '';
  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? '';
  if (!verifyToken && !appSecret) return { enabled: false };
  if (!verifyToken || !appSecret) {
    throw new WhatsAppWebhookConfigurationError(
      'Webhook WhatsApp : WHATSAPP_WEBHOOK_VERIFY_TOKEN et WHATSAPP_APP_SECRET vont ensemble (les deux ou aucun).',
    );
  }
  if (verifyToken.length < MIN_SECRET_LENGTH || appSecret.length < MIN_SECRET_LENGTH) {
    throw new WhatsAppWebhookConfigurationError(
      `Webhook WhatsApp : secrets trop courts (${MIN_SECRET_LENGTH} caractères au moins).`,
    );
  }
  return { enabled: true, verifyToken, appSecret };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // Longueurs différentes : comparaison factice de même durée, puis refus.
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Le challenge est renvoyé tel quel : on n'accepte qu'un jeton court et inoffensif. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type SubscriptionVerification =
  | { ok: true; challenge: string }
  | { ok: false; reason: 'MODE' | 'TOKEN' | 'CHALLENGE' };

export function verifySubscription(
  query: { mode?: unknown; token?: unknown; challenge?: unknown },
  verifyToken: string,
): SubscriptionVerification {
  if (query.mode !== 'subscribe') return { ok: false, reason: 'MODE' };
  if (typeof query.token !== 'string' || !safeEqual(query.token, verifyToken)) return { ok: false, reason: 'TOKEN' };
  if (typeof query.challenge !== 'string' || !CHALLENGE_PATTERN.test(query.challenge)) {
    return { ok: false, reason: 'CHALLENGE' };
  }
  return { ok: true, challenge: query.challenge };
}

export type SignatureCheck = { ok: true } | { ok: false; reason: 'MISSING' | 'MALFORMED' | 'MISMATCH' };

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

export function verifyMetaSignature(rawBody: Buffer, header: unknown, appSecret: string): SignatureCheck {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string' || !value.trim()) return { ok: false, reason: 'MISSING' };
  const match = SIGNATURE_PATTERN.exec(value.trim());
  if (!match) return { ok: false, reason: 'MALFORMED' };
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1], 'hex');
  return timingSafeEqual(expected, received) ? { ok: true } : { ok: false, reason: 'MISMATCH' };
}

/** Signature telle que Meta la calcule (tests, recette locale). */
export function signMetaPayload(rawBody: Buffer, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

export type MetaDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
const DELIVERY_STATUSES: readonly MetaDeliveryStatus[] = ['sent', 'delivered', 'read', 'failed'];

/** Accusé de remise d'un message sortant. */
export type MetaStatusEvent = {
  /** Numéro WhatsApp Business émetteur (`metadata.phone_number_id`) : le compte authentifié. */
  phoneNumberId: string;
  /** `wamid.…` renvoyé par Meta à l'envoi. */
  messageId: string;
  status: MetaDeliveryStatus;
  occurredAt: Date;
  /** Code d'erreur Meta (statut `failed`), sans titre ni détail. */
  errorCode: number | null;
};

export type ParsedMetaWebhook = {
  statuses: MetaStatusEvent[];
  /** Éléments présents mais non pris en charge (autre champ, statut inconnu, élément invalide). */
  ignored: number;
};

export class MetaWebhookPayloadError extends Error {
  constructor(
    readonly code: 'INVALID_JSON' | 'INVALID_STRUCTURE' | 'TOO_LARGE',
    message: string,
  ) {
    super(message);
    this.name = 'MetaWebhookPayloadError';
  }
}

const PHONE_NUMBER_ID_PATTERN = /^\d{1,32}$/;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._=+/:-]{1,256}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new MetaWebhookPayloadError('INVALID_STRUCTURE', `${field} doit être un tableau.`);
  return value;
}

function parseTimestamp(value: unknown): Date | null {
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string' || !TIMESTAMP_PATTERN.test(raw)) return null;
  return new Date(Number(raw) * 1000);
}

function parseErrorCode(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : undefined;
  return isRecord(first) && Number.isInteger(first.code) ? (first.code as number) : null;
}

function parseStatus(raw: unknown, phoneNumberId: string): MetaStatusEvent | null {
  if (!isRecord(raw)) return null;
  const { id, status, timestamp, errors } = raw;
  if (typeof id !== 'string' || !MESSAGE_ID_PATTERN.test(id)) return null;
  if (!DELIVERY_STATUSES.includes(status as MetaDeliveryStatus)) return null;
  const occurredAt = parseTimestamp(timestamp);
  if (!occurredAt) return null;
  return {
    phoneNumberId,
    messageId: id,
    status: status as MetaDeliveryStatus,
    occurredAt,
    errorCode: status === 'failed' ? parseErrorCode(errors) : null,
  };
}

/**
 * Lit une notification déjà authentifiée. Structure inattendue au niveau racine → erreur
 * (400) ; élément inconnu ou invalide plus bas → ignoré et compté (Meta ajoute des champs).
 */
export function parseMetaWebhook(rawBody: Buffer): ParsedMetaWebhook {
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    throw new MetaWebhookPayloadError('TOO_LARGE', `Corps de ${rawBody.length} octets refusé.`);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new MetaWebhookPayloadError('INVALID_JSON', 'Corps JSON illisible.');
  }
  if (!isRecord(body) || body.object !== 'whatsapp_business_account') {
    throw new MetaWebhookPayloadError('INVALID_STRUCTURE', 'object="whatsapp_business_account" attendu.');
  }
  const entries = asArray(body.entry, 'entry');
  if (entries.length > MAX_WEBHOOK_ENTRIES) {
    throw new MetaWebhookPayloadError('TOO_LARGE', `${entries.length} entrées refusées.`);
  }

  const statuses: MetaStatusEvent[] = [];
  let ignored = 0;
  let seen = 0;
  for (const entry of entries) {
    if (!isRecord(entry)) { ignored += 1; continue; }
    for (const change of asArray(entry.changes, 'entry.changes')) {
      if (!isRecord(change) || change.field !== 'messages' || !isRecord(change.value)) { ignored += 1; continue; }
      const value = change.value;
      const metadata = isRecord(value.metadata) ? value.metadata : {};
      const phoneNumberId = metadata.phone_number_id;
      const rawStatuses = asArray(value.statuses, 'statuses');
      const rawMessages = asArray(value.messages, 'messages');
      seen += rawStatuses.length + rawMessages.length;
      if (seen > MAX_WEBHOOK_STATUSES) {
        throw new MetaWebhookPayloadError('TOO_LARGE', `Plus de ${MAX_WEBHOOK_STATUSES} éléments refusés.`);
      }
      // Messages entrants : pas encore traités ici (aucun contenu conservé).
      ignored += rawMessages.length;
      if (typeof phoneNumberId !== 'string' || !PHONE_NUMBER_ID_PATTERN.test(phoneNumberId)) {
        ignored += rawStatuses.length;
        continue;
      }
      for (const raw of rawStatuses) {
        const parsed = parseStatus(raw, phoneNumberId);
        if (parsed) statuses.push(parsed);
        else ignored += 1;
      }
    }
  }
  return { statuses, ignored };
}
