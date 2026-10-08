/** Liste de tous les adaptateurs enregistrés (voir PaymentProviderRegistry). */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

export type BillingCycle = 'monthly' | 'annual';
export type ProviderPaymentStatus =
  | 'PENDING'
  | 'COMPLETE'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'UNKNOWN';

export type InitializePaymentInput = {
  amount: number;
  currency: 'XAF';
  email: string;
  customerName: string;
  description: string;
  reference: string;
  callback?: string;
};

export type InitializedPayment = {
  providerTransactionId: string;
  authorizationUrl: string;
  providerStatus: string | null;
};

export type RetrievedPayment = {
  providerTransactionId: string;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  status: ProviderPaymentStatus;
  providerStatus: string | null;
};

export type PaymentWebhookEvent = {
  type: string;
  status: ProviderPaymentStatus;
  providerTransactionId: string | null;
  reference: string | null;
};

/** En-têtes HTTP tels que Node les expose (noms en minuscules). */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * Contrat d'un prestataire de paiement (adaptateur). Toute la logique métier
 * (activation, verrou tenant, idempotence, réconciliation) vit dans
 * SubscriptionPaymentsService et ne dépend que de ce contrat.
 * Ajouter un prestataire = un adaptateur + son entrée dans PAYMENT_PROVIDERS
 * (subscription.module.ts) + la suite `describePaymentProviderContract`.
 */
export interface PaymentProvider {
  /** Identifiant stable : stocké sur chaque paiement et utilisé dans `/webhooks/:provider`. */
  readonly name: string;
  initializePayment(input: InitializePaymentInput): Promise<InitializedPayment>;
  /** Statut faisant foi, lu chez le prestataire (jamais déduit du webhook ou de l'URL de retour). */
  retrievePayment(providerTransactionId: string): Promise<RetrievedPayment>;
  /** Authentifie la notification (signature, jeton…) à partir du corps brut et des en-têtes. */
  verifyWebhook(rawBody: Buffer, headers: WebhookHeaders): boolean;
  parseWebhook(payload: unknown): PaymentWebhookEvent;
}
