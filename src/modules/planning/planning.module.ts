import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CustomerNotificationsModule } from '../customer-notifications';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [SharedModule, CustomerNotificationsModule],
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
