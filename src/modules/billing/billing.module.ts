import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { WorkshopModule } from '../workshop/workshop.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [SharedModule, WorkshopModule, NotificationsModule, StockModule],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
