import { Controller, Get, Post, Patch, Body, Param, Query, Delete } from '@nestjs/common';
import { WorkshopService } from './workshop.service';
import { CurrentUser, RequirePermission } from '../../decorators/auth.decorator';
import { OTStatus } from '@prisma/client';
import {
  CreateServiceOrderDto,
  UpdateOTDto,
  UpdateOTStatusDto,
  CreateObservationDto,
  CreateWorkItemDto,
  CreateReceptionCheckDto,
  CreateQualityControlDto,
} from './dto/workshop.dto';
import type { WorkshopUser } from './workshop-access.helpers';

@Controller('workshop')
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

  @Get('ot')
  @RequirePermission('ORD_VIEW')
  listOTs(
    @Query('status') status?: OTStatus,
    @Query('search') search?: string,
    @CurrentUser() user?: WorkshopUser,
  ) {
    return this.workshopService.listOTs(status, search, user);
  }

  @Get('ot/:id')
  @RequirePermission('ORD_VIEW')
  getOT(@Param('id') id: string, @CurrentUser() user?: WorkshopUser) {
    return this.workshopService.getOT(id, user);
  }

  @Post('ot')
  @RequirePermission('ORD_CREATE')
  createOT(@CurrentUser() user: any, @Body() body: CreateServiceOrderDto) {
    return this.workshopService.createOT(body, user.id, user.garageId);
  }

  @Patch('ot/:id')
  @RequirePermission('ORD_CREATE')
  updateOT(@Param('id') id: string, @Body() body: UpdateOTDto) {
    return this.workshopService.updateOT(id, body);
  }

  @Patch('ot/:id/status')
  @RequirePermission('ORD_VIEW')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: Parameters<WorkshopService['updateStatus']>[2],
    @Body() body: UpdateOTStatusDto,
  ) {
    return this.workshopService.updateStatus(id, body.status, user, {
      reason: body.reason,
      cancellationReason: body.cancellationReason,
      partsReconciliation: body.partsReconciliation,
    });
  }

  @Post('ot/:id/observation')
  @RequirePermission('ORD_VIEW')
  addObservation(
    @Param('id') id: string,
    @CurrentUser() user: WorkshopUser,
    @Body() body: CreateObservationDto,
  ) {
    return this.workshopService.addObservation(id, user, body);
  }

  @Post('ot/:id/work-item')
  @RequirePermission('ORD_CREATE')
  addWorkItem(@Param('id') id: string, @Body() body: CreateWorkItemDto) {
    return this.workshopService.addWorkItem(id, body);
  }

  @Post('ot/:id/reception-check')
  @RequirePermission('ORD_CREATE')
  addReceptionCheck(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: CreateReceptionCheckDto,
  ) {
    return this.workshopService.addReceptionCheck(id, user.id, body);
  }

  @Get('labor-catalog')
  @RequirePermission('ORD_VIEW')
  getLaborCatalog() {
    return this.workshopService.getLaborCatalog();
  }

  @Get('reception-catalog')
  @RequirePermission('ORD_VIEW')
  getReceptionCatalog() {
    return this.workshopService.getReceptionCatalog();
  }

  @Patch('ot/:id/assign')
  @RequirePermission('ORD_CREATE')
  assignChef(@Param('id') id: string, @Body() body: { assignedChefId: string }) {
    return this.workshopService.assignChef(id, body.assignedChefId);
  }

  @Post('ot/:id/quality-control')
  @RequirePermission('ORD_CREATE')
  addQualityControl(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: CreateQualityControlDto,
  ) {
    return this.workshopService.addQualityControl(id, user.id, body);
  }

  @Delete('ot/:id/work-item/:itemId')
  @RequirePermission('ORD_CREATE')
  removeWorkItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.workshopService.removeWorkItem(id, itemId);
  }
}
