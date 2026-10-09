import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerNotificationEmitter, type EmitResult } from './customer-notification.emitter';
import { notificationKeys } from './notification-keys';
import {
  NOTIFICATION_TIME_ZONE,
  formatNotificationAmount,
  formatNotificationDate,
  formatNotificationTime,
} from './notification-format';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Le rappel part dans les 24 h qui précèdent le RDV… */
export const APPOINTMENT_REMINDER_LEAD_MS = 24 * HOUR_MS;
/** … mais pas moins de 2 h avant (trop tard pour être utile). */
export const APPOINTMENT_REMINDER_MIN_LEAD_MS = 2 * HOUR_MS;
/** RDV pris moins de 24 h à l'avance : la confirmation vient de partir, pas de rappel. */
export const APPOINTMENT_REMINDER_MIN_BOOKING_MS = 24 * HOUR_MS;
/** Plage d'envoi des rappels de RDV, heure de Douala : [7 h, 21 h[. */
export const REMINDER_SEND_HOURS = { from: 7, to: 21 } as const;

/** Politique par défaut des relances : J+7 et J+15 après l'échéance. */
export const DEFAULT_INVOICE_REMINDER_DAYS: readonly number[] = [7, 15];
/** Une étape manquée (API arrêtée) est rattrapée pendant 7 jours, pas au-delà. */
export const INVOICE_REMINDER_CATCH_UP_DAYS = 7;
export const MAX_INVOICE_REMINDER_DAY = 90;
const MAX_INVOICE_REMINDER_STEPS = 3;

const ACTIVE_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const;
const UNPAID_INVOICE_STATUSES = ['ISSUED', 'PARTIAL'] as const;

type ReminderRun = { scanned: number; queued: number; existing: number; skipped: number };

const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: NOTIFICATION_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: NOTIFICATION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Heure (0-23) à Douala. */
export function doualaHour(now: Date): number {
  return Number(hourFormat.format(now));
}

/** Jours écoulés depuis l'échéance (`@db.Date`, minuit UTC), calendrier de Douala. */
export function daysOverdue(dueDate: Date, now: Date): number {
  const today = Date.parse(`${dayFormat.format(now)}T00:00:00Z`);
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return Math.round((today - due) / DAY_MS);
}

/**
 * Politique du garage (`garage_notification_settings.params.reminderDaysAfterDue`) :
 * 1 à 3 jours distincts dans [1, 90], sinon défaut J+7 / J+15.
 */
export function parseInvoiceReminderDays(params: Prisma.JsonValue | null | undefined): readonly number[] | null {
  if (params === null || params === undefined) return DEFAULT_INVOICE_REMINDER_DAYS;
  if (typeof params !== 'object' || Array.isArray(params)) return null;
  const days = (params as Prisma.JsonObject).reminderDaysAfterDue;
  if (days === undefined) return DEFAULT_INVOICE_REMINDER_DAYS;
  if (!Array.isArray(days) || days.length === 0 || days.length > MAX_INVOICE_REMINDER_STEPS) return null;
  const valid = days.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= MAX_INVOICE_REMINDER_DAY);
  if (!valid || new Set(days).size !== days.length) return null;
  return [...(days as number[])].sort((a, b) => a - b);
}

/**
 * Étape de relance due (1-based) : la dernière étape atteinte, si elle date de moins
 * de `INVOICE_REMINDER_CATCH_UP_DAYS` jours. Après un arrêt, seule la plus récente part.
 */
export function dueReminderStep(reminderDays: readonly number[], overdue: number): number | null {
  for (let i = reminderDays.length - 1; i >= 0; i -= 1) {
    if (overdue >= reminderDays[i]) {
      return overdue < reminderDays[i] + INVOICE_REMINDER_CATCH_UP_DAYS ? i + 1 : null;
    }
  }
  return null;
}

