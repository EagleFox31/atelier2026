import { Injectable, Logger } from '@nestjs/common';
import type { CustomerNotificationStatus, Prisma, WhatsAppWebhookEventOutcome } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { WhatsAppOptOutService } from './whatsapp-opt-out.service';
import { WhatsAppSenderResolver } from './whatsapp-sender.resolver';

/**
 * Délai pendant lequel un accusé sans notification correspondante est réessayé : Meta peut
 * notifier `sent` avant que le worker ait enregistré le `wamid` reçu en réponse à l'envoi.
 */
export const CORRELATION_WINDOW_MS = 15 * 60_000;

/** Progression d'un message accepté par Meta : un statut ne recule jamais. */
const PROGRESSION = ['ACCEPTED', 'SENT', 'DELIVERED', 'READ'] as const satisfies readonly CustomerNotificationStatus[];
type ProgressStatus = Exclude<(typeof PROGRESSION)[number], 'ACCEPTED'>;

const TIMESTAMP_FIELD = { SENT: 'sentAt', DELIVERED: 'deliveredAt', READ: 'readAt' } as const satisfies Record<
  ProgressStatus,
  keyof Prisma.CustomerNotificationUpdateManyMutationInput
>;

/** Un échec Meta n'est retenu que tant que la remise n'est pas confirmée. */
const FAILABLE: CustomerNotificationStatus[] = ['ACCEPTED', 'SENT'];

export const META_FAILURE_MESSAGE = 'Remise refusée par WhatsApp (voir le code Meta).';

/** L'accusé est arrivé avant l'enregistrement du `wamid` : à réessayer (relance BullMQ / balayeur). */
export class StatusNotYetCorrelatedError extends Error {
  constructor(eventId: string) {
    super(`Accusé WhatsApp ${eventId} pas encore rattaché à une notification`);
    this.name = 'StatusNotYetCorrelatedError';
  }
}

export type ApplyEventResult =
  | { outcome: 'NOT_FOUND' | 'ALREADY_PROCESSED' }
  | { outcome: WhatsAppWebhookEventOutcome; notificationId: string | null };

/**
 * Applique un événement Meta persisté (`whatsapp_webhook_events`) : accusé de remise sur sa
 * notification client, ou « STOP » entrant (délégué à `WhatsAppOptOutService`).
 *
 * Garanties (ne pas régresser) :
 * - rattachement par fournisseur + `wamid` + compte émetteur seulement : le garage vient de la
 *   notification trouvée, jamais de la charge Meta ni d'un numéro ;
 * - monotone : `read` puis `delivered` ne fait pas reculer, un `sent` tardif n'écrase pas READ,
 *   FAILED n'écrase pas une remise confirmée et n'est jamais écrasé ; aucun statut inventé ;
 * - idempotent et sûr en concurrence : écritures conditionnelles (`updateMany` + `where`), un
 *   même événement rejoué ne change rien ;
 * - lignes sans `wamid` (simulées, historiques) jamais touchées ;
 * - numéro d'un expéditeur « STOP » effacé dès que l'événement est traité ;
 * - journaux : identifiants internes et codes seulement.
 */
@Injectable()
export class WhatsAppStatusService {
  private readonly logger = new Logger(WhatsAppStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senders: WhatsAppSenderResolver,
    private readonly optOuts: WhatsAppOptOutService,
  ) {}

  async apply(eventId: string, now: Date = new Date()): Promise<ApplyEventResult> {
    const event = await this.prisma.whatsAppWebhookEvent.findUnique({ where: { id: eventId } });
    if (!event) return { outcome: 'NOT_FOUND' };
    if (event.processedAt) return { outcome: 'ALREADY_PROCESSED' };

    if (event.kind === 'INBOUND') {
      await this.prisma.whatsAppWebhookEvent.update({ where: { id: eventId }, data: { attempts: { increment: 1 } } });
      return this.finish(eventId, await this.optOuts.handle(event), null, now);
    }
    if (event.kind !== 'STATUS' || !event.status) {
      return this.finish(eventId, 'IGNORED', null, now);
    }
    await this.prisma.whatsAppWebhookEvent.update({ where: { id: eventId }, data: { attempts: { increment: 1 } } });

    const notification = await this.prisma.customerNotification.findFirst({
      where: {
        provider: event.provider,
        providerMessageId: event.providerMessageId,
        senderAccountRef: { in: this.senders.accountRefsFor(event.provider, event.phoneNumberId) },
      },
      select: { id: true },
    });
    if (!notification) {
      if (now.getTime() - event.receivedAt.getTime() < CORRELATION_WINDOW_MS) {
        throw new StatusNotYetCorrelatedError(eventId);
      }
      this.logger.warn(`Accusé WhatsApp ${eventId} (${event.status}) sans notification correspondante.`);
      return this.finish(eventId, 'UNMATCHED', null, now);
    }

    const changed = await this.applyStatus(notification.id, event.status, event.occurredAt, event.errorCode);
    return this.finish(eventId, changed ? 'APPLIED' : 'NO_CHANGE', notification.id, now);
  }

  private async applyStatus(
    notificationId: string,
    status: CustomerNotificationStatus,
    occurredAt: Date,
    errorCode: string | null,
  ): Promise<boolean> {
    const table = this.prisma.customerNotification;

    if (status === 'FAILED') {
      const failed = await table.updateMany({
        where: { id: notificationId, status: { in: FAILABLE } },
        data: {
          status: 'FAILED',
          failedAt: occurredAt,
          lastErrorCode: errorCode ? `META_${errorCode}` : 'META_FAILED',
          lastErrorMessage: META_FAILURE_MESSAGE,
        },
      });
      return failed.count > 0;
    }
    if (!(status in TIMESTAMP_FIELD)) return false;

    const target = status as ProgressStatus;
    const field = TIMESTAMP_FIELD[target];
    const stamped = await table.updateMany({
      // Une ligne FAILED reste figée : pas d'horodatage de remise contradictoire.
      where: { id: notificationId, status: { in: [...PROGRESSION] }, [field]: null },
      data: { [field]: occurredAt },
    });
    const advanced = await table.updateMany({
      where: { id: notificationId, status: { in: PROGRESSION.slice(0, PROGRESSION.indexOf(target)) } },
      data: { status: target },
    });
    return stamped.count + advanced.count > 0;
  }

  private async finish(
    eventId: string,
    outcome: WhatsAppWebhookEventOutcome,
    notificationId: string | null,
    now: Date,
  ): Promise<ApplyEventResult> {
    await this.prisma.whatsAppWebhookEvent.updateMany({
      where: { id: eventId, processedAt: null },
      data: { outcome, notificationId, processedAt: now, senderE164: null },
    });
    return { outcome, notificationId };
  }
}
