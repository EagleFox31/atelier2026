import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TeamService } from './team.service';
import { RequirePermission, RequireRole, CurrentUser } from '../../decorators/auth.decorator';
import { CreateTeamMemberDto, UpdateTeamMemberDto, AssignRoleDto, ResetPasswordDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
    constructor(private readonly teamService: TeamService) { }

    @Post()
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    create(@CurrentUser() user: any, @Body() body: CreateTeamMemberDto) {
        return this.teamService.create({ ...body, garageId: user?.garageId ?? undefined, tenantId: user?.tenantId ?? undefined });
    }

    @Get()
    @RequirePermission('ORD_VIEW')
    findAll(@CurrentUser() user: any, @Query('search') search?: string, @Query('roleId') roleId?: string) {
        return this.teamService.findAll(search, roleId, user?.garageId);
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

    @Post(':id/reset-password')
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    resetPassword(@Param('id') id: string, @Body() body: ResetPasswordDto) {
        return this.teamService.resetPassword(id, body.password);
    }

    @Patch(':id/toggle-status')
    @RequireRole('ADMIN')
    toggleStatus(@Param('id') id: string) {
        return this.teamService.toggleStatus(id);
    }

    @Delete(':id')
    @RequireRole('ADMIN')
    remove(@Param('id') id: string) {
        return this.teamService.remove(id);
    }
}
