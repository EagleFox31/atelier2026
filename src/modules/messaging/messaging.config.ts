import { Logger } from '@nestjs/common';
import { SimulatorSmsProvider } from './sms/simulator-sms.provider';
import type { SmsProvider } from './sms/sms-provider.interface';
import { SmsToSmsProvider } from './sms/smsto-sms.provider';
import { WhatsAppCloudApiProvider } from './whatsapp/cloud-api-whatsapp.provider';
import { SimulatorWhatsAppProvider } from './whatsapp/simulator-whatsapp.provider';
import type { WhatsAppProvider } from './whatsapp/whatsapp-provider.interface';

/**
 * Sélection du fournisseur par configuration (`SMS_PROVIDER`, `WHATSAPP_PROVIDER`).
 *
 * Ajouter un fournisseur (#19 Techsoft, #20 SmsPro…) = ajouter une entrée dans
 * le registre ci-dessous ; aucun module métier ne change. Chaque adaptateur lit
 * ses propres secrets dans l'environnement (SSM en prod) et doit échouer au
 * démarrage s'ils manquent.
 *
 * Valeur inconnue → erreur au démarrage (fail-fast) plutôt qu'un repli
 * silencieux sur le simulateur, qui « réussirait » sans rien envoyer.
 */
const SMS_PROVIDERS: Record<string, (env: NodeJS.ProcessEnv) => SmsProvider> = {
  simulator: () => new SimulatorSmsProvider(),
  smsto: (env) => SmsToSmsProvider.fromEnv(env),
};

const WHATSAPP_PROVIDERS: Record<string, (env: NodeJS.ProcessEnv) => WhatsAppProvider> = {
  simulator: () => new SimulatorWhatsAppProvider(),
  'whatsapp-cloud': (env) => WhatsAppCloudApiProvider.fromEnv(env),
};

export const DEFAULT_PROVIDER = 'simulator';

export const SUPPORTED_SMS_PROVIDERS = Object.keys(SMS_PROVIDERS);
export const SUPPORTED_WHATSAPP_PROVIDERS = Object.keys(WHATSAPP_PROVIDERS);

export class MessagingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingConfigurationError';
  }
}

function selectProvider<T>(
  variable: string,
  registry: Record<string, (env: NodeJS.ProcessEnv) => T>,
  env: NodeJS.ProcessEnv,
): { name: string; provider: T } {
  const name = (env[variable]?.trim() || DEFAULT_PROVIDER).toLowerCase();
  const factory = Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : undefined;
  if (!factory) {
    throw new MessagingConfigurationError(
      `${variable}="${name}" n'est pas un fournisseur connu. ` +
        `Valeurs acceptées : ${Object.keys(registry).join(', ')}. ` +
        `Corriger la variable d'environnement (SSM /atelier-maitre/prod/env en production) ou la retirer pour utiliser "${DEFAULT_PROVIDER}".`,
    );
  }
  return { name, provider: factory(env) };
}

const logger = new Logger('MessagingModule');

function warnIfSimulatedInProduction(channel: string, name: string, env: NodeJS.ProcessEnv): void {
  if (name === DEFAULT_PROVIDER && env.NODE_ENV === 'production') {
    logger.warn(`${channel} : fournisseur "${DEFAULT_PROVIDER}" — aucun message réel ne sera envoyé.`);
  }
}

export function createSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const { name, provider } = selectProvider('SMS_PROVIDER', SMS_PROVIDERS, env);
  warnIfSimulatedInProduction('SMS', name, env);
  return provider;
}

export function createWhatsAppProvider(env: NodeJS.ProcessEnv = process.env): WhatsAppProvider {
  const { name, provider } = selectProvider('WHATSAPP_PROVIDER', WHATSAPP_PROVIDERS, env);
  warnIfSimulatedInProduction('WhatsApp', name, env);
  return provider;
}
