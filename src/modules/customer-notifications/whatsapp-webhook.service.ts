import { InjectQueue } from '@nestjs/bullmq';
import type { CustomerNotificationStatus, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
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
  WHATSAPP_CLOUD_PROVIDER,
  type MetaDeliveryStatus,
  type MetaOptOutEvent,
  type MetaStatusEvent,
  type ParsedMetaWebhook,
  type WhatsAppWebhookConfig,
} from '../messaging';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  APPLY_EVENT_JOB,
  WHATSAPP_WEBHOOK_EVENTS_QUEUE,
  applyEventJobOptions,
  type ApplyEventJobData,
} from './whatsapp-webhook.queue';

export type WebhookReceipt = { received: number; optOuts: number; ignored: number };

const META_STATUS: Record<MetaDeliveryStatus, CustomerNotificationStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/**
 * Lignes de la boîte de réception. Clé de déduplication = compte + `wamid` + statut :
 * Meta renvoie le même accusé tant qu'il n'a pas eu de 200, une seule ligne est gardée.
 */
export function toEventRows(statuses: MetaStatusEvent[]): Prisma.WhatsAppWebhookEventCreateManyInput[] {
  const rows = new Map<string, Prisma.WhatsAppWebhookEventCreateManyInput>();
  for (const event of statuses) {
    const dedupKey = `status:${event.phoneNumberId}:${event.messageId}:${event.status}`;
    if (rows.has(dedupKey)) continue;
    rows.set(dedupKey, {
      kind: 'STATUS',
      provider: WHATSAPP_CLOUD_PROVIDER,
      phoneNumberId: event.phoneNumberId,
      providerMessageId: event.messageId,
      status: META_STATUS[event.status],
      occurredAt: event.occurredAt,
      errorCode: event.errorCode === null ? null : String(event.errorCode),
      dedupKey,
    });
  }
  return [...rows.values()];
}

/** « STOP » entrants. Clé = compte + `wamid` ; le numéro est effacé dès le traitement. */
export function toOptOutRows(optOuts: MetaOptOutEvent[]): Prisma.WhatsAppWebhookEventCreateManyInput[] {
  const rows = new Map<string, Prisma.WhatsAppWebhookEventCreateManyInput>();
  for (const event of optOuts) {
    const dedupKey = `inbound:${event.phoneNumberId}:${event.messageId}`;
    if (rows.has(dedupKey)) continue;
    rows.set(dedupKey, {
      kind: 'INBOUND',
      provider: WHATSAPP_CLOUD_PROVIDER,
      phoneNumberId: event.phoneNumberId,
      providerMessageId: event.messageId,
      occurredAt: event.occurredAt,
      senderE164: event.fromE164,
      dedupKey,
    });
  }
  return [...rows.values()];
}

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

  constructor(
    @Inject(WHATSAPP_WEBHOOK_CONFIG) private readonly config: WhatsAppWebhookConfig,
    private readonly prisma: PrismaService,
    @InjectQueue(WHATSAPP_WEBHOOK_EVENTS_QUEUE) private readonly queue: Queue<ApplyEventJobData>,
  ) {}

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

  /**
   * Authentifie, lit puis persiste les accusés AVANT de répondre : si l'écriture échoue,
   * Meta reçoit une erreur et renvoie la notification. La mise en file suit, sans bloquer.
   */
  async receive(rawBody: Buffer | undefined, signature: unknown): Promise<WebhookReceipt> {
    const parsed = this.authenticate(rawBody, signature);
    const rows = [...toEventRows(parsed.statuses), ...toOptOutRows(parsed.optOuts)];
    if (rows.length > 0) {
      await this.prisma.whatsAppWebhookEvent.createMany({ data: rows, skipDuplicates: true });
      const pending = await this.prisma.whatsAppWebhookEvent.findMany({
        where: { dedupKey: { in: rows.map((row) => row.dedupKey) }, processedAt: null },
        select: { id: true },
      });
      await Promise.all(pending.map(({ id }) => this.enqueue(id)));
    }
    this.logger.log(
      `Webhook WhatsApp : ${parsed.statuses.length} statut(s), ${parsed.optOuts.length} « STOP », ${parsed.ignored} élément(s) ignoré(s).`,
    );
    return { received: parsed.statuses.length, optOuts: parsed.optOuts.length, ignored: parsed.ignored };
  }

  /** Redis absent : l'événement est déjà en base, le balayeur l'appliquera. */
  private async enqueue(eventId: string): Promise<void> {
    try {
      await this.queue.add(APPLY_EVENT_JOB, { eventId }, applyEventJobOptions(eventId));
    } catch (error) {
      this.logger.warn(
        `Accusé WhatsApp ${eventId} non mis en file (reprise par le balayeur) : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
