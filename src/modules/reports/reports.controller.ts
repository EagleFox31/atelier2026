import { Controller, Get, Query } from '@nestjs/common';
import { RequireRole, CurrentUser } from '../../decorators/auth.decorator';
import { ReportsService } from './reports.service';

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
}
