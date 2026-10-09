import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { CustomerNotificationStatus } from '@prisma/client';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { classifyMessagingFailure, maskPhone } from '../messaging';
import { hasFeature } from '../subscription/entitlements';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  MissingNotificationVariableError,
  NOTIFICATION_CATALOG,
  orderedTemplateVariables,
  templateLanguages,
  templateName,
  type NotificationVariable,
} from './customer-notification-catalog';
import {
  CUSTOMER_NOTIFICATIONS_CONFIG,
  approvedTemplateKey,
  type CustomerNotificationsConfig,
} from './customer-notifications.config';
import { CUSTOMER_NOTIFICATIONS_QUEUE, type DispatchJobData } from './customer-notifications.queue';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationStalenessService } from './notification-staleness.service';
import { resolveDispatch, type DispatchDecision } from './resolve-dispatch';
import { WhatsAppSenderResolver } from './whatsapp-sender.resolver';

/** Au-delà, une prise en charge sans issue est considérée comme interrompue (voir balayeur). */
export const DISPATCH_LEASE_MS = 10 * 60_000;

/** Statuts comptés dans le plafond mensuel : messages réellement remis à Meta. */
export const BILLABLE_STATUSES: CustomerNotificationStatus[] = ['ACCEPTED', 'SENT', 'DELIVERED', 'READ'];

/** Début du mois civil à Douala (UTC+1, sans heure d'été). */
export function monthStartInDouala(now: Date): Date {
  const local = new Date(now.getTime() + 60 * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 60 * 60_000);
}

export type DispatchOutcome =
  | { outcome: 'NOT_FOUND' | 'ALREADY_HANDLED' | 'IN_PROGRESS' }
  | { outcome: 'SKIPPED'; reason: string }
  | { outcome: 'SIMULATED' | 'ACCEPTED' };

/**
 * Worker de la file `customer-notifications`.
 *
 * Garanties (ne pas régresser) :
 * - prise en charge atomique d'une ligne PENDING : deux workers n'envoient jamais la même notification ;
 * - la décision vient de `resolveDispatch` (pure) ; toute règle non remplie → SKIPPED(raison) ;
 * - fournisseur simulé → SIMULATED, jamais ACCEPTED ; un HTTP 200 Meta → ACCEPTED, jamais « livré » ;
 * - refus définitif → FAILED sans relance ; panne temporaire → relance bornée, FAILED à la dernière ;
 * - aucun numéro en clair dans les journaux.
 */
