/**
 * Valeurs autorisées par la contrainte SQL `quotes_client_approval_method_check` (Supabase).
 * Vérifier avec : node scripts/audit-quote-ot-status.mjs
 */
export const QUOTE_CLIENT_APPROVAL_METHODS = [
  'PHYSICAL',
  'DIGITAL',
  'VERBAL_NOTED',
] as const;

export type QuoteClientApprovalMethod = (typeof QUOTE_CLIENT_APPROVAL_METHODS)[number];

/** Défaut à l'approbation manuelle depuis Facturation (validation client notée). */
export const QUOTE_DEFAULT_APPROVAL_METHOD: QuoteClientApprovalMethod = 'VERBAL_NOTED';
