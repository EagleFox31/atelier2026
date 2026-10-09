import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CustomerNotificationEvent, CustomerNotificationStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import {
  WHATSAPP_CLOUD_PROVIDER,
  WHATSAPP_PROVIDER,
  WHATSAPP_WEBHOOK_CONFIG,
  type WhatsAppProvider,
  type WhatsAppWebhookConfig,
} from '../messaging';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEFAULT_TEMPLATE_LANGUAGE, NOTIFICATION_CATALOG, templateName } from './customer-notification-catalog';
import { BILLABLE_STATUSES, monthStartInDouala } from './customer-notification.processor';
import {
  CUSTOMER_NOTIFICATIONS_CONFIG,
  approvedTemplateKey,
  type CustomerNotificationsConfig,
  type CustomerNotificationsMode,
} from './customer-notifications.config';
import { CUSTOMER_NOTIFICATIONS_QUEUE, type DispatchJobData } from './customer-notifications.queue';
import { CORRELATION_WINDOW_MS } from './whatsapp-status.service';

/** Fenêtre d'observation des issues récentes. */
export const HEALTH_WINDOW_HOURS = 24;
/** Un PENDING plus vieux que ça a échappé au balayeur (1 min) : la file ne tourne plus. */
export const OUTBOX_BACKLOG_MS = 5 * 60_000;
/** Part du plafond mensuel à partir de laquelle un garage est signalé. */
export const QUOTA_WARNING_RATIO = 0.8;
export const QUEUE_PROBE_TIMEOUT_MS = 2_000;
/** Accusé Meta encore non appliqué au-delà de la fenêtre de corrélation + 5 min : le traitement est bloqué. */
export const WEBHOOK_STUCK_MS = CORRELATION_WINDOW_MS + 5 * 60_000;
const TOP_GARAGES = 10;

export type HealthLevel = 'ok' | 'warning' | 'critical';

export type HealthAlert = { level: Exclude<HealthLevel, 'ok'>; code: string; message: string };

export type CustomerNotificationsHealth = {
  generatedAt: string;
  status: HealthLevel;
  alerts: HealthAlert[];
  config: {
    mode: CustomerNotificationsMode;
    whatsappProvider: string;
    providerSimulated: boolean;
    monthlyCap: number;
    /** Nombre seulement : les numéros de test ne sortent jamais de l'API. */
    sandboxRecipientCount: number;
  };
  templates: {
    eventType: CustomerNotificationEvent;
    name: string;
    language: string;
    approved: boolean;
    defaultEnabled: boolean;
  }[];
  queue:
    | { available: true; waiting: number; active: number; delayed: number; failed: number }
    | { available: false };
  outbox: {
    windowHours: number;
    byStatus: Partial<Record<CustomerNotificationStatus, number>>;
    skippedByReason: { reason: string; count: number }[];
    failedByCode: { code: string; count: number }[];
    backlog: number;
    oldestPendingAt: string | null;
  };
  /** Accusés Meta (lot 3). Compteurs seulement : ni numéro, ni contenu de message. */
  webhook: {
    configured: boolean;
    receiptTimeoutMinutes: number;
    /** Messages acceptés par Meta sans accusé depuis plus du délai : signalés, jamais renvoyés. */
    acceptedWithoutReceipt: number;
    pendingEvents: number;
    stuckEvents: number;
    unmatchedEvents: number;
    optOuts: number;
    lastEventAt: string | null;
  };
  quota: {
    monthStart: string;
    cap: number;
    garages: { garageId: string; garageName: string; used: number; ratio: number }[];
  };
};

/**
 * Santé des notifications client, pour la console SUPER_ADMIN. Lecture seule :
 * aucune écriture, aucune donnée client (ni numéro, ni variable, ni nom de client).
 * Redis injoignable = file signalée indisponible, jamais une erreur 500.
 */
