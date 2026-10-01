import { Module } from '@nestjs/common';
import { ClockService } from './clock.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TrialSchedulerService } from './trial-scheduler.service';
import { PAYMENT_PROVIDER } from './payments/payment-provider';
import { NotchPayPaymentProvider } from './payments/notchpay-payment.provider';
import { SubscriptionPaymentsController } from './payments/subscription-payments.controller';
import { SubscriptionPaymentsService } from './payments/subscription-payments.service';

@Module({
  controllers: [SubscriptionController, SubscriptionPaymentsController],
  providers: [
    ClockService,
    SubscriptionService,
    TrialSchedulerService,
    SubscriptionPaymentsService,
    { provide: PAYMENT_PROVIDER, useClass: NotchPayPaymentProvider },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
