
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CustomerNotificationsModule } from '../customer-notifications';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { WorkshopService } from './workshop.service';
import { WorkshopController } from './workshop.controller';

@Module({
  imports: [
    SharedModule,
    NotificationsModule,
    StockModule,
    CustomerNotificationsModule,
  ],
  providers: [WorkshopService],
  controllers: [WorkshopController],
  exports: [WorkshopService],
})
export class WorkshopModule {}
