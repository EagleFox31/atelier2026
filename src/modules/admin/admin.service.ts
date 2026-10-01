import { Injectable, Logger } from '@nestjs/common';
import { OTStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

const ACTIVE_OT_STATUSES: OTStatus[] = [
  OTStatus.RECEIVED, OTStatus.DIAGNOSING, OTStatus.QUOTE_PENDING,
  OTStatus.QUOTE_APPROVED, OTStatus.IN_PROGRESS, OTStatus.QC_PENDING,
  OTStatus.QC_REJECTED, OTStatus.QC_DONE, OTStatus.READY,
];

type TenantSuspensionState = {
  status: string;
  subscriptionStatus: SubscriptionStatus;
};

/**
 * Suspendu = subscriptionStatus SUSPENDED (mécanisme actuel, appliqué par
 * SubscriptionGuard) ou `status` 'suspended' hérité de l'ancien mécanisme.
 */
function isTenantSuspended(tenant: TenantSuspensionState): boolean {
  return tenant.subscriptionStatus === SubscriptionStatus.SUSPENDED || tenant.status === 'suspended';
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

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
          status: isTenantSuspended(tenant) ? 'suspended' : 'active',
          subscriptionStatus: tenant.subscriptionStatus,
          createdAt: tenant.createdAt,
          userCount: tenant.users.length,
          garageCount: tenant.garages.length,
          garages: garagesWithStats,
        };
      }),
    );

    return result;
  }

  /**
   * Suspend / réactive tout un atelier.
   *
   * La suspension passe uniquement par `subscriptionStatus` (bloqué par
   * SubscriptionGuard → écran SUBSCRIPTION_SUSPENDED). Le statut des utilisateurs
   * n'est jamais modifié : un utilisateur suspendu par son ADMIN le reste
   * quand le tenant est réactivé.
   */
  async toggleTenantStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        status: true,
        subscriptionStatus: true,
        statusBeforeSuspension: true,
        trialEndsAt: true,
      },
    });

    if (!isTenantSuspended(tenant)) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: SubscriptionStatus.SUSPENDED,
          statusBeforeSuspension: tenant.subscriptionStatus,
          status: 'suspended', // miroir texte, conservé pour compatibilité
        },
      });
      return { tenantId, status: 'suspended' as const, subscriptionStatus: SubscriptionStatus.SUSPENDED };
    }

    // Ancien mécanisme (avant 2026-10) : la suspension avait passé TOUS les
    // utilisateurs en SUSPENDED, sans trace de qui l'était déjà. On les
    // réactive une dernière fois comme avant, sinon l'atelier resterait bloqué.
    const legacySuspension = tenant.subscriptionStatus !== SubscriptionStatus.SUSPENDED;
    const restoredStatus =
      tenant.statusBeforeSuspension ??
      (tenant.trialEndsAt ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE);

    const tenantUpdate = this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: restoredStatus,
        statusBeforeSuspension: null,
        status: 'active',
      },
    });

    if (legacySuspension) {
      const [, legacyUsers] = await this.prisma.$transaction([
        tenantUpdate,
        this.prisma.user.updateMany({
          where: { tenantId, deletedAt: null, status: UserStatus.SUSPENDED },
          data: { status: UserStatus.ACTIVE },
        }),
      ]);
      this.logger.warn(
        `Tenant ${tenantId} réactivé depuis une suspension héritée : ${legacyUsers.count} utilisateur(s) réactivé(s)`,
      );
    } else {
      await tenantUpdate;
    }

    // Le pilote a pu se terminer pendant la suspension : TRIAL → GRACE_PERIOD / EXPIRED.
    const reconciled = await this.subscriptions.reconcileTenant(tenantId);
    return { tenantId, status: 'active' as const, subscriptionStatus: reconciled.subscriptionStatus };
  }
}
