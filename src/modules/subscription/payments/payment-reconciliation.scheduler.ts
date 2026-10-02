import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionPaymentsService } from './subscription-payments.service';

/**
 * Filet de sécurité : un paiement confirmé chez NotchPay mais dont ni le webhook ni
 * le retour client n'ont été traités est appliqué au plus tard 5 minutes après.
 * Idempotent (voir SubscriptionPaymentsService.reconcilePendingPayments).
 */
@Injectable()
export class PaymentReconciliationScheduler {
  private readonly logger = new Logger(PaymentReconciliationScheduler.name);
  private running = false;

  constructor(private readonly payments: SubscriptionPaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPayments() {
    if (this.running) return; // un passage lent ne se superpose jamais au suivant
    this.running = true;
    try {
      const summary = await this.payments.reconcilePendingPayments();
      if (summary.activated || summary.closed || summary.failed) {
        this.logger.log(`Paiements réconciliés : ${JSON.stringify(summary)}`);
      }
    } catch (error) {
      this.logger.error(`Réconciliation des paiements interrompue : ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
