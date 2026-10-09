import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from '../messaging';

export type WhatsAppSender = {
  provider: WhatsAppProvider;
  /** Référence du compte d'envoi (jamais un secret) : `platform` aujourd'hui. */
  accountRef: string;
};

export const PLATFORM_SENDER_REF = 'platform';

/**
 * Compte WhatsApp utilisé pour un garage. Aujourd'hui : le compte de la plateforme.
 * Plus tard : une référence de secret SSM par garage, jamais le token en base.
 */
@Injectable()
export class WhatsAppSenderResolver {
  constructor(@Inject(WHATSAPP_PROVIDER) private readonly platformProvider: WhatsAppProvider) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resolve(_garageId: string): Promise<WhatsAppSender> {
    return { provider: this.platformProvider, accountRef: PLATFORM_SENDER_REF };
  }
}
