import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { RATE_LIMITS } from '../../shared/security/rate-limits';
import { RejectPublicQuoteDto } from './dto/public-quote.dto';
import { PublicQuoteService } from './public-quote.service';

/**
 * Lien public de devis envoyé au client. Codes d'erreur stables :
 * QUOTE_LINK_INVALID (404), QUOTE_LINK_EXPIRED (410), QUOTE_ALREADY_DECIDED (409).
 * Limitation de débit par IP client (garde globale ClientIpThrottlerGuard, limites RATE_LIMITS).
 */
@Controller('public/quotes')
export class PublicQuoteController {
  constructor(private readonly quotes: PublicQuoteService) {}

  @Public()
  @Get(':token')
  @Throttle(RATE_LIMITS.quoteLinkRead)
  describe(@Param('token') token: string) {
    return this.quotes.describe(token);
  }

  @Public()
  @Post(':token/approve')
  @HttpCode(HttpStatus.OK)
  @Throttle(RATE_LIMITS.quoteLinkDecide)
  approve(@Param('token') token: string) {
    return this.quotes.decide(token, 'APPROVED');
  }

  @Public()
  @Post(':token/reject')
  @HttpCode(HttpStatus.OK)
  @Throttle(RATE_LIMITS.quoteLinkDecide)
  reject(@Param('token') token: string, @Body() body: RejectPublicQuoteDto) {
    return this.quotes.decide(token, 'REJECTED', body.reason);
  }
}
