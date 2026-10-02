import { Module } from '@nestjs/common';
import { createSmsProvider, createWhatsAppProvider } from './messaging.config';
import { SMS_PROVIDER, WHATSAPP_PROVIDER } from './messaging.tokens';

/**
 * Couche d'abstraction des fournisseurs de messagerie (issue #18).
 *
 * Expose `SMS_PROVIDER` et `WHATSAPP_PROVIDER` ; l'implémentation est choisie au
 * démarrage d'après l'environnement (voir `messaging.config.ts`). Les fabriques
 * s'exécutent à l'initialisation du module : une configuration invalide empêche
 * l'API de démarrer, avec un message indiquant la correction.
 */
@Module({
  providers: [
    { provide: SMS_PROVIDER, useFactory: () => createSmsProvider() },
    { provide: WHATSAPP_PROVIDER, useFactory: () => createWhatsAppProvider() },
  ],
  exports: [SMS_PROVIDER, WHATSAPP_PROVIDER],
})
export class MessagingModule {}
