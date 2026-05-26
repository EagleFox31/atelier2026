
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../shared/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('sms-notifications') private smsQueue: Queue,
  ) {}

  /**
   * Relances factures impayées J+7 et J+15 (Point 10)
   * Execution chaque jour à 8h WAT (UTC+1)
   */
  @Cron('0 7 * * *') // 7h UTC correspond à 8h WAT
  async handleUnpaidInvoices() {
    this.logger.log('Début du scan des factures impayées pour relances...');
    
    // Factures J+7
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const overdueJ7 = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lte: sevenDaysAgo },
        reminder1SentAt: null,
      },
      include: { customer: true }
    });

    for (const inv of overdueJ7) {
      if (inv.customer?.phonePrimary) {
        await this.smsQueue.add('reminder_j7', {
          phone: inv.customer.phonePrimary,
          message: `Bonjour ${inv.customer.lastName}, la facture ${inv.reference} est en attente depuis 7 jours. Merci de régulariser.`,
          customerId: inv.customerId,
          lang: inv.customer.lang,
        });
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { reminder1SentAt: new Date() }
        });
      }
    }
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
        reminder1SentAt: { not: null }, // J+7 déjà envoyée
        reminder2SentAt: null,
      },
      include: { customer: true },
    });

    for (const inv of overdueJ15) {
      if (inv.customer?.phonePrimary) {
        await this.smsQueue.add('reminder_j15', {
          phone: inv.customer.phonePrimary,
          message: `Bonjour ${inv.customer.lastName}, votre facture ${inv.reference} reste impayée depuis 15 jours. Contactez-nous au plus vite pour éviter des frais supplémentaires.`,
          customerId: inv.customerId,
          lang: inv.customer.lang,
        });
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { reminder2SentAt: new Date() },
        });
      }
    }
    this.logger.log(`Relances J+15 : ${overdueJ15.length} factures traitées`);
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

    for (const apt of appointments) {
      if (!apt.customer?.phonePrimary) continue;

      const heure  = apt.scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' });
      const nom    = [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ');
      const vehic  = [apt.vehicle?.make?.name, apt.vehicle?.model?.name].filter(Boolean).join(' ');

      await this.smsQueue.add('appointment_reminder', {
        phone: apt.customer.phonePrimary,
        message: `Rappel : Bonjour ${nom}, vous avez un rendez-vous demain à ${heure}${vehic ? ` pour votre ${vehic}` : ''}. À demain !`,
        customerId: apt.customer.id,
        lang: apt.customer.lang ?? 'fr',
      });
    }

    this.logger.log(`Rappels RDV J-1 : ${appointments.length} SMS envoyés`);
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