@Processor(CUSTOMER_NOTIFICATIONS_QUEUE)
export class CustomerNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomerNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly preferences: NotificationPreferencesService,
    private readonly staleness: NotificationStalenessService,
    private readonly senders: WhatsAppSenderResolver,
    @Inject(CUSTOMER_NOTIFICATIONS_CONFIG) private readonly config: CustomerNotificationsConfig,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData, unknown, string>): Promise<DispatchOutcome> {
    const { notificationId } = job.data;
    const now = new Date();

    const claimed = await this.prisma.customerNotification.updateMany({
      where: { id: notificationId, status: 'PENDING', dispatchStartedAt: null },
      data: { dispatchStartedAt: now, attemptCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const row = await this.prisma.customerNotification.findUnique({
        where: { id: notificationId },
        select: { status: true },
      });
      if (!row) return { outcome: 'NOT_FOUND' };
      return { outcome: row.status === 'PENDING' ? 'IN_PROGRESS' : 'ALREADY_HANDLED' };
    }

    try {
      return await this.dispatch(notificationId, now);
    } catch (error) {
      return this.handleFailure(job, error);
    }
  }

  private async dispatch(notificationId: string, now: Date): Promise<DispatchOutcome> {
    const row = await this.prisma.customerNotification.findUniqueOrThrow({
      where: { id: notificationId },
      include: {
        garage: { select: { tenantId: true } },
        customer: { select: { lang: true } },
      },
    });
    const name = templateName(row.eventType);
    const languages = templateLanguages(row.customer?.lang);
    const decision = await this.decide(row, name, languages, now);

    if (decision.action === 'SKIP') {
      await this.prisma.customerNotification.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', skipReason: decision.reason, lang: languages[0] },
      });
      this.logger.log(`Notification ${row.id} (${row.eventType}) non envoyée : ${decision.reason}`);
      return { outcome: 'SKIPPED', reason: decision.reason };
    }

    const variables = orderedTemplateVariables(
      row.eventType,
      (row.variables ?? {}) as Partial<Record<NotificationVariable, string>>,
    );
    const sender = await this.senders.resolve(row.garageId);
    const base = {
      channel: 'WHATSAPP' as const,
      recipientE164: decision.to,
      lang: languages[0],
      templateName: decision.templateName,
      templateLanguage: decision.language,
      templateVersion: NOTIFICATION_CATALOG[row.eventType].templateVersion,
      provider: sender.provider.name,
      senderAccountRef: sender.accountRef,
    };
    // Écrit avant l'appel : si le process meurt pendant l'envoi, l'issue reste traçable.
    await this.prisma.customerNotification.update({ where: { id: row.id }, data: base });

    const result = await sender.provider.sendTemplate({
      to: decision.to,
      templateName: decision.templateName,
      language: decision.language,
      variables,
      idempotencyKey: `customer-notification:${row.id}`,
    });

    const simulated = sender.provider.simulated;
    await this.prisma.customerNotification.update({
      where: { id: row.id },
      data: simulated
        ? { status: 'SIMULATED', lastErrorCode: null, lastErrorMessage: null }
        : {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            providerMessageId: result.providerMessageId,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
    });
    this.logger.log(
      `Notification ${row.id} (${row.eventType}) ${simulated ? 'simulée' : 'acceptée'} pour ${maskPhone(decision.to)}`,
    );
    return { outcome: simulated ? 'SIMULATED' : 'ACCEPTED' };
  }

  private async decide(
    row: {
      id: string;
      garageId: string;
      customerId: string | null;
      eventType: Parameters<typeof templateName>[0];
      idempotencyKey: string;
      appointmentId: string | null;
      serviceOrderId: string | null;
      quoteId: string | null;
      invoiceId: string | null;
      paymentId: string | null;
      garage: { tenantId: string };
    },
    name: string,
    languages: string[],
    now: Date,
  ): Promise<DispatchDecision> {
    const { config } = this;
    if (config.mode === 'off') return { action: 'SKIP', reason: 'MODE_OFF' };

    const [eventEnabled, summary, stale, consent, sentThisMonth] = await Promise.all([
      this.preferences.isEnabled(row.garageId, row.eventType),
      this.subscriptions.getSummary(row.garage.tenantId),
      this.staleness.isStale(row, now),
      row.customerId
        ? this.prisma.customerChannelConsent.findFirst({
            where: { customerId: row.customerId, garageId: row.garageId, channel: 'WHATSAPP', status: 'GRANTED' },
            select: { phoneE164: true },
          })
        : Promise.resolve(null),
      this.prisma.customerNotification.count({
        where: {
          garageId: row.garageId,
          status: { in: BILLABLE_STATUSES },
          createdAt: { gte: monthStartInDouala(now) },
        },
      }),
    ]);

    return resolveDispatch({
      mode: config.mode,
      eventEnabled,
      entitled: hasFeature(summary, 'whatsapp'),
      stale,
      consentPhone: consent?.phoneE164 ?? null,
      templateName: name,
      languages,
      isTemplateApproved: (template, language) => config.approvedTemplates.has(approvedTemplateKey(template, language)),
      testRecipients: config.testRecipients,
      sentThisMonth,
      monthlyCap: config.monthlyCap,
    });
  }

  private async handleFailure(job: Job<DispatchJobData, unknown, string>, error: unknown): Promise<never> {
    const { notificationId } = job.data;

    if (error instanceof MissingNotificationVariableError) {
      await this.markFailed(notificationId, 'MISSING_VARIABLE', error.message);
      throw new UnrecoverableError(error.message);
    }

    const failure = classifyMessagingFailure(error, job);
    if (failure.kind === 'permanent') {
      this.logger.warn(`Échec définitif notification ${notificationId} via ${failure.provider} : ${failure.code}`);
      await this.markFailed(notificationId, failure.code, failure.message);
      throw new UnrecoverableError(`Notification non envoyée (${failure.code})`);
    }

    const { attempt, maxAttempts, code } = failure;
    const summary = `Échec temporaire notification ${notificationId} (${code}), tentative ${attempt}/${maxAttempts}`;
    if (failure.typed) this.logger.error(summary);
    else this.logger.error(summary, error instanceof Error ? error.stack : String(error));

    if (failure.exhausted) {
      await this.markFailed(notificationId, code, `Fournisseur indisponible après ${attempt} tentative(s).`);
    } else {
      // Libère la prise en charge pour la relance BullMQ.
      await this.prisma.customerNotification.update({
        where: { id: notificationId },
        data: { dispatchStartedAt: null, lastErrorCode: code },
      }).catch((updateError: unknown) => {
        this.logger.error(`Impossible de libérer la notification ${notificationId}`, updateError);
      });
    }
    throw error;
  }

  private async markFailed(notificationId: string, code: string, message: string): Promise<void> {
    await this.prisma.customerNotification.update({
      where: { id: notificationId },
      data: { status: 'FAILED', failedAt: new Date(), lastErrorCode: code, lastErrorMessage: message.slice(0, 500) },
    }).catch((error: unknown) => {
      this.logger.error(`Impossible de marquer la notification ${notificationId} en échec`, error);
    });
  }
}
