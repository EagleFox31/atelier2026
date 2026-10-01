import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const STOCK_ALERTS_QUEUE = 'stock-alerts';
export const LOW_STOCK_JOB = 'low-stock';

/**
 * Un job plus ancien est ignoré. Jusqu'en 2026-10, la file n'avait aucun worker :
 * l'arriéré accumulé ne doit pas déclencher une avalanche de notifications.
 */
export const LOW_STOCK_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const LOW_STOCK_RECIPIENT_ROLES = ['CHEF_ATELIER', 'ADMIN'];

export type LowStockJobData = { partId: string; garageId?: string | null };

export type LowStockJobResult =
  | { notified: number }
  | { skipped: 'stale' | 'part-missing' | 'restocked' | 'unknown-job' };

/**
 * Une alerte par pièce et par jour : BullMQ ignore un `add` dont le jobId existe
 * encore (les jobs terminés sont gardés 2 jours, voir StockService).
 * BullMQ interdit « : » dans un jobId personnalisé.
 */
export function lowStockJobId(partId: string, at: Date = new Date()): string {
  return `low-stock_${partId}_${at.toISOString().slice(0, 10)}`;
}

@Processor(STOCK_ALERTS_QUEUE)
export class StockAlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(StockAlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<LowStockJobData>): Promise<LowStockJobResult> {
    if (job.name !== LOW_STOCK_JOB) {
      this.logger.warn(`Job inconnu ignoré : ${job.name}`);
      return { skipped: 'unknown-job' };
    }

    if (Date.now() - job.timestamp > LOW_STOCK_JOB_MAX_AGE_MS) {
      return { skipped: 'stale' };
    }

    // Relecture : la pièce a pu être réapprovisionnée depuis la mise en file.
    const part = await this.prisma.partsCatalog.findUnique({
      where: { id: job.data.partId },
      select: { id: true, garageId: true, reference: true, nameFr: true, qtyInStock: true, minThreshold: true },
    });
    if (!part?.garageId) return { skipped: 'part-missing' };

    // Decimal Prisma : comparer avec lte(), jamais avec <= (comparaison de chaînes).
    if (!part.qtyInStock.lte(part.minThreshold)) return { skipped: 'restocked' };

    const recipientIds = await this.notifications.getUserIdsByRoles(LOW_STOCK_RECIPIENT_ROLES, part.garageId);
    await this.notifications.createInApp({
      recipientIds,
      title: 'Stock bas',
      body: `${part.reference} — ${part.nameFr} : ${part.qtyInStock.toString()} en stock (seuil ${part.minThreshold.toString()}).`,
      link: `/stock/${part.id}`,
    });

    return { notified: recipientIds.length };
  }
}
