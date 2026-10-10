import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from '../messaging';

export type WhatsAppSender = {
  provider: WhatsAppProvider;
  /**
   * Référence du compte d'envoi (jamais un secret) : le `phone_number_id` Meta du fournisseur,
   * ou `platform` s'il n'en expose pas. Les accusés du webhook ne sont rattachés qu'à ce compte.
   */
  accountRef: string;
};

/** Référence historique (lot 2) : lignes envoyées avant que le fournisseur expose son compte. */
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
    return { provider: this.platformProvider, accountRef: this.platformProvider.accountRef ?? PLATFORM_SENDER_REF };
  }

  /**
   * Références de compte sous lesquelles une ligne envoyée par ce numéro Meta a pu être
   * enregistrée. `platform` n'est accepté que si ce numéro est celui de la plateforme.
   */
  accountRefsFor(providerName: string, phoneNumberId: string): string[] {
    const platform = this.platformProvider;
    if (platform.name === providerName && platform.accountRef === phoneNumberId) {
      return [phoneNumberId, PLATFORM_SENDER_REF];
    }
    return [phoneNumberId];
  }
}
