import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TeamService } from './team.service';
import { RequirePermission, RequireRole } from '../../decorators/auth.decorator';
import { CreateTeamMemberDto, UpdateTeamMemberDto, AssignRoleDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
    constructor(private readonly teamService: TeamService) { }

    @Post()
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    create(@Body() body: CreateTeamMemberDto) {
        return this.teamService.create(body);
    }

    @Get()
    @RequirePermission('ORD_VIEW')
    findAll(@Query('search') search?: string, @Query('roleId') roleId?: string) {
        return this.teamService.findAll(search, roleId);
    }

    @Get(':id')
    @RequirePermission('ORD_VIEW')
    findOne(@Param('id') id: string) {
        return this.teamService.findOne(id);
    }

    @Patch(':id')
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    update(@Param('id') id: string, @Body() body: UpdateTeamMemberDto) {
        return this.teamService.update(id, body);
    }

    @Patch(':id/role')
    @RequireRole('ADMIN')
    assignRole(@Param('id') id: string, @Body() body: AssignRoleDto) {
        return this.teamService.assignRole(id, body.roleCode);
    }

    @Delete(':id')
    @RequireRole('ADMIN')
    remove(@Param('id') id: string) {
        return this.teamService.remove(id);
    }
}
