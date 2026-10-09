import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  MetaWebhookPayloadError,
  WHATSAPP_WEBHOOK_CONFIG,
  parseMetaWebhook,
  verifyMetaSignature,
  verifySubscription,
  type ParsedMetaWebhook,
  type WhatsAppWebhookConfig,
} from '../messaging';

export type WebhookReceipt = { received: number; ignored: number };

/**
 * Webhook WhatsApp Meta : authentifie puis lit chaque appel.
 *
 * Garanties (ne pas régresser) :
 * - route publique mais jamais anonyme : challenge (GET) ou signature HMAC (POST) d'abord,
 *   rien n'est lu ni écrit avant ;
 * - secrets désactivés = 404 (le webhook n'existe pas), jamais « tout accepter » ;
 * - journaux : raison du refus et compteurs seulement, jamais le corps, un secret ou un numéro.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(@Inject(WHATSAPP_WEBHOOK_CONFIG) private readonly config: WhatsAppWebhookConfig) {}

  /** Vérification d'abonnement Meta : renvoie le challenge à l'identique, ou 403. */
  verify(query: { mode?: unknown; token?: unknown; challenge?: unknown }): string {
    const config = this.requireEnabled();
    const result = verifySubscription(query, config.verifyToken);
    if (!result.ok) {
      this.logger.warn(`Vérification du webhook WhatsApp refusée (${result.reason}).`);
      throw new ForbiddenException({
        message: 'Vérification du webhook refusée.',
        errorCode: 'WHATSAPP_WEBHOOK_VERIFICATION_FAILED',
      });
    }
    this.logger.log('Webhook WhatsApp vérifié par Meta.');
    return result.challenge;
  }

  /** Authentifie et lit une notification Meta ; renvoie ce qui a été retenu. */
  async receive(rawBody: Buffer | undefined, signature: unknown): Promise<WebhookReceipt> {
    const parsed = this.authenticate(rawBody, signature);
    this.logger.log(`Webhook WhatsApp : ${parsed.statuses.length} statut(s) reçu(s), ${parsed.ignored} élément(s) ignoré(s).`);
    return { received: parsed.statuses.length, ignored: parsed.ignored };
  }

  private authenticate(rawBody: Buffer | undefined, signature: unknown): ParsedMetaWebhook {
    const config = this.requireEnabled();
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException({
        message: 'Corps brut du webhook indisponible (Content-Type application/json attendu).',
        errorCode: 'INVALID_WHATSAPP_WEBHOOK',
      });
    }
    const check = verifyMetaSignature(rawBody, signature, config.appSecret);
    if (!check.ok) {
      this.logger.warn(`Webhook WhatsApp refusé : signature ${check.reason} (${rawBody.length} o).`);
      throw new UnauthorizedException({
        message: 'Signature du webhook invalide.',
        errorCode: 'INVALID_WHATSAPP_SIGNATURE',
      });
    }
    try {
      return parseMetaWebhook(rawBody);
    } catch (error) {
      if (!(error instanceof MetaWebhookPayloadError)) throw error;
      this.logger.warn(`Webhook WhatsApp signé mais refusé : ${error.code}.`);
      const body = { message: 'Charge du webhook refusée.', errorCode: 'INVALID_WHATSAPP_WEBHOOK' };
      throw error.code === 'TOO_LARGE' ? new PayloadTooLargeException(body) : new BadRequestException(body);
    }
  }

  private requireEnabled(): Extract<WhatsAppWebhookConfig, { enabled: true }> {
    if (!this.config.enabled) {
      throw new NotFoundException({
        message: 'Webhook WhatsApp non configuré.',
        errorCode: 'WHATSAPP_WEBHOOK_DISABLED',
      });
    }
    return this.config;
  }
}
