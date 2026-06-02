import { Injectable } from '@nestjs/common';
import { InvoiceStatus, OTStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueReport(startDate?: string, endDate?: string, garageId?: string | null) {
    const where: Record<string, unknown> = {
      status: InvoiceStatus.PAID,
      ...(garageId ? { garageId } : {}),
    };
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) (where.paidAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate)   (where.paidAt as Record<string, Date>).lte = new Date(endDate);
    }

    const sum = await this.prisma.invoice.aggregate({
      _sum: { totalXaf: true, amountPaidXaf: true },
      where,
    });

    return {
      totalRevenue: sum._sum.totalXaf || 0,
      totalCollected: sum._sum.amountPaidXaf || 0,
      period: { startDate: startDate ?? null, endDate: endDate ?? null },
    };
  }

  async getWorkshopPerformance(garageId?: string | null) {
    const workItems = await this.prisma.oTWorkItem.findMany({
      where: {
        status: WorkItemStatus.COMPLETED,
        ...(garageId ? { serviceOrder: { garageId } } : {}),
      },
      include: { technician: true },
    });

    return workItems.reduce(
      (acc, item) => {
        const label = item.technician
          ? `${item.technician.firstName} ${item.technician.lastName}`
          : 'Unassigned';
        if (!acc[label]) acc[label] = { estimatedHours: 0, actualHours: 0 };
        acc[label].estimatedHours += Number(item.estimatedHours || 0);
        acc[label].actualHours   += Number(item.actualHours || 0);
        return acc;
      },
      {} as Record<string, { estimatedHours: number; actualHours: number }>,
    );
  }

  async getDashboardStats(garageId?: string | null) {
    const garageFilter = garageId ? { garageId } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [activeOTs, vehiclesToday, completedThisMonth, revenueAgg] = await Promise.all([
      this.prisma.serviceOrder.count({
        where: {
          ...garageFilter,
          status: { notIn: [OTStatus.DRAFT, OTStatus.INVOICED, OTStatus.CLOSED, OTStatus.CANCELLED] },
        },
      }),
      this.prisma.serviceOrder.count({
        where: { ...garageFilter, openedAt: { gte: today } },
      }),
      this.prisma.serviceOrder.count({
        where: {
          ...garageFilter,
          status: { in: [OTStatus.READY, OTStatus.INVOICED, OTStatus.CLOSED] },
          updatedAt: { gte: firstDayOfMonth },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { totalXaf: true },
        where: { ...garageFilter, status: InvoiceStatus.PAID, paidAt: { gte: firstDayOfMonth } },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalXaf || 0);
    const formattedRevenue = totalRevenue >= 1_000_000
      ? `${(totalRevenue / 1_000_000).toFixed(1)}M`
      : totalRevenue.toLocaleString('fr-FR');

    return {
      stats: [
        { title: 'OT en cours',       value: activeOTs.toString(),          trend: '-' },
        { title: "Reçus aujourd'hui", value: vehiclesToday.toString(),       trend: '-' },
        { title: 'Terminés (Mois)',   value: completedThisMonth.toString(),  trend: '-' },
        { title: 'Chiffre d\'affaires', value: formattedRevenue,              trend: '-' },
      ],
    };
  }
}
