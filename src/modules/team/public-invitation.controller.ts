import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { RATE_LIMITS } from '../../shared/security/rate-limits';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { TeamInvitationService } from './team-invitation.service';

/**
 * Activation publique d'un compte invité (#15). Codes d'erreur stables :
 * INVITATION_INVALID (404), INVITATION_EXPIRED (410), INVITATION_USED (409).
 * Limitation de débit par IP client (garde globale ClientIpThrottlerGuard, limites RATE_LIMITS).
 */
@Controller('public/invitations')
export class PublicInvitationController {
  constructor(private readonly invitations: TeamInvitationService) {}

  @Public()
  @Get(':token')
  @Throttle(RATE_LIMITS.invitationRead)
  describe(@Param('token') token: string) {
    return this.invitations.describe(token);
  }

  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(RATE_LIMITS.invitationAccept)
  accept(@Param('token') token: string, @Body() body: AcceptInvitationDto) {
    return this.invitations.accept(token, body.password);
  }
}
