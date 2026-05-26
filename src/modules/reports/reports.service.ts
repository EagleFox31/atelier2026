import { Injectable } from '@nestjs/common';
import { InvoiceStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueReport(startDate?: string, endDate?: string) {
    const where: Record<string, unknown> = { status: InvoiceStatus.PAID };
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) (where.paidAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.paidAt as Record<string, Date>).lte = new Date(endDate);
    }

    const sum = await this.prisma.invoice.aggregate({
      _sum: { totalXaf: true, amountPaidXaf: true },
      where,
    });

    return {
      totalRevenue: sum._sum.totalXaf || 0,
      totalCollected: sum._sum.amountPaidXaf || 0,
      // null explicite — JSON.stringify omet undefined, ce qui casse le contrat front
      period: { startDate: startDate ?? null, endDate: endDate ?? null },
    };
  }

  async getWorkshopPerformance() {
    const workItems = await this.prisma.oTWorkItem.findMany({
      where: { status: WorkItemStatus.COMPLETED },
      include: { technician: true },
    });

    return workItems.reduce(
      (acc, item) => {
        const label = item.technician
          ? `${item.technician.firstName} ${item.technician.lastName}`
          : 'Unassigned';
        if (!acc[label]) acc[label] = { estimatedHours: 0, actualHours: 0 };
        acc[label].estimatedHours += Number(item.estimatedHours || 0);
        acc[label].actualHours += Number(item.actualHours || 0);
        return acc;
      },
      {} as Record<string, { estimatedHours: number; actualHours: number }>,
    );
  }
}
