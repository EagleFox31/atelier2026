import { Controller, Get, Header, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { RATE_LIMITS } from '../../shared/security/rate-limits';
import { GarageContactService } from './garage-contact.service';

@Controller('public/garage-contact')
export class GarageContactController {
  constructor(private readonly contacts: GarageContactService) {}

  @Public()
  @Get(':token')
  @Throttle(RATE_LIMITS.garageContactRead)
  @Header('Cache-Control', 'no-store, private')
  @Header('Referrer-Policy', 'no-referrer')
  describe(@Param('token') token: string) {
    return this.contacts.describe(token);
  }
}