/**
 * Rappels de RDV et relances de facture (fuseau Africa/Douala).
 *
 * Scan idempotent de la base, jamais de job différé : la clé d'idempotence
 * (`appointment.reminder:{id}:{horaire}`, `invoice.reminder:{id}:s{étape}`) empêche
 * tout doublon, un passage manqué est rattrapé au suivant, et la péremption est
 * revérifiée par le processor juste avant l'envoi (RDV annulé, facture soldée).
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: CustomerNotificationEmitter,
  ) {}

  @Cron('0 * * * *', { name: 'customer-appointment-reminders', timeZone: NOTIFICATION_TIME_ZONE })
  async sendAppointmentReminders(now: Date = new Date()): Promise<ReminderRun | null> {
    const hour = doualaHour(now);
    if (hour < REMINDER_SEND_HOURS.from || hour >= REMINDER_SEND_HOURS.to) return null;

    const appointments = await this.prisma.appointment.findMany({
      where: {
        garageId: { not: null },
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        scheduledAt: {
          gt: new Date(now.getTime() + APPOINTMENT_REMINDER_MIN_LEAD_MS),
          lte: new Date(now.getTime() + APPOINTMENT_REMINDER_LEAD_MS),
        },
      },
      select: { id: true, garageId: true, customerId: true, scheduledAt: true, createdAt: true },
      orderBy: { scheduledAt: 'asc' },
    });

    const run: ReminderRun = { scanned: appointments.length, queued: 0, existing: 0, skipped: 0 };
    for (const appointment of appointments) {
      if (appointment.scheduledAt.getTime() - appointment.createdAt.getTime() < APPOINTMENT_REMINDER_MIN_BOOKING_MS) {
        run.skipped += 1;
        continue;
      }
      this.count(
        run,
        await this.emitter.emitSafely({
          garageId: appointment.garageId,
          eventType: 'APPOINTMENT_REMINDER',
          idempotencyKey: notificationKeys.appointmentReminder(appointment.id, appointment.scheduledAt),
          customerId: appointment.customerId,
          refs: { appointmentId: appointment.id },
          variables: {
            date: formatNotificationDate(appointment.scheduledAt),
            time: formatNotificationTime(appointment.scheduledAt),
          },
        }),
      );
    }
    this.report('Rappels de RDV', run);
    return run;
  }

  @Cron('0 8 * * *', { name: 'customer-invoice-reminders', timeZone: NOTIFICATION_TIME_ZONE })
  async sendInvoiceReminders(now: Date = new Date()): Promise<ReminderRun> {
    const oldestDue = new Date(now.getTime() - (MAX_INVOICE_REMINDER_DAY + INVOICE_REMINDER_CATCH_UP_DAYS + 1) * DAY_MS);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        garageId: { not: null },
        status: { in: [...UNPAID_INVOICE_STATUSES] },
        balanceXaf: { gt: 0 },
        dueDate: { gte: oldestDue, lt: now },
      },
      select: { id: true, garageId: true, customerId: true, serviceOrderId: true, reference: true, balanceXaf: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
    });

    const policyOf = this.invoicePolicyResolver();
    const run: ReminderRun = { scanned: invoices.length, queued: 0, existing: 0, skipped: 0 };
    for (const invoice of invoices) {
      const step = invoice.dueDate ? dueReminderStep(await policyOf(invoice.garageId!), daysOverdue(invoice.dueDate, now)) : null;
      if (!step) {
        run.skipped += 1;
        continue;
      }
      this.count(
        run,
        await this.emitter.emitSafely({
          garageId: invoice.garageId,
          eventType: 'INVOICE_PAYMENT_REMINDER',
          idempotencyKey: notificationKeys.invoiceReminder(invoice.id, step),
          customerId: invoice.customerId,
          refs: { invoiceId: invoice.id, serviceOrderId: invoice.serviceOrderId ?? undefined },
          variables: { invoiceNumber: invoice.reference, amount: formatNotificationAmount(invoice.balanceXaf) },
        }),
      );
    }
    this.report('Relances de facture', run);
    return run;
  }

  /** Politique de relance lue une fois par garage et par passage ; invalide = défaut, journalisé. */
  private invoicePolicyResolver(): (garageId: string) => Promise<readonly number[]> {
    const cache = new Map<string, readonly number[]>();
    return async (garageId) => {
      const cached = cache.get(garageId);
      if (cached) return cached;
      const setting = await this.prisma.garageNotificationSetting.findUnique({
        where: { garageId_eventType: { garageId, eventType: 'INVOICE_PAYMENT_REMINDER' } },
        select: { params: true },
      });
      let days = parseInvoiceReminderDays(setting?.params);
      if (!days) {
        this.logger.warn(`Politique de relance invalide pour le garage ${garageId} : défaut J+7 / J+15 appliqué.`);
        days = DEFAULT_INVOICE_REMINDER_DAYS;
      }
      cache.set(garageId, days);
      return days;
    };
  }

  private count(run: ReminderRun, result: EmitResult | null): void {
    if (result?.outcome === 'QUEUED') run.queued += 1;
    else if (result?.outcome === 'ALREADY_EXISTS') run.existing += 1;
    else run.skipped += 1;
  }

  private report(label: string, run: ReminderRun): void {
    if (run.queued > 0) {
      this.logger.log(`${label} : ${run.queued} émis, ${run.existing} déjà émis, ${run.skipped} ignorés sur ${run.scanned}.`);
    }
  }
}
