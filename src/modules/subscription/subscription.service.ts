import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ClockService } from './clock.service';
import { featureRequiredError, hasFeature, type Feature } from './entitlements';

const DAY_MS = 24 * 60 * 60 * 1000;

type TenantSubscriptionRow = {
  id: string;
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  subscriptionStartedAt: Date | null;
  subscriptionEndsAt: Date | null;
  dataRetentionEndsAt: Date | null;
};

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  plan: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  dataRetentionEndsAt: string | null;
  daysRemaining: number | null;
  readOnly: boolean;
  blocked: boolean;
  /** Droits du forfait (table unique entitlements.ts) — le front ne recode aucune règle. */
  features: Record<Feature, boolean>;
};

/** Champs d'abonnement chargés avec l'utilisateur par JwtAuthGuard (aucune requête de plus). */
export type TenantSubscriptionFields = {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
};

/**
 * Statut effectif à l'instant `now` — fonction pure, sans I/O.
 * La persistance des transitions reste assurée par le cron (TrialSchedulerService)
 * et par GET /subscription/status ; le calcul en mémoire coupe l'accès à la seconde près.
 */
export function resolveSubscriptionStatus(
  tenant: Pick<TenantSubscriptionFields, 'subscriptionStatus' | 'trialEndsAt' | 'graceEndsAt'>,
  now: Date,
): SubscriptionStatus {
  if (
    tenant.subscriptionStatus === SubscriptionStatus.ACTIVE ||
    tenant.subscriptionStatus === SubscriptionStatus.SUSPENDED ||
    tenant.subscriptionStatus === SubscriptionStatus.EXPIRED
  ) {
    return tenant.subscriptionStatus;
  }

  // Un ancien tenant sans dates ne doit jamais être coupé par erreur.
  if (!tenant.trialEndsAt) return SubscriptionStatus.ACTIVE;

  if (now.getTime() < tenant.trialEndsAt.getTime()) {
    return SubscriptionStatus.TRIAL;
  }

  if (tenant.graceEndsAt && now.getTime() < tenant.graceEndsAt.getTime()) {
    return SubscriptionStatus.GRACE_PERIOD;
  }

  return SubscriptionStatus.EXPIRED;
}

export function subscriptionFeatures(status: SubscriptionStatus, plan: string): Record<Feature, boolean> {
  return {
    sms: hasFeature({ status, plan }, 'sms'),
    branding: hasFeature({ status, plan }, 'branding'),
  };
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async getSummary(tenantId: string): Promise<SubscriptionSummary> {
    const now = this.clock.now();
    const tenant = await this.reconcileTenant(tenantId, now);
    return this.toSummary(tenant, now);
  }

  /** Refuse (403 avec errorCode métier) si le forfait du tenant n'inclut pas la fonctionnalité. */
  async assertFeature(tenantId: string, feature: Feature): Promise<void> {
    const { status, plan } = await this.getSummary(tenantId);
    if (!hasFeature({ status, plan }, feature)) {
      throw featureRequiredError(feature, { status, plan });
    }
  }

  assertSmsEntitled(tenantId: string): Promise<void> {
    return this.assertFeature(tenantId, 'sms');
  }

  async reconcileTenant(
    tenantId: string,
    now = this.clock.now(),
  ): Promise<TenantSubscriptionRow> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        graceEndsAt: true,
        subscriptionStartedAt: true,
        subscriptionEndsAt: true,
        dataRetentionEndsAt: true,
      },
    });

    const nextStatus = this.resolveStatus(tenant, now);
    if (nextStatus === tenant.subscriptionStatus) return tenant;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: nextStatus },
      select: {
        id: true,
        plan: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        graceEndsAt: true,
        subscriptionStartedAt: true,
        subscriptionEndsAt: true,
        dataRetentionEndsAt: true,
      },
    });
  }

  async reconcileAllTrials(): Promise<number> {
    const now = this.clock.now();
    const tenants = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: {
          in: [SubscriptionStatus.TRIAL, SubscriptionStatus.GRACE_PERIOD],
        },
      },
      select: { id: true },
    });

    await Promise.all(tenants.map(({ id }) => this.reconcileTenant(id, now)));
    return tenants.length;
  }

  private resolveStatus(
    tenant: Pick<TenantSubscriptionRow, 'subscriptionStatus' | 'trialEndsAt' | 'graceEndsAt'>,
    now: Date,
  ): SubscriptionStatus {
    return resolveSubscriptionStatus(tenant, now);
  }

  /**
   * Statut + forfait depuis les champs déjà chargés par JwtAuthGuard : aucune requête.
   * null si ces champs sont absents (appel hors requête HTTP) → l'appelant retombe sur getSummary().
   */
  statusFromLoadedTenant(
    tenant: Partial<TenantSubscriptionFields> | null | undefined,
  ): { status: SubscriptionStatus; plan: string } | null {
    if (!tenant?.subscriptionStatus || typeof tenant.plan !== 'string') return null;
    const status = resolveSubscriptionStatus(
      {
        subscriptionStatus: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt ?? null,
        graceEndsAt: tenant.graceEndsAt ?? null,
      },
      this.clock.now(),
    );
    return { status, plan: tenant.plan };
  }

  private toSummary(tenant: TenantSubscriptionRow, now: Date): SubscriptionSummary {
    const daysRemaining =
      tenant.subscriptionStatus === SubscriptionStatus.TRIAL && tenant.trialEndsAt
        ? Math.max(0, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / DAY_MS))
        : null;

    return {
      status: tenant.subscriptionStatus,
      plan: tenant.plan,
      trialStartedAt: tenant.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      graceEndsAt: tenant.graceEndsAt?.toISOString() ?? null,
      subscriptionStartedAt: tenant.subscriptionStartedAt?.toISOString() ?? null,
      subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() ?? null,
      dataRetentionEndsAt: tenant.dataRetentionEndsAt?.toISOString() ?? null,
      daysRemaining,
      readOnly: tenant.subscriptionStatus === SubscriptionStatus.GRACE_PERIOD,
      blocked:
        tenant.subscriptionStatus === SubscriptionStatus.EXPIRED ||
        tenant.subscriptionStatus === SubscriptionStatus.SUSPENDED,
      features: subscriptionFeatures(tenant.subscriptionStatus, tenant.plan),
    };
  }
}
