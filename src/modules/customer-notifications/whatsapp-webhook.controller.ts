import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import type { RawBodyRequest } from '../../shared/http/body-parsers';
import { RATE_LIMITS } from '../../shared/security/rate-limits';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/**
 * Point d'entrée Meta : `GET|POST /api/webhooks/whatsapp`.
 * Public = sans JWT d'employé ; l'authentification est le challenge (GET) ou la signature (POST).
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly webhook: WhatsAppWebhookService) {}

  @Public()
  @Throttle(RATE_LIMITS.webhookVerify)
  @Get()
  verify(
    @Query('hub.mode') mode: unknown,
    @Query('hub.verify_token') token: unknown,
    @Query('hub.challenge') challenge: unknown,
    @Res({ passthrough: true }) response: Response,
  ): string {
    const echoed = this.webhook.verify({ mode, token, challenge });
    // Texte brut seulement en cas de succès : les refus restent au format JSON de l'API.
    response.type('text/plain');
    return echoed;
  }

  @Public()
  @SkipThrottle() // Meta notifie en rafale ; chaque appel est authentifié par signature
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Req() request: RawBodyRequest, @Headers('x-hub-signature-256') signature: unknown) {
    return this.webhook.receive(request.rawBody, signature);
  }
}
