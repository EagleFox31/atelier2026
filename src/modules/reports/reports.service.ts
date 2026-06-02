import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, OTStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];

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

  // ── Objectifs mensuels ─────────────────────────────────────────────────────

  async getTargetsHistory(year: number, garageId?: string | null) {
    const garageFilter = garageId ? { garageId } : {};

    // Récupérer les objectifs définis pour l'année
    const targets = await this.prisma.monthlyTarget.findMany({
      where: { ...garageFilter, year },
      orderBy: { month: 'asc' },
    });

    // Récupérer les revenus réels par mois
    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...garageFilter,
        status: InvoiceStatus.PAID,
        paidAt: { gte: start, lt: end },
      },
      select: { paidAt: true, totalXaf: true },
    });

    const revenueByMonth: number[] = Array(12).fill(0);
    for (const inv of invoices) {
      if (!inv.paidAt) continue;
      const m = inv.paidAt.getMonth(); // 0-based
      revenueByMonth[m] += Number(inv.totalXaf);
    }

    return Array.from({ length: 12 }, (_, i) => {
      const month   = i + 1;
      const label   = MONTH_LABELS[i];
      const revenue = revenueByMonth[i];
      const target  = targets.find(t => t.month === month);
      const targetXaf = target ? Number(target.targetXaf) : null;
      const pct = targetXaf && targetXaf > 0
        ? Math.round((revenue / targetXaf) * 100)
        : null;

      return {
        month,
        label: `${label} ${year}`,
        shortLabel: label,
        revenue,
        targetXaf,
        targetId: target?.id ?? null,
        achievementPct: pct,
        status: pct === null ? 'none'
          : pct >= 100 ? 'exceeded'
          : pct >= 80  ? 'close'
          : 'missed',
      };
    });
  }

  async upsertTarget(data: {
    year: number;
    month: number;
    targetXaf: number;
    garageId?: string | null;
    userId?: string;
  }) {
    // Upsert manuel — Prisma ne gère pas bien les contraintes uniques avec NULL via upsert
    const existing = await this.prisma.monthlyTarget.findFirst({
      where: { garageId: data.garageId ?? null, year: data.year, month: data.month },
    });

    if (existing) {
      return this.prisma.monthlyTarget.update({
        where: { id: existing.id },
        data: { targetXaf: data.targetXaf },
      });
    }

    return this.prisma.monthlyTarget.create({
      data: {
        garageId: data.garageId ?? null,
        year: data.year,
        month: data.month,
        targetXaf: data.targetXaf,
        createdById: data.userId ?? null,
      },
    });
  }

  async deleteTarget(id: string, garageId?: string | null) {
    const target = await this.prisma.monthlyTarget.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Objectif introuvable');
    if (garageId && target.garageId !== garageId) throw new NotFoundException('Objectif introuvable');
    return this.prisma.monthlyTarget.delete({ where: { id } });
  }
}
