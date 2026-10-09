import type { CustomerNotificationInput } from '../customer-notification.emitter';

type Builder = () => Promise<CustomerNotificationInput | null>;

/**
 * Double de test de `CustomerNotificationEmitter` pour les services métier :
 * enregistre les émissions en arrière-plan sans base ni file.
 */
export class RecordingCustomerNotificationEmitter {
  readonly builds: Array<{ label: string; build: Builder }> = [];

  emitInBackground(label: string, build: Builder): void {
    this.builds.push({ label, build });
  }

  /** Notifications effectivement construites (les `null` sont écartés). */
  async inputs(): Promise<CustomerNotificationInput[]> {
    const built = await Promise.all(this.builds.map(({ build }) => build()));
    return built.filter((input): input is CustomerNotificationInput => input !== null);
  }
}
