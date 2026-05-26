import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { RequirePermission } from '../../decorators/auth.decorator';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/planning.dto';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post('appointments')
  @RequirePermission('ORD_CREATE')
  create(@Body() body: CreateAppointmentDto) {
    return this.planningService.create(body);
  }

  @Get('appointments')
  @RequirePermission('ORD_VIEW')
  findAll(@Query('date') date?: string, @Query('status') status?: AppointmentStatus) {
    return this.planningService.findAll(date, status);
  }

  @Patch('appointments/:id')
  @RequirePermission('ORD_CREATE')
  update(@Param('id') id: string, @Body() body: UpdateAppointmentDto) {
    return this.planningService.update(id, body);
  }

  @Delete('appointments/:id')
  @RequirePermission('ORD_CREATE')
  remove(@Param('id') id: string) {
    return this.planningService.remove(id);
  }
}
