import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { RequireRole, CurrentUser } from '../../decorators/auth.decorator';
import { ReportsService } from './reports.service';
import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

class UpsertTargetDto {
  @IsInt() @Min(2020) @Max(2100) @Type(() => Number)
  year!: number;

  @IsInt() @Min(1) @Max(12) @Type(() => Number)
  month!: number;

  @IsNumber() @IsPositive() @Type(() => Number)
  targetXaf!: number;
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @RequireRole('ADMIN')
  getRevenueReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getRevenueReport(startDate, endDate, user?.garageId);
  }

  @Get('workshop-performance')
  @RequireRole('ADMIN')
  getWorkshopPerformance(@CurrentUser() user: any) {
    return this.reportsService.getWorkshopPerformance(user?.garageId);
  }

  @Get('dashboard-stats')
  getDashboardStats(@CurrentUser() user: any) {
    return this.reportsService.getDashboardStats(user?.garageId);
  }

  // ── Objectifs mensuels ──────────────────────────────────────────────────────

  @Get('targets')
  @RequireRole('ADMIN')
  getTargets(
    @CurrentUser() user: any,
    @Query('year') yearStr?: string,
  ) {
    const year = yearStr ? parseInt(yearStr) : new Date().getFullYear();
    return this.reportsService.getTargetsHistory(year, user?.garageId);
  }

  @Post('targets')
  @RequireRole('ADMIN')
  upsertTarget(@CurrentUser() user: any, @Body() body: UpsertTargetDto) {
    return this.reportsService.upsertTarget({
      year:      body.year,
      month:     body.month,
      targetXaf: body.targetXaf,
      garageId:  user?.garageId,
      userId:    user?.id,
    });
  }

  @Delete('targets/:id')
  @RequireRole('ADMIN')
  deleteTarget(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reportsService.deleteTarget(id, user?.garageId);
  }
}
