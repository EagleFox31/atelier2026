
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../shared/prisma/prisma.service';

/**
 * Tâches planifiées internes à l'atelier. Les rappels de RDV et relances de facture
 * destinés aux clients vivent dans ReminderSchedulerService (notifications client).
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private prisma: PrismaService) {}

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
