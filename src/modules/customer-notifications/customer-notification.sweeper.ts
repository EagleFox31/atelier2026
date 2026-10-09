import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerNotificationEmitter } from './customer-notification.emitter';
import { DISPATCH_LEASE_MS } from './customer-notification.processor';

/** Délai avant reprise : laisse à la mise en file normale le temps d'aboutir. */
export const SWEEP_GRACE_MS = 60_000;
export const SWEEP_BATCH = 200;

/**
 * Filet de sécurité de l'outbox (cron 1 min), idempotent :
 * - PENDING jamais pris en charge (Redis absent, job perdu) → réenfilé ; le `jobId`
 *   déterministe rend la mise en file sans effet si le job existe encore ;
 * - PENDING pris en charge depuis plus que le bail → issue inconnue (le process a pu
 *   mourir après l'acceptation par Meta) : FAILED `UNKNOWN_OUTCOME`, jamais renvoyé,
 *   pour ne pas risquer un double envoi au client.
 */
@Injectable()
export class CustomerNotificationSweeper {
  private readonly logger = new Logger(CustomerNotificationSweeper.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: CustomerNotificationEmitter,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(now: Date = new Date()): Promise<{ requeued: number; unknownOutcome: number }> {
    const unknown = await this.prisma.customerNotification.updateMany({
      where: { status: 'PENDING', dispatchStartedAt: { lt: new Date(now.getTime() - DISPATCH_LEASE_MS) } },
      data: {
        status: 'FAILED',
        failedAt: now,
        lastErrorCode: 'UNKNOWN_OUTCOME',
        lastErrorMessage: 'Envoi interrompu : issue inconnue, non renvoyé pour éviter un doublon.',
      },
    });

    const stuck = await this.prisma.customerNotification.findMany({
      where: { status: 'PENDING', dispatchStartedAt: null, createdAt: { lt: new Date(now.getTime() - SWEEP_GRACE_MS) } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: SWEEP_BATCH,
    });
    let requeued = 0;
    for (const { id } of stuck) {
      if (await this.emitter.enqueue(id)) requeued += 1;
    }

    if (unknown.count > 0 || requeued > 0) {
      this.logger.warn(`Balayage : ${requeued} notification(s) réenfilée(s), ${unknown.count} issue(s) inconnue(s).`);
    }
    return { requeued, unknownOutcome: unknown.count };
  }
}
