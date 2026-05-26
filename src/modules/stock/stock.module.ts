import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StockService } from './stock.service';
import { PartsFlowService } from './parts-flow.service';
import { StockController } from './stock.controller';

@Module({
  imports: [
    SharedModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'stock-alerts' }),
  ],
  providers: [StockService, PartsFlowService],
  controllers: [StockController],
  exports: [StockService, PartsFlowService],
})
export class StockModule {}
