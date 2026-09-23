import { Module } from '@nestjs/common';
import { ClockService } from './clock.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TrialSchedulerService } from './trial-scheduler.service';

@Module({
  controllers: [SubscriptionController],
  providers: [ClockService, SubscriptionService, TrialSchedulerService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
