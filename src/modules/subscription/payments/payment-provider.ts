export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

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

export interface PaymentProvider {
  readonly name: string;
  initializePayment(input: InitializePaymentInput): Promise<InitializedPayment>;
  retrievePayment(reference: string): Promise<RetrievedPayment>;
  verifyWebhookSignature(rawPayload: Buffer, signature: string | undefined): boolean;
  parseWebhook(payload: unknown): PaymentWebhookEvent;
}
