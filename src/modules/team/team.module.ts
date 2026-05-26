import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
    imports: [SharedModule],
    providers: [TeamService],
    controllers: [TeamController],
    exports: [TeamService],
})
export class TeamModule { }
