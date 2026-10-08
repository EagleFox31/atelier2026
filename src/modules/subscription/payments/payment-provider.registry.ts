import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider';

export const DEFAULT_PAYMENT_PROVIDER = 'notchpay';
/** Surcharge du prestataire actif (tests) ; sinon `PAYMENT_PROVIDER`. */
export const ACTIVE_PAYMENT_PROVIDER = Symbol('ACTIVE_PAYMENT_PROVIDER');

/**
 * Registre des adaptateurs de paiement.
 * - `active()` : prestataire des NOUVEAUX checkouts, choisi par `PAYMENT_PROVIDER`
 *   (défaut `notchpay`). Valeur inconnue = échec au démarrage, jamais un repli silencieux.
 * - `get(name)` : prestataire d'un paiement EXISTANT ou d'un webhook. Les anciens
 *   prestataires restent enregistrés après un changement, pour finir leurs paiements.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();
  private readonly activeName: string;

  constructor(
    @Inject(PAYMENT_PROVIDERS) providers: PaymentProvider[],
    @Optional() @Inject(ACTIVE_PAYMENT_PROVIDER) activeName?: string,
  ) {
    for (const provider of providers) {
      if (this.providers.has(provider.name)) {
        throw new Error(`Prestataire de paiement enregistré deux fois : ${provider.name}`);
      }
      this.providers.set(provider.name, provider);
    }
    this.activeName = (activeName ?? process.env.PAYMENT_PROVIDER)?.trim().toLowerCase() || DEFAULT_PAYMENT_PROVIDER;
    if (!this.providers.has(this.activeName)) {
      throw new Error(
        `PAYMENT_PROVIDER=${this.activeName} inconnu. Valeurs possibles : ${this.names().join(', ')}`,
      );
    }
  }

  /** Registre à un seul prestataire (tests, scripts). */
  static of(...providers: PaymentProvider[]): PaymentProviderRegistry {
    return new PaymentProviderRegistry(providers, providers[0]?.name);
  }

  active(): PaymentProvider {
    return this.providers.get(this.activeName)!;
  }

  find(name: string): PaymentProvider | undefined {
    return this.providers.get(name);
  }

  /** 404 pour un prestataire inconnu (route webhook publique). */
  get(name: string): PaymentProvider {
    const provider = this.find(name);
    if (!provider) {
      throw new NotFoundException({
        message: 'Prestataire de paiement inconnu.',
        errorCode: 'PAYMENT_PROVIDER_UNKNOWN',
      });
    }
    return provider;
  }

  names(): string[] {
    return [...this.providers.keys()];
  }
}
