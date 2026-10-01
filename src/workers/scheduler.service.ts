
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../shared/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import { hasFeature } from '../modules/subscription/entitlements';
import type { SmsJobData } from './sms.processor';

/**
 * Relances SMS planifiées. Les drapeaux reminder1SentAt / reminder2SentAt sont
 * posés par SmsProcessor APRÈS un envoi réellement réussi, jamais à la mise en file :
 * une relance refusée ou en échec reste donc éligible au passage suivant.
 * Le jobId déduplique tant que le job existe (terminé : 7 j ; échoué : 20 h, pour
 * qu'un nouvel essai ait lieu le lendemain, par ex. après passage au forfait Pro).
 */
const SCHEDULED_SMS_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60 },
  removeOnFail: { age: 20 * 60 * 60 },
};

type SmsTarget = { tenantId: string; garageId: string };

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('sms-notifications') private smsQueue: Queue,
    private subscriptions: SubscriptionService,
  ) {}

  /**
   * Résout le tenant d'un garage et son droit SMS, une seule fois par passage.
   * Refus par défaut : garage inconnu, sans tenant ou abonnement illisible → null.
   */
  private smsTargetResolver(): (garageId: string | null | undefined) => Promise<SmsTarget | null> {
    const tenantByGarage = new Map<string, string | null>();
    const entitledByTenant = new Map<string, boolean>();

    return async (garageId) => {
      if (!garageId) return null;

      if (!tenantByGarage.has(garageId)) {
        const garage = await this.prisma.garage.findUnique({
          where: { id: garageId },
          select: { tenantId: true },
        });
        tenantByGarage.set(garageId, garage?.tenantId ?? null);
      }
      const tenantId = tenantByGarage.get(garageId);
      if (!tenantId) return null;

      if (!entitledByTenant.has(tenantId)) {
        try {
          const { status, plan } = await this.subscriptions.getSummary(tenantId);
          entitledByTenant.set(tenantId, hasFeature({ status, plan }, 'sms'));
        } catch (err) {
          this.logger.warn(`Abonnement illisible pour le tenant ${tenantId} : SMS ignorés ce passage (${(err as Error).message})`);
          entitledByTenant.set(tenantId, false);
        }
      }
      return entitledByTenant.get(tenantId) ? { tenantId, garageId } : null;
    };
  }

  private async enqueueInvoiceReminder(
    level: 1 | 2,
    invoices: Array<{
      id: string;
      garageId: string | null;
      reference: string;
      customerId: string;
      customer: {
        phonePrimary: string | null;
        firstName: string | null;
        lastName: string | null;
        companyName: string | null;
        lang: string | null;
      } | null;
    }>,
  ): Promise<{ queued: number; skipped: number }> {
    const resolveTarget = this.smsTargetResolver();
    let queued = 0;
    let skipped = 0;

    for (const inv of invoices) {
      const phone = inv.customer?.phonePrimary;
      const target = phone ? await resolveTarget(inv.garageId) : null;
      if (!phone || !target) {
        skipped++;
        continue;
      }

      // Jamais « Bonjour null » : nom, sinon société, sinon prénom, sinon salutation seule.
      const name = inv.customer!.lastName || inv.customer!.companyName || inv.customer!.firstName;
      const hello = name ? `Bonjour ${name}` : 'Bonjour';
      const data: SmsJobData = {
        ...target,
        phone,
        message: level === 1
          ? `${hello}, la facture ${inv.reference} est en attente depuis 7 jours. Merci de régulariser.`
          : `${hello}, votre facture ${inv.reference} reste impayée depuis 15 jours. Contactez-nous au plus vite pour éviter des frais supplémentaires.`,
        customerId: inv.customerId,
        lang: inv.customer!.lang ?? 'fr',
        invoiceId: inv.id,
        invoiceReminder: level,
      };
      await this.smsQueue.add(level === 1 ? 'reminder_j7' : 'reminder_j15', data, {
        ...SCHEDULED_SMS_OPTIONS,
        jobId: `invoice-reminder-j${level === 1 ? 7 : 15}_${inv.id}`,
      });
      queued++;
    }
    return { queued, skipped };
  }

  /**
   * Relances factures impayées J+7 et J+15 (Point 10)
   * Execution chaque jour à 8h WAT (UTC+1)
   */
  @Cron('0 7 * * *') // 7h UTC correspond à 8h WAT
  async handleUnpaidInvoices() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overdueJ7 = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lte: sevenDaysAgo },
        reminder1SentAt: null,
      },
      include: { customer: true },
    });

    const { queued, skipped } = await this.enqueueInvoiceReminder(1, overdueJ7);
    this.logger.log(`Relances J+7 : ${queued} SMS en file, ${skipped} ignorée(s) (sans téléphone ou sans droit SMS)`);
  }

  /**
   * Relances factures impayées J+15
   * Execution chaque jour à 8h WAT
   */
  @Cron('0 7 * * *')
  async handleUnpaidInvoicesJ15() {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const overdueJ15 = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lte: fifteenDaysAgo },
        reminder1SentAt: { not: null }, // J+7 réellement envoyée
        reminder2SentAt: null,
      },
      include: { customer: true },
    });

    const { queued, skipped } = await this.enqueueInvoiceReminder(2, overdueJ15);
    this.logger.log(`Relances J+15 : ${queued} SMS en file, ${skipped} ignorée(s) (sans téléphone ou sans droit SMS)`);
  }

  /**
   * Rappels SMS rendez-vous J-1
   * Execution chaque soir à 20h WAT (19h UTC)
   */
  @Cron('0 19 * * *')
  async sendAppointmentReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
    const endOfTomorrow   = new Date(tomorrow.setHours(23, 59, 59, 999));

    const appointments = await this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startOfTomorrow, lte: endOfTomorrow },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        customer: { select: { phonePrimary: true, firstName: true, lastName: true, lang: true, id: true } },
        vehicle:  { include: { make: true, model: true } },
      },
    });

    const resolveTarget = this.smsTargetResolver();
    let queued = 0;

    for (const apt of appointments) {
      if (!apt.customer?.phonePrimary) continue;
      const target = await resolveTarget(apt.garageId);
      if (!target) continue;

      const heure  = apt.scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' });
      const nom    = [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ');
      const vehic  = [apt.vehicle?.make?.name, apt.vehicle?.model?.name].filter(Boolean).join(' ');

      const data: SmsJobData = {
        ...target,
        phone: apt.customer.phonePrimary,
        message: `Rappel : Bonjour ${nom}, vous avez un rendez-vous demain à ${heure}${vehic ? ` pour votre ${vehic}` : ''}. À demain !`,
        customerId: apt.customer.id,
        lang: apt.customer.lang ?? 'fr',
      };
      await this.smsQueue.add('appointment_reminder', data, {
        ...SCHEDULED_SMS_OPTIONS,
        jobId: `appointment-reminder_${apt.id}`,
      });
      queued++;
    }

    this.logger.log(`Rappels RDV J-1 : ${queued} SMS en file sur ${appointments.length} rendez-vous`);
  }

  /**
   * Alertes Immobilisation (Point 10)
   * Scan toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkImmobilizations() {
    const now = new Date();
    
    // 24h alert
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const immob24h = await this.prisma.vehicleImmobilization.findMany({
      where: {
        resolvedAt: null,
        immobilizedAt: { lte: oneDayAgo },
        alertSent24h: false,
      }
    });
    
    for (const immob of immob24h) {
      this.logger.warn(`Véhicule ${immob.vehicleId} immobilisé depuis > 24h !`);
      await this.prisma.vehicleImmobilization.update({
        where: { id: immob.id },
        data: { alertSent24h: true }
      });
      // Ici on pourrait envoyer un SMS au Chef d'Atelier
    }
  }
}
