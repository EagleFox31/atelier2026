import { Injectable } from '@nestjs/common';
import { OTStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

const ACTIVE_OT_STATUSES: OTStatus[] = [
  OTStatus.RECEIVED, OTStatus.DIAGNOSING, OTStatus.QUOTE_PENDING,
  OTStatus.QUOTE_APPROVED, OTStatus.IN_PROGRESS, OTStatus.QC_PENDING,
  OTStatus.QC_REJECTED, OTStatus.QC_DONE, OTStatus.READY,
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        garages: {
          orderBy: { createdAt: 'asc' },
        },
        users: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    // Enrichir avec stats OT par garage
    const result = await Promise.all(
      tenants.map(async (tenant) => {
        const garagesWithStats = await Promise.all(
          tenant.garages.map(async (garage) => {
            const [activeOTs, totalOTs] = await Promise.all([
              this.prisma.serviceOrder.count({
                where: { garageId: garage.id, status: { in: ACTIVE_OT_STATUSES } },
              }),
              this.prisma.serviceOrder.count({
                where: { garageId: garage.id },
              }),
            ]);
            return { ...garage, activeOTs, totalOTs };
          }),
        );

        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          email: tenant.email,
          plan: tenant.plan,
          status: tenant.status,
          createdAt: tenant.createdAt,
          userCount: tenant.users.length,
          garageCount: tenant.garages.length,
          garages: garagesWithStats,
        };
      }),
    );

    return result;
  }

  async toggleTenantStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: newStatus },
    });

    // Suspendre/réactiver tous les users du tenant
    await this.prisma.user.updateMany({
      where: { tenantId, deletedAt: null },
      data: { status: newStatus === 'suspended' ? 'SUSPENDED' : 'ACTIVE' },
    });

    return { tenantId, status: newStatus };
  }
}
