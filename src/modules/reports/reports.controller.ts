import { Controller, Get, Query } from '@nestjs/common';
import { RequireRole } from '../../decorators/auth.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @RequireRole('ADMIN')
  getRevenueReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportsService.getRevenueReport(startDate, endDate);
  }

  @Get('workshop-performance')
  @RequireRole('ADMIN')
  getWorkshopPerformance() {
    return this.reportsService.getWorkshopPerformance();
  }
}
