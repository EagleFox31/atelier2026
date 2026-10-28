import {
  PermanentMessagingError,
  TemporaryMessagingError,
} from '../messaging.errors';
import { toE164 } from '../shared/phone';
import { WHATSAPP_CLOUD_PROVIDER } from './meta-webhook';
import type {
  SendWhatsAppMessageRequest,
  SendWhatsAppResult,
  SendWhatsAppTemplateRequest,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

/**
 * Adapter to the server-only Trigenys Notify Meta Cloud API dispatcher.
 * Keep sender name "whatsapp-cloud": Atelier's signed Meta webhook and delivery
 * receipt reconciliation use that provider identity and the same phone_number_id.
 *
 * Consent, approved templates, per-garage quota, source outbox and retries
 * continue to be handled by Atelier Maître. Never perform a second send here.
 */
const NOTIFY_STAGING_ORIGIN = 'https://trigenys-notify-staging-api.lawrynnjennifer.workers.dev';
const DISPATCH_PATH = '/v1/dispatch/atelier/whatsapp';
const REQUEST_TIMEOUT_MS = 12_000;

const UTILITY_TEMPLATES = {
  am_appointment_confirmed_v1: { eventType: 'APPOINTMENT_CONFIRMED', count: 4, button: false },
  am_appointment_reminder_v1: { eventType: 'APPOINTMENT_REMINDER', count: 4, button: false },
  am_service_order_received_v1: { eventType: 'SERVICE_ORDER_RECEIVED', count: 4, button: false },
  am_quote_approval_v1: { eventType: 'QUOTE_APPROVAL_REQUESTED', count: 4, button: true },
  am_vehicle_ready_v1: { eventType: 'VEHICLE_READY', count: 3, button: false },
  am_invoice_available_v1: { eventType: 'INVOICE_AVAILABLE', count: 4, button: false },
  am_invoice_reminder_v1: { eventType: 'INVOICE_PAYMENT_REMINDER', count: 4, button: false },
  am_payment_confirmed_v1: { eventType: 'PAYMENT_CONFIRMED', count: 4, button: false },
} as const;

type TemplateName = keyof typeof UTILITY_TEMPLATES;

export type TrigenysNotifyWhatsAppConfig = {
  apiUrl: string;
  ingestKey: string;
  phoneNumberId: string;
  fetchImpl?: typeof fetch;
};

function validateOrigin(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('TRIGENYS_NOTIFY_API_URL invalide.');
  }
  // Pinned host: do not forward the server-only ingest secret to arbitrary URLs.
  // Add future production domains here only after reviewing their deployment.
  if (parsed.origin !== NOTIFY_STAGING_ORIGIN || parsed.href !== NOTIFY_STAGING_ORIGIN + '/') {
    throw new Error('TRIGENYS_NOTIFY_API_URL doit être l’origine officielle du Worker Notify staging.');
  }
  return parsed.origin;
}

function validVariable(value: string): boolean {
  return value.trim().length > 0 && value.length <= 250 &&
    !/[\r\n\t]/.test(value) && !/ {5}/.test(value);
}

export class TrigenysNotifyWhatsAppProvider implements WhatsAppProvider {
  readonly name = WHATSAPP_CLOUD_PROVIDER;
  readonly simulated = false;
  private readonly endpoint: string;
  private readonly http: typeof fetch;

  get accountRef(): string {
    return this.config.phoneNumberId;
  }

  constructor(private readonly config: TrigenysNotifyWhatsAppConfig) {
    this.endpoint = validateOrigin(config.apiUrl) + DISPATCH_PATH;
    if (config.ingestKey.trim().length < 32 ||
      !/^\d{1,32}$/.test(config.phoneNumberId)) {
      throw new Error('Trigenys Notify : clé d’ingestion ou phone_number_id invalide.');
    }
    this.http = config.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): TrigenysNotifyWhatsAppProvider {
    const apiUrl = env.TRIGENYS_NOTIFY_API_URL?.trim();
    const ingestKey = env.TRIGENYS_NOTIFY_INGEST_KEY?.trim();
    const phoneNumberId = env.TRIGENYS_NOTIFY_PHONE_NUMBER_ID?.trim();
    if (!apiUrl || !ingestKey || !phoneNumberId) {
      throw new Error(
        'WHATSAPP_PROVIDER=trigenys-notify exige TRIGENYS_NOTIFY_API_URL, ' +
        'TRIGENYS_NOTIFY_INGEST_KEY et TRIGENYS_NOTIFY_PHONE_NUMBER_ID (SSM en production).',
      );
    }
    return new TrigenysNotifyWhatsAppProvider({ apiUrl, ingestKey, phoneNumberId, fetchImpl });
  }

