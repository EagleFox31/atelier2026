import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequireRole } from '../../decorators/auth.decorator';
import { RATE_LIMITS } from '../../shared/security/rate-limits';
import { SendWhatsAppTestDto } from './dto/notifications.dto';
import { WhatsAppTestService } from './whatsapp-test.service';

@Controller('notifications/whatsapp')
@RequireRole('SUPER_ADMIN')
export class WhatsAppTestController {
  constructor(private readonly whatsappTest: WhatsAppTestService) {}

  @Post('test')
  @HttpCode(201)
  @Throttle(RATE_LIMITS.whatsappTest)
  sendTest(@Body() body: SendWhatsAppTestDto) {
    return this.whatsappTest.sendTest(body);
  }
}
