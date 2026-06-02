import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { RequirePermission, CurrentUser } from '../../decorators/auth.decorator';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/planning.dto';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post('appointments')
  @RequirePermission('ORD_CREATE')
  create(@CurrentUser() user: { garageId?: string | null }, @Body() body: CreateAppointmentDto) {
    return this.planningService.create(body, user.garageId);
  }

  @Get('appointments')
  @RequirePermission('ORD_VIEW')
  findAll(
    @CurrentUser() user: { garageId?: string | null },
    @Query('date') date?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.planningService.findAll(user.garageId, date, status);
  }

  @Patch('appointments/:id')
  @RequirePermission('ORD_CREATE')
  update(
    @CurrentUser() user: { garageId?: string | null },
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    return this.planningService.update(id, body, user.garageId);
  }

  @Delete('appointments/:id')
  @RequirePermission('ORD_CREATE')
  remove(@CurrentUser() user: { garageId?: string | null }, @Param('id') id: string) {
    return this.planningService.remove(id, user.garageId);
  }
}
