import type { PaymentProvider, ProviderPaymentStatus, WebhookHeaders } from './payment-provider';

const STATUSES: ProviderPaymentStatus[] = ['PENDING', 'COMPLETE', 'FAILED', 'CANCELED', 'EXPIRED', 'UNKNOWN'];

/**
 * Ce que chaque adaptateur doit fournir à la suite de contrat : des exemples RÉELS
 * (copiés de la documentation ou de la sandbox du prestataire), pas inventés.
 */
export type PaymentProviderContractFixture = {
  /** Adaptateur configuré (variables d'environnement de test posées par l'appelant). */
  create: () => PaymentProvider;
  /** Webhook « paiement réussi » authentifié : corps brut, en-têtes, et corps tel que parsé par Nest. */
  signedCompleteWebhook: () => { rawBody: Buffer; headers: WebhookHeaders; payload: unknown };
  /** Identifiants attendus après parseWebhook du webhook ci-dessus. */
  expectedIdentifiers: { providerTransactionId: string | null; reference: string | null };
};

/**
 * Suite de contrat partagée : tout adaptateur de PaymentProvider doit la passer
 * (`describePaymentProviderContract('cinetpay', fixture)` dans son propre .spec.ts).
 * Elle fige ce dont SubscriptionPaymentsService dépend, pas les détails du prestataire.
 */
export function describePaymentProviderContract(label: string, fixture: PaymentProviderContractFixture) {
  describe(`PaymentProvider contract — ${label}`, () => {
    it('exposes a stable, URL-safe name (used in /webhooks/:provider and stored on payments)', () => {
      expect(fixture.create().name).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it('accepts a correctly authenticated webhook', () => {
      const { rawBody, headers } = fixture.signedCompleteWebhook();
      expect(fixture.create().verifyWebhook(rawBody, headers)).toBe(true);
    });

    it('rejects a webhook without authentication headers', () => {
      const { rawBody } = fixture.signedCompleteWebhook();
      expect(fixture.create().verifyWebhook(rawBody, {})).toBe(false);
    });

    it('rejects a tampered body', () => {
      const { rawBody, headers } = fixture.signedCompleteWebhook();
      const tampered = Buffer.concat([rawBody, Buffer.from(' ')]);
      expect(fixture.create().verifyWebhook(tampered, headers)).toBe(false);
    });

    it('parses the completed webhook into a normalized event with our identifiers', () => {
      const { payload } = fixture.signedCompleteWebhook();
      const event = fixture.create().parseWebhook(payload);
      expect(event.status).toBe('COMPLETE');
      expect(STATUSES).toContain(event.status);
      expect(event.providerTransactionId ?? event.reference).toBeTruthy();
      expect({ providerTransactionId: event.providerTransactionId, reference: event.reference }).toEqual(
        fixture.expectedIdentifiers,
      );
    });

    it('refuses an unusable webhook payload instead of guessing', () => {
      expect(() => fixture.create().parseWebhook({})).toThrow();
      expect(() => fixture.create().parseWebhook(null)).toThrow();
    });
  });
}
