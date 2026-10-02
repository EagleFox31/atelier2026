import {
  PermanentMessagingError,
  TemporaryMessagingError,
  type PermanentMessagingErrorCode,
  type TemporaryMessagingErrorCode,
} from '../messaging.errors';
import type {
  SendSmsRequest,
  SendSmsResult,
  SmsDeliveryStatus,
  SmsProvider,
} from '../sms/sms-provider.interface';

type Outcome =
  | { kind: 'success'; result?: Partial<SendSmsResult> }
  | { kind: 'permanent'; code: PermanentMessagingErrorCode }
  | { kind: 'temporary'; code: TemporaryMessagingErrorCode }
  | { kind: 'error'; error: unknown };

/**
 * Faux fournisseur SMS pour les tests : enregistre chaque requête et rejoue le
 * résultat programmé (succès, échec définitif, échec temporaire, erreur brute).
 * Réservé aux tests — jamais enregistré dans le registre de `messaging.config.ts`.
 */
export class FakeSmsProvider implements SmsProvider {
  readonly name = 'fake';
  readonly sent: SendSmsRequest[] = [];
  private queue: Outcome[] = [];
  private fallback: Outcome = { kind: 'success' };

  /** Comportement par défaut pour tous les envois suivants. */
  always(outcome: Outcome): this {
    this.fallback = outcome;
    return this;
  }

  /** Comportement du prochain envoi uniquement (FIFO). */
  next(outcome: Outcome): this {
    this.queue.push(outcome);
    return this;
  }

  failPermanently(code: PermanentMessagingErrorCode = 'INVALID_RECIPIENT'): this {
    return this.always({ kind: 'permanent', code });
  }

  failTemporarily(code: TemporaryMessagingErrorCode = 'UNAVAILABLE'): this {
    return this.always({ kind: 'temporary', code });
  }

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    this.sent.push(request);
    const outcome = this.queue.shift() ?? this.fallback;
    switch (outcome.kind) {
      case 'permanent':
        throw new PermanentMessagingError(outcome.code, `Échec définitif simulé (${outcome.code}).`, this.name);
      case 'temporary':
        throw new TemporaryMessagingError(outcome.code, `Échec temporaire simulé (${outcome.code}).`, this.name);
      case 'error':
        throw outcome.error;
      default:
        return {
          providerMessageId: `fake-${this.sent.length}`,
          status: 'SENT',
          operator: 'ORANGE_CM',
          ...outcome.result,
        };
    }
  }

  async getDeliveryStatus(): Promise<SmsDeliveryStatus> {
    return { status: 'DELIVERED' };
  }
}
