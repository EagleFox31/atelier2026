
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockModule } from '../stock/stock.module';
import { WorkshopService } from './workshop.service';
import { WorkshopController } from './workshop.controller';

@Module({
  imports: [
    SharedModule,
    NotificationsModule,
    StockModule,
    BullModule.registerQueue({ name: 'sms-notifications' }),
  ],
  providers: [WorkshopService],
  controllers: [WorkshopController],
  exports: [WorkshopService],
})
export class WorkshopModule {}
