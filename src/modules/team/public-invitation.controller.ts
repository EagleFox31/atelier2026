import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { ClientIpThrottlerGuard } from '../../shared/security/client-ip-throttler.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { TeamInvitationService } from './team-invitation.service';

/**
 * Activation publique d'un compte invité (#15). Codes d'erreur stables :
 * INVITATION_INVALID (404), INVITATION_EXPIRED (410), INVITATION_USED (409).
 * Limitation de débit par IP client (ClientIpThrottlerGuard).
 */
@Controller('public/invitations')
@UseGuards(ClientIpThrottlerGuard)
export class PublicInvitationController {
  constructor(private readonly invitations: TeamInvitationService) {}

  @Public()
  @Get(':token')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  describe(@Param('token') token: string) {
    return this.invitations.describe(token);
  }

  @Public()
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  accept(@Param('token') token: string, @Body() body: AcceptInvitationDto) {
    return this.invitations.accept(token, body.password);
  }
}