@Injectable()
export class CustomerNotificationsHealthService {
  private readonly logger = new Logger(CustomerNotificationsHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CUSTOMER_NOTIFICATIONS_QUEUE) private readonly queue: Queue<DispatchJobData>,
    @Inject(CUSTOMER_NOTIFICATIONS_CONFIG) private readonly config: CustomerNotificationsConfig,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    @Inject(WHATSAPP_WEBHOOK_CONFIG) private readonly webhookConfig: WhatsAppWebhookConfig,
  ) {}

  async getHealth(now: Date = new Date()): Promise<CustomerNotificationsHealth> {
    const since = new Date(now.getTime() - HEALTH_WINDOW_HOURS * 3_600_000);
    const monthStart = monthStartInDouala(now);

    const [queue, byStatus, skipped, failed, backlog, oldestPending, usage] = await Promise.all([
      this.probeQueue(),
      this.prisma.customerNotification.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.customerNotification.groupBy({
        by: ['skipReason'],
        where: { status: 'SKIPPED', createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.customerNotification.groupBy({
        by: ['lastErrorCode'],
        where: { status: 'FAILED', createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.customerNotification.count({
        where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - OUTBOX_BACKLOG_MS) } },
      }),
      this.prisma.customerNotification.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.customerNotification.groupBy({
        by: ['garageId'],
        where: { status: { in: BILLABLE_STATUSES }, createdAt: { gte: monthStart } },
        _count: { _all: true },
        orderBy: { _count: { garageId: 'desc' } },
        take: TOP_GARAGES,
      }),
    ]);

    const webhook = await this.webhookHealth(now, since);
    const garageNames = await this.garageNames(usage.map((row) => row.garageId));
    const cap = this.config.monthlyCap;
    const garages = usage.map((row) => ({
      garageId: row.garageId,
      garageName: garageNames.get(row.garageId) ?? '—',
      used: row._count._all,
      ratio: cap > 0 ? row._count._all / cap : 1,
    }));

    const templates = (Object.keys(NOTIFICATION_CATALOG) as CustomerNotificationEvent[]).map((eventType) => {
      const name = templateName(eventType);
      return {
        eventType,
        name,
        language: DEFAULT_TEMPLATE_LANGUAGE,
        approved: this.config.approvedTemplates.has(approvedTemplateKey(name, DEFAULT_TEMPLATE_LANGUAGE)),
        defaultEnabled: NOTIFICATION_CATALOG[eventType].defaultEnabled,
      };
    });

    const outbox = {
      windowHours: HEALTH_WINDOW_HOURS,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      skippedByReason: sortByCount(skipped.map((row) => ({ reason: row.skipReason ?? 'UNKNOWN', count: row._count._all }))),
      failedByCode: sortByCount(failed.map((row) => ({ code: row.lastErrorCode ?? 'UNKNOWN', count: row._count._all }))),
      backlog,
      oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
    };

    const alerts = this.alerts({ queue, templates, outbox, garages, webhook });
    return {
      generatedAt: now.toISOString(),
      status: alerts.some((a) => a.level === 'critical') ? 'critical' : alerts.length > 0 ? 'warning' : 'ok',
      alerts,
      config: {
        mode: this.config.mode,
        whatsappProvider: this.whatsapp.name,
        providerSimulated: this.whatsapp.simulated,
        monthlyCap: cap,
        sandboxRecipientCount: this.config.testRecipients.size,
      },
      templates,
      queue,
      outbox,
      webhook,
      quota: { monthStart: monthStart.toISOString(), cap, garages },
    };
  }

  private alerts(input: {
    queue: CustomerNotificationsHealth['queue'];
    templates: CustomerNotificationsHealth['templates'];
    outbox: CustomerNotificationsHealth['outbox'];
    garages: CustomerNotificationsHealth['quota']['garages'];
    webhook: CustomerNotificationsHealth['webhook'];
  }): HealthAlert[] {
    const { mode } = this.config;
    const alerts: HealthAlert[] = [];
    if (!input.queue.available) {
      alerts.push({ level: 'critical', code: 'QUEUE_UNAVAILABLE', message: 'File Redis injoignable : les notifications restent en attente.' });
    }
    if (input.outbox.backlog > 0) {
      alerts.push({
        level: 'critical',
        code: 'OUTBOX_BACKLOG',
        message: `${input.outbox.backlog} notification(s) en attente depuis plus de ${OUTBOX_BACKLOG_MS / 60_000} min.`,
      });
    }
    if (input.webhook.stuckEvents > 0) {
      alerts.push({
        level: 'critical',
        code: 'WEBHOOK_EVENTS_STUCK',
        message: `${input.webhook.stuckEvents} accusé(s) Meta non traité(s) depuis plus de ${WEBHOOK_STUCK_MS / 60_000} min.`,
      });
    }
    if (input.webhook.acceptedWithoutReceipt > 0) {
      alerts.push({
        level: 'warning',
        code: 'ACCEPTED_WITHOUT_RECEIPT',
        message: `${input.webhook.acceptedWithoutReceipt} message(s) accepté(s) par Meta sans accusé depuis plus de ${input.webhook.receiptTimeoutMinutes} min (aucun renvoi automatique).`,
      });
    }
    if (mode === 'off') return alerts;

    if (this.whatsapp.name === WHATSAPP_CLOUD_PROVIDER && !input.webhook.configured) {
      alerts.push({
        level: 'warning',
        code: 'WEBHOOK_NOT_CONFIGURED',
        message: 'Webhook WhatsApp non configuré : aucun statut de remise ni « STOP » ne sera reçu.',
      });
    }

    if (mode === 'sandbox' && this.config.testRecipients.size === 0) {
      alerts.push({ level: 'warning', code: 'SANDBOX_NO_RECIPIENTS', message: 'Mode sandbox sans WHATSAPP_TEST_RECIPIENTS : tout envoi sera ignoré.' });
    }
    const missing = input.templates.filter((t) => t.defaultEnabled && !t.approved).map((t) => t.name);
    if (missing.length > 0) {
      alerts.push({ level: 'warning', code: 'TEMPLATES_NOT_APPROVED', message: `Modèles actifs par défaut non approuvés : ${missing.join(', ')}.` });
    }
    const failures = input.outbox.failedByCode.reduce((sum, row) => sum + row.count, 0);
    if (failures > 0) {
      alerts.push({ level: 'warning', code: 'RECENT_FAILURES', message: `${failures} échec(s) sur ${HEALTH_WINDOW_HOURS} h.` });
    }
    const nearCap = input.garages.filter((g) => g.ratio >= QUOTA_WARNING_RATIO);
    if (nearCap.length > 0) {
      alerts.push({
        level: 'warning',
        code: 'QUOTA_NEAR_LIMIT',
        message: `${nearCap.length} garage(s) à ${Math.round(QUOTA_WARNING_RATIO * 100)} % ou plus du plafond mensuel.`,
      });
    }
    return alerts;
  }

  private async webhookHealth(now: Date, since: Date): Promise<CustomerNotificationsHealth['webhook']> {
    const { receiptTimeoutMinutes } = this.config;
    const events = this.prisma.whatsAppWebhookEvent;
    const [acceptedWithoutReceipt, pendingEvents, stuckEvents, unmatchedEvents, optOuts, last] = await Promise.all([
      this.prisma.customerNotification.count({
        where: {
          status: 'ACCEPTED',
          provider: WHATSAPP_CLOUD_PROVIDER,
          acceptedAt: { lt: new Date(now.getTime() - receiptTimeoutMinutes * 60_000) },
        },
      }),
      events.count({ where: { processedAt: null } }),
      events.count({ where: { processedAt: null, receivedAt: { lt: new Date(now.getTime() - WEBHOOK_STUCK_MS) } } }),
      events.count({ where: { outcome: 'UNMATCHED', receivedAt: { gte: since } } }),
      events.count({ where: { kind: 'INBOUND', outcome: 'APPLIED', receivedAt: { gte: since } } }),
      events.findFirst({ orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }),
    ]);
    return {
      configured: this.webhookConfig.enabled,
      receiptTimeoutMinutes,
      acceptedWithoutReceipt,
      pendingEvents,
      stuckEvents,
      unmatchedEvents,
      optOuts,
      lastEventAt: last?.receivedAt.toISOString() ?? null,
    };
  }

  private async probeQueue(): Promise<CustomerNotificationsHealth['queue']> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const counts = await Promise.race([
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`délai de ${QUEUE_PROBE_TIMEOUT_MS} ms dépassé`)), QUEUE_PROBE_TIMEOUT_MS);
        }),
      ]);
      return {
        available: true,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      };
    } catch (error) {
      this.logger.warn(`File ${CUSTOMER_NOTIFICATIONS_QUEUE} injoignable : ${(error as Error).message}`);
      return { available: false };
    } finally {
      clearTimeout(timer);
    }
  }

  private async garageNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const garages = await this.prisma.garage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(garages.map((g) => [g.id, g.name]));
  }
}

function sortByCount<T extends { count: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count);
}
