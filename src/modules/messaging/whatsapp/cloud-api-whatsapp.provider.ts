import {
  PermanentMessagingError,
  TemporaryMessagingError,
  type PermanentMessagingErrorCode,
} from '../messaging.errors';
import { maskPhone, toE164 } from '../shared/phone';
import type {
  SendWhatsAppMessageRequest,
  SendWhatsAppResult,
  SendWhatsAppTemplateRequest,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

const DEFAULT_API_URL = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v21.0';
const REQUEST_TIMEOUT_MS = 10_000;

export type WhatsAppCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiUrl: string;
  apiVersion: string;
  fetchImpl?: typeof fetch;
};

/**
 * Adaptateur WhatsApp Cloud API (Meta, `POST /{phone-number-id}/messages`, auth Bearer).
 *
 * - Secrets : `WHATSAPP_ACCESS_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` (SSM en prod) ;
 *   absents → l'API refuse de démarrer. Jamais journalisés ni placés dans une erreur.
 * - Hors fenêtre de conversation de 24 h, Meta refuse le texte libre (131047) :
 *   erreur définitive `CONTENT_REJECTED`, il faut un modèle approuvé (`sendTemplate`).
 * - Pas de clé d'idempotence côté Meta : un retry après timeout peut dupliquer.
 * - Statut renvoyé : `QUEUED` (les accusés sent/delivered/read arrivent par webhook, non branché).
 */
export class WhatsAppCloudApiProvider implements WhatsAppProvider {
  readonly name = 'whatsapp-cloud';
  readonly simulated = false;

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: WhatsAppCloudConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): WhatsAppCloudApiProvider {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'WHATSAPP_PROVIDER="whatsapp-cloud" exige WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID ' +
          '(Meta for Developers ; SSM /atelier-maitre/prod/env en production).',
      );
    }
    if (!/^\d+$/.test(phoneNumberId)) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID invalide : identifiant numérique attendu.');
    }
    return new WhatsAppCloudApiProvider({
      accessToken,
      phoneNumberId,
      apiUrl: (env.WHATSAPP_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, ''),
      apiVersion: env.WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION,
      fetchImpl,
    });
  }

  sendWhatsAppMessage(request: SendWhatsAppMessageRequest): Promise<SendWhatsAppResult> {
    return this.send(request.to, { type: 'text', text: { body: request.text, preview_url: false } });
  }

  async sendTemplate(request: SendWhatsAppTemplateRequest): Promise<SendWhatsAppResult> {
    const components: Record<string, unknown>[] = request.variables.length
      ? [{ type: 'body', parameters: request.variables.map((text) => ({ type: 'text', text })) }]
      : [];
    for (const button of request.buttons ?? []) {
      if (!Number.isInteger(button.index) || button.index < 0 || button.index > 9 || !button.urlSuffix.trim()) {
        throw new PermanentMessagingError(
          'CONTENT_REJECTED',
          `Bouton URL de modèle invalide (index ${button.index}).`,
          this.name,
        );
      }
      components.push({
        type: 'button',
        sub_type: 'url',
        index: String(button.index),
        parameters: [{ type: 'text', text: button.urlSuffix }],
      });
    }
    return this.send(request.to, {
      type: 'template',
      template: { name: request.templateName, language: { code: request.language }, components },
    });
  }

  private async send(rawTo: string, content: Record<string, unknown>): Promise<SendWhatsAppResult> {
    const to = toE164(rawTo);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', `Numéro invalide : ${maskPhone(rawTo)}.`, this.name);
    }
    const { status, body } = await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      ...content,
    });

    if (status >= 200 && status < 300) {
      const messages = Array.isArray(body.messages) ? (body.messages as Array<{ id?: unknown }>) : [];
      const id = messages[0]?.id;
      if (typeof id === 'string' && id) return { providerMessageId: id, status: 'QUEUED' };
      throw new TemporaryMessagingError('UNAVAILABLE', 'Réponse WhatsApp sans identifiant de message.', this.name);
    }
    throw this.toError(status, body);
  }

  private async post(payload: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(
        `${this.config.apiUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      const parsed: unknown = await response.json().catch(() => ({}));
      const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      return { status: response.status, body };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new TemporaryMessagingError(
        aborted ? 'TIMEOUT' : 'UNAVAILABLE',
        aborted ? 'WhatsApp : délai dépassé.' : 'WhatsApp injoignable.',
        this.name,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Traduit un refus Meta par son code d'erreur ; n'expose jamais le corps brut. */
  private toError(status: number, body: Record<string, unknown>): Error {
    const error = body.error && typeof body.error === 'object' ? (body.error as Record<string, unknown>) : {};
    const metaCode = typeof error.code === 'number' ? error.code : undefined;

    if (status === 429 || metaCode === 4 || metaCode === 80007 || metaCode === 130429 || metaCode === 131056) {
      return new TemporaryMessagingError('RATE_LIMITED', 'WhatsApp : limite de débit.', this.name);
    }
    if (status >= 500 || status === 408 || metaCode === 1 || metaCode === 2 || metaCode === 131000) {
      return new TemporaryMessagingError('UNAVAILABLE', `WhatsApp indisponible (HTTP ${status}).`, this.name);
    }

    let code: PermanentMessagingErrorCode;
    if (status === 401 || status === 403 || metaCode === 190 || metaCode === 10 || metaCode === 200) {
      code = 'PROVIDER_CONFIGURATION';
    } else if (metaCode === 131026 || metaCode === 131021 || metaCode === 131030) code = 'INVALID_RECIPIENT';
    else if (metaCode === 131042) code = 'INSUFFICIENT_CREDIT'; // problème de paiement du compte WhatsApp Business
    else code = 'CONTENT_REJECTED'; // dont 131047 (hors fenêtre 24 h) et 132000-132015 (modèle)
    return new PermanentMessagingError(
      code,
      `WhatsApp a refusé l'envoi (HTTP ${status}${metaCode ? `, code ${metaCode}` : ''}, ${code}).`,
      this.name,
    );
  }
}