  /** Notify deliberately accepts ONLY allowlisted UTILITY templates, never free text. */
  sendWhatsAppMessage(_request: SendWhatsAppMessageRequest): Promise<SendWhatsAppResult> {
    return Promise.reject(new PermanentMessagingError(
      'CONTENT_REJECTED',
      'Trigenys Notify n’autorise que les modèles WhatsApp utilitaires approuvés.',
      this.name,
    ));
  }

  async sendTemplate(request: SendWhatsAppTemplateRequest): Promise<SendWhatsAppResult> {
    const to = toE164(request.to);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', 'Numéro destinataire invalide.', this.name);
    }
    const template: (typeof UTILITY_TEMPLATES)[TemplateName] | undefined =
      Object.prototype.hasOwnProperty.call(UTILITY_TEMPLATES, request.templateName)
        ? UTILITY_TEMPLATES[request.templateName as TemplateName]
        : undefined;
    if (!template || (request.language !== 'fr' && request.language !== 'en') ||
      request.variables.length !== template.count ||
      !request.variables.every(validVariable) ||
      !/^customer-notification:[a-zA-Z0-9._:-]{1,100}$/.test(request.idempotencyKey)) {
      throw new PermanentMessagingError(
        'CONTENT_REJECTED', 'Modèle ou identifiant de notification non autorisé.', this.name,
      );
    }

    const buttons = request.buttons ?? [];
    if (template.button) {
      if (buttons.length !== 1 || buttons[0].index !== 0 ||
        !/^[A-Za-z0-9_-]{16,256}$/.test(buttons[0].urlSuffix)) {
        throw new PermanentMessagingError('CONTENT_REJECTED', 'Bouton de devis invalide.', this.name);
      }
    } else if (buttons.length > 0) {
      throw new PermanentMessagingError('CONTENT_REJECTED', 'Bouton non prévu pour ce modèle.', this.name);
    }

    const payload = {
      eventId: request.idempotencyKey,
      eventType: template.eventType,
      to,
      templateName: request.templateName,
      language: request.language,
      variables: request.variables,
      ...(template.button ? { buttons } : {}),
    };

    let response: Response;
    let data: unknown;
    try {
      const http = this.http;
      response = await http(this.endpoint, {
        method: 'POST',
        headers: {
          'x-notify-auth': this.config.ingestKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();
      data = body.length <= 8192 ? JSON.parse(body) : null;
    } catch {
      // Request may already have reached Meta. Never auto-retry an ambiguous outcome.
      throw new PermanentMessagingError(
        'UNKNOWN_OUTCOME', 'Envoi WhatsApp incertain : réessai automatique interdit.', this.name,
      );
    }
    const result = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown> : {};

    if (response.status === 202 && result.accepted === true &&
      result.provider === WHATSAPP_CLOUD_PROVIDER && result.status === 'QUEUED' &&
      result.accountRef === this.accountRef &&
      typeof result.providerMessageId === 'string' &&
      /^wamid\.[A-Za-z0-9._=+\/-]{1,240}$/.test(result.providerMessageId)) {
      return { providerMessageId: result.providerMessageId, status: 'QUEUED' };
    }
    if (response.ok) {
      throw new PermanentMessagingError(
        'UNKNOWN_OUTCOME', 'Réponse Notify acceptée mais non corrélable : aucun réessai.', this.name,
      );
    }

    const code = typeof result.error === 'string' ? result.error : '';
    if (response.status === 401 || response.status === 403 ||
      ['INGEST_NOT_CONFIGURED', 'META_PROVIDER_NOT_CONFIGURED',
        'CHANNEL_DISABLED', 'TEMPLATE_NOT_APPROVED'].includes(code)) {
      throw new PermanentMessagingError(
        'PROVIDER_CONFIGURATION', 'Configuration du canal Notify à corriger.', this.name,
      );
    }
    if (code === 'RATE_LIMITED') {
      throw new TemporaryMessagingError('RATE_LIMITED', 'Limite d’envoi WhatsApp atteinte.', this.name);
    }
    if (code === 'PROVIDER_UNAVAILABLE') {
      // Meta 5xx may be post-acceptance: fail closed instead of duplicating.
      throw new PermanentMessagingError(
        'UNKNOWN_OUTCOME', 'Résultat Meta incertain : réessai automatique interdit.', this.name,
      );
    }
    if (code === 'UNKNOWN_OUTCOME' || response.status >= 500) {
      throw new PermanentMessagingError(
        'UNKNOWN_OUTCOME', 'Résultat d’envoi incertain : ne pas renvoyer automatiquement.', this.name,
      );
    }
    throw new PermanentMessagingError(
      'CONTENT_REJECTED', 'La requête de notification a été refusée.', this.name,
    );
  }
}
