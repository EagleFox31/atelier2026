import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DemoBookingController } from './demo-booking.controller';
import { DemoBookingService } from './demo-booking.service';
import { DemoRequestsController } from './demo-requests.controller';
import { DemoRequestsService } from './demo-requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DemoBookingController, DemoRequestsController],
  providers: [DemoBookingService, DemoRequestsService],
})
export class MarketingModule {}
