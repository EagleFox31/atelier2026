import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ForbiddenException, Inject, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import {
  SMS_PROVIDER,
  classifyMessagingFailure,
  detectCameroonOperator,
  maskPhone,
  toE164,
  type SendSmsResult,
  type SmsProvider,
} from '../modules/messaging';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import { PrismaService } from '../shared/prisma/prisma.service';

export type SmsJobData = {
  tenantId?: string;
  garageId?: string;
  phone: string;
  message: string;
  customerId?: string;
  lang?: string;
  notificationId?: string;
  serviceOrderId?: string;
};

/**
 * Worker de la file `sms-notifications`.
 *
 * Garanties (ne pas régresser) :
 * - tenant introuvable → échec définitif, rien n'est envoyé ;
 * - droit `sms` absent (refus commercial) → échec définitif, notification FAILED ;
 *   droit illisible (panne DB) → erreur relancée pour que BullMQ réessaie ;
 * - numéro inexploitable ou refus définitif du fournisseur → `UnrecoverableError` ;
 * - panne temporaire du fournisseur → erreur relancée (retry BullMQ borné par
 *   `attempts`), notification FAILED à la dernière tentative ;
 * - fournisseur simulé (`simulated`) → statut `SIMULATED`, jamais `SENT` ;
 * - le fournisseur est injecté (`SMS_PROVIDER`), jamais importé directement.
 */
@Processor('sms-notifications')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {
    super();
  }

  async process(job: Job<SmsJobData, unknown, string>): Promise<unknown> {
    const {
      phone,
      message,
      customerId,
      lang = 'fr',
      notificationId,
      serviceOrderId,
      garageId,
    } = job.data;

    this.logger.log(`Traitement SMS ${job.name} pour ${maskPhone(phone)} (${lang})`);

    const tenantId = await this.resolveTenantId(job.data);
    if (!tenantId) {
      const reason = 'SMS non envoyé : contexte tenant introuvable.';
      await this.markNotificationFailed(notificationId, reason);
      throw new UnrecoverableError(reason);
    }

    try {
      await this.subscriptions.assertSmsEntitled(tenantId);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        const reason = 'SMS non envoyé : abonnement Pro ou Business actif requis.';
        await this.markNotificationFailed(notificationId, reason);
        throw new UnrecoverableError(reason);
      }
      throw error;
    }

    const to = toE164(phone);
    if (!to) {
      const reason = 'SMS non envoyé : numéro de téléphone invalide.';
      await this.markNotificationFailed(notificationId, reason);
      throw new UnrecoverableError(reason);
    }

    let result: SendSmsResult;
    try {
      result = await this.smsProvider.sendSms({
        to,
        text: message,
        idempotencyKey: SmsProcessor.idempotencyKey(job),
      });
    } catch (error) {
      return this.handleSendFailure(job, error);
    }

    const operator = result.operator ?? detectCameroonOperator(to);
    const simulated = this.smsProvider.simulated;
    const delivered = !simulated && result.status === 'DELIVERED';
    const sentData = {
      operator,
      gatewayRef: result.providerMessageId,
      status: simulated ? ('SIMULATED' as const) : delivered ? ('DELIVERED' as const) : ('SENT' as const),
      sentAt: new Date(),
      ...(delivered ? { deliveredAt: new Date() } : {}),
      templateCode: job.name,
    };

    if (notificationId) {
      await this.prisma.sMSNotification.update({
        where: { id: notificationId },
        data: {
          ...sentData,
          ...(serviceOrderId ? { serviceOrderId } : {}),
        },
      });
    } else {
      await this.prisma.sMSNotification.create({
        data: {
          ...(garageId ? { garageId } : {}),
          phoneTo: phone,
          messageBody: message,
          customerId,
          lang,
          ...(serviceOrderId ? { serviceOrderId } : {}),
          ...sentData,
        },
      });
    }

    return simulated ? { sent: false, simulated: true } : { sent: true };
  }

  /**
   * Clé d'idempotence stable entre deux essais du même envoi : l'id de la
   * notification si elle existe déjà, sinon l'id du job BullMQ (déterministe pour
   * les rappels planifiés, unique par mise en file sinon).
   */
  static idempotencyKey(job: Pick<Job<SmsJobData>, 'id' | 'queueName' | 'data'>): string {
    if (job.data.notificationId) return `sms-notification:${job.data.notificationId}`;
    if (job.id) return `sms-job:${job.queueName ?? 'sms-notifications'}:${job.id}`;
    throw new UnrecoverableError('SMS non envoyé : job sans identifiant (idempotence impossible).');
  }

  private async handleSendFailure(job: Job<SmsJobData, unknown, string>, error: unknown): Promise<never> {
    const { notificationId, phone } = job.data;

    const failure = classifyMessagingFailure(error, job);

    if (failure.kind === 'permanent') {
      const reason = `SMS non envoyé (${failure.code}) : ${failure.message}`;
      this.logger.warn(`Échec définitif SMS ${job.name} pour ${maskPhone(phone)} via ${failure.provider} : ${failure.code}`);
      await this.markNotificationFailed(notificationId, reason);
      throw new UnrecoverableError(reason);
    }

    // Temporaire (ou erreur non typée, traitée comme temporaire) : BullMQ réessaie.
    const { attempt, maxAttempts, code } = failure;
    const summary = `Échec temporaire SMS ${job.name} pour ${maskPhone(phone)} (${code}), tentative ${attempt}/${maxAttempts}`;
    if (failure.typed) this.logger.error(summary);
    else this.logger.error(summary, error instanceof Error ? error.stack : String(error));
    if (failure.exhausted) {
      await this.markNotificationFailed(
        notificationId,
        `SMS non envoyé (${code}) : fournisseur indisponible après ${attempt} tentative(s).`,
        { retryCount: attempt - 1 },
      );
    }
    throw error;
  }

  private async resolveTenantId(data: SmsJobData): Promise<string | null> {
    if (data.tenantId?.trim()) return data.tenantId;

    if (data.notificationId) {
      const row = await this.prisma.sMSNotification.findUnique({
        where: { id: data.notificationId },
        select: { garage: { select: { tenantId: true } } },
      });
      if (row?.garage?.tenantId) return row.garage.tenantId;
    }

    if (data.garageId) return this.resolveGarageTenantId(data.garageId);

    if (data.serviceOrderId) {
      const row = await this.prisma.serviceOrder.findUnique({
        where: { id: data.serviceOrderId },
        select: { garageId: true },
      });
      if (row?.garageId) return this.resolveGarageTenantId(row.garageId);
    }

    if (data.customerId) {
      const row = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { garageId: true },
      });
      if (row?.garageId) return this.resolveGarageTenantId(row.garageId);
    }

    return null;
  }

  private async resolveGarageTenantId(garageId: string): Promise<string | null> {
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: { tenantId: true },
    });
    return garage?.tenantId ?? null;
  }

  private async markNotificationFailed(
    notificationId: string | undefined,
    reason: string,
    extra: { retryCount?: number } = {},
  ): Promise<void> {
    if (!notificationId) return;
    await this.prisma.sMSNotification.update({
      where: { id: notificationId },
      data: { status: 'FAILED', errorMessage: reason, ...extra },
    }).catch((error: unknown) => {
      this.logger.error(`Impossible de marquer le SMS ${notificationId} en échec`, error);
    });
  }
}
