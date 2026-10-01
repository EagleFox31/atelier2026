import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Droits par forfait — table unique (lot 2 du plan de correction).
 *
 * Règle d'or : aucune règle « forfait × statut » codée en ligne dans un controller,
 * un service ou un composant. On ajoute une entrée ici, et tous les consumers
 * (API, workers, front via /subscription/status) suivent.
 *
 * Choix « Build » (RAIDER reuse-first) : une bibliothèque d'autorisations (CASL)
 * ou de feature flags (OpenFeature/Unleash) serait disproportionnée pour une
 * table statique de quelques règles, sans état distant à synchroniser.
 */
export type Feature = 'branding';

export type EntitlementContext = {
  status: SubscriptionStatus | `${SubscriptionStatus}`;
  plan: string;
};

const ENTITLEMENTS: Record<Feature, (ctx: EntitlementContext) => boolean> = {
  /** Logo personnalisé (app, devis, factures, PDF) : tout forfait payant actif. */
  branding: (ctx) => ctx.status === SubscriptionStatus.ACTIVE,
};

const FEATURE_REQUIRED: Record<Feature, { errorCode: string; message: string }> = {
  branding: {
    // Code conservé tel quel : contrat existant de POST /settings/workshop/logo.
    errorCode: 'PAID_FEATURE_REQUIRED',
    message: 'Le logo personnalisé est disponible après activation d’un forfait payant.',
  },
};

export function hasFeature(ctx: EntitlementContext, feature: Feature): boolean {
  return ENTITLEMENTS[feature](ctx);
}

export function featureRequiredError(feature: Feature, ctx: EntitlementContext): ForbiddenException {
  return new ForbiddenException({
    ...FEATURE_REQUIRED[feature],
    feature,
    subscriptionStatus: ctx.status,
  });
}
