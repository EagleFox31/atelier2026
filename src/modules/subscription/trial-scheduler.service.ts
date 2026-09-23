import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class TrialSchedulerService {
  private readonly logger = new Logger(TrialSchedulerService.name);

  constructor(private readonly subscriptions: SubscriptionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileTrials() {
    const count = await this.subscriptions.reconcileAllTrials();
    if (count > 0) {
      this.logger.log(`Cycle pilote réconcilié pour ${count} tenant(s)`);
    }
  }
}
