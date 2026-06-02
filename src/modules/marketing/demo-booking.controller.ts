import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { DemoBookingDto } from './dto/demo-booking.dto';
import { DemoBookingService } from './demo-booking.service';

@Controller('public')
export class DemoBookingController {
  constructor(private readonly demoBooking: DemoBookingService) {}

  @Public()
  @Post('demo-booking')
  @HttpCode(201)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  submit(@Body() body: DemoBookingDto) {
    return this.demoBooking.submit(body);
  }
}
