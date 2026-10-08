import { Module } from '@nestjs/common';
import { ClockService } from './clock.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TrialSchedulerService } from './trial-scheduler.service';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payments/payment-provider';
import { PaymentProviderRegistry } from './payments/payment-provider.registry';
import { NotchPayPaymentProvider } from './payments/notchpay-payment.provider';
import { SubscriptionPaymentsController } from './payments/subscription-payments.controller';
import { SubscriptionPaymentsService } from './payments/subscription-payments.service';
import { PaymentReconciliationScheduler } from './payments/payment-reconciliation.scheduler';

@Module({
  controllers: [SubscriptionController, SubscriptionPaymentsController],
  providers: [
    ClockService,
    SubscriptionService,
    TrialSchedulerService,
    SubscriptionPaymentsService,
    PaymentReconciliationScheduler,
    // Adaptateurs de paiement : en ajouter un ici (+ PAYMENT_PROVIDER pour l'activer).
    NotchPayPaymentProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (...providers: PaymentProvider[]) => providers,
      inject: [NotchPayPaymentProvider],
    },
    PaymentProviderRegistry,
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
