import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StatusNotYetCorrelatedError, WhatsAppStatusService } from './whatsapp-status.service';

/** Laisse à la file le temps de traiter avant reprise. */
export const EVENT_SWEEP_GRACE_MS = 2 * 60_000;
export const EVENT_SWEEP_BATCH = 200;
/** Événements traités conservés pour diagnostic, puis purgés (aucune donnée client dedans). */
export const EVENT_RETENTION_MS = 30 * 24 * 60 * 60_000;

/**
 * Filet de sécurité de la boîte de réception (cron 1 min), idempotent :
 * - événement non traité (Redis absent, relances épuisées) → appliqué directement, sans
 *   passer par la file (le `jobId` déterministe y est déjà pris) ;
 * - événement traité depuis plus de 30 j → purgé.
 */
@Injectable()
export class WhatsAppWebhookSweeper {
  private readonly logger = new Logger(WhatsAppWebhookSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: WhatsAppStatusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(now: Date = new Date()): Promise<{ processed: number; waiting: number; failed: number; purged: number }> {
    const pending = await this.prisma.whatsAppWebhookEvent.findMany({
      where: { processedAt: null, receivedAt: { lt: new Date(now.getTime() - EVENT_SWEEP_GRACE_MS) } },
      select: { id: true },
      orderBy: { receivedAt: 'asc' },
      take: EVENT_SWEEP_BATCH,
    });

    let processed = 0;
    let waiting = 0;
    let failed = 0;
    for (const { id } of pending) {
      try {
        await this.statuses.apply(id, now);
        processed += 1;
      } catch (error) {
        if (error instanceof StatusNotYetCorrelatedError) {
          waiting += 1;
        } else {
          failed += 1;
          this.logger.error(`Accusé WhatsApp ${id} non appliqué`, error instanceof Error ? error.stack : String(error));
        }
      }
    }

    const purged = await this.prisma.whatsAppWebhookEvent.deleteMany({
      where: { processedAt: { lt: new Date(now.getTime() - EVENT_RETENTION_MS) } },
    });

    if (processed > 0 || failed > 0 || purged.count > 0) {
      this.logger.warn(
        `Balayage webhook WhatsApp : ${processed} accusé(s) repris, ${waiting} en attente, ${failed} en erreur, ${purged.count} purgé(s).`,
      );
    }
    return { processed, waiting, failed, purged: purged.count };
  }
}
