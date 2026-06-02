import { Module } from '@nestjs/common';
import { DemoBookingController } from './demo-booking.controller';
import { DemoBookingService } from './demo-booking.service';

@Module({
  controllers: [DemoBookingController],
  providers: [DemoBookingService],
})
export class MarketingModule {}
