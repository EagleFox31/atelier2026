import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { TeamInvitationService } from './team-invitation.service';
import { PublicInvitationController } from './public-invitation.controller';

@Module({
    imports: [SharedModule, AuthModule],
    providers: [TeamService, TeamInvitationService],
    controllers: [TeamController, PublicInvitationController],
    exports: [TeamService, TeamInvitationService],
})
export class TeamModule { }
