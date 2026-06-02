import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TeamService } from './team.service';
import { RequirePermission, RequireRole, CurrentUser } from '../../decorators/auth.decorator';
import { CreateTeamMemberDto, UpdateTeamMemberDto, AssignRoleDto, ResetPasswordDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
    constructor(private readonly teamService: TeamService) { }

    @Post()
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    create(@CurrentUser() user: { garageId?: string | null; tenantId?: string | null }, @Body() body: CreateTeamMemberDto) {
        return this.teamService.create({ ...body, garageId: user?.garageId ?? undefined, tenantId: user?.tenantId ?? undefined });
    }

    @Get()
    @RequirePermission('ORD_VIEW')
    findAll(@CurrentUser() user: { garageId?: string | null }, @Query('search') search?: string, @Query('roleId') roleId?: string) {
        return this.teamService.findAll(search, roleId, user?.garageId);
    }

    @Get(':id')
    @RequirePermission('ORD_VIEW')
    findOne(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string) {
        return this.teamService.findOne(id, user?.garageId);
    }

    @Patch(':id')
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    update(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string, @Body() body: UpdateTeamMemberDto) {
        return this.teamService.update(id, body, user?.garageId);
    }

    @Patch(':id/role')
    @RequireRole('ADMIN')
    assignRole(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string, @Body() body: AssignRoleDto) {
        return this.teamService.assignRole(id, body.roleCode, user?.garageId);
    }

    @Post(':id/reset-password')
    @RequireRole('ADMIN', 'CHEF_ATELIER')
    resetPassword(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string, @Body() body: ResetPasswordDto) {
        return this.teamService.resetPassword(id, body.password, user?.garageId);
    }

    @Patch(':id/toggle-status')
    @RequireRole('ADMIN')
    toggleStatus(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string) {
        return this.teamService.toggleStatus(id, user?.garageId);
    }

    @Delete(':id')
    @RequireRole('ADMIN')
    remove(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string) {
        return this.teamService.remove(id, user?.garageId);
    }
}
