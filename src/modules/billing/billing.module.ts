import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { WorkshopModule } from '../workshop/workshop.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { CustomerNotificationsModule } from '../customer-notifications';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [SharedModule, WorkshopModule, NotificationsModule, StockModule, CustomerNotificationsModule],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
