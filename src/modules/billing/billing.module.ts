import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { WorkshopModule } from '../workshop/workshop.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { CustomerNotificationsModule } from '../customer-notifications';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PublicQuoteController } from './public-quote.controller';
import { PublicQuoteService } from './public-quote.service';

@Module({
  imports: [SharedModule, WorkshopModule, NotificationsModule, StockModule, CustomerNotificationsModule, SubscriptionModule],
  providers: [BillingService, PublicQuoteService],
  controllers: [BillingController, PublicQuoteController],
  exports: [BillingService],
})
export class BillingModule {}
