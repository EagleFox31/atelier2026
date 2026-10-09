import { toE164 } from '../messaging/shared/phone';

/**
 * Configuration des notifications client, lue une fois au démarrage.
 * Fail-closed : une valeur inconnue ou un mode `live` incomplet empêche l'API de démarrer.
 */
export type CustomerNotificationsMode = 'off' | 'sandbox' | 'live';

export type CustomerNotificationsConfig = {
  mode: CustomerNotificationsMode;
  /** Destinataires E.164 autorisés en mode `sandbox`. */
  testRecipients: ReadonlySet<string>;
  /** Modèles approuvés chez Meta, sous la forme `nom:langue`. */
  approvedTemplates: ReadonlySet<string>;
  /** Plafond mensuel de messages par garage. */
  monthlyCap: number;
  /** Délai après lequel un message ACCEPTED sans accusé Meta est signalé (jamais renvoyé). */
  receiptTimeoutMinutes: number;
};

export const CUSTOMER_NOTIFICATIONS_CONFIG = Symbol('CUSTOMER_NOTIFICATIONS_CONFIG');

export const DEFAULT_MONTHLY_CAP = 300;
export const DEFAULT_RECEIPT_TIMEOUT_MINUTES = 30;
const MODES: readonly CustomerNotificationsMode[] = ['off', 'sandbox', 'live'];

export class CustomerNotificationsConfigurationError extends Error {
  constructor(message: string) {
    super(`${message} Corriger la variable (SSM /atelier-maitre/prod/env en production).`);
    this.name = 'CustomerNotificationsConfigurationError';
  }
}

export function approvedTemplateKey(name: string, language: string): string {
  return `${name}:${language}`.toLowerCase();
}

function parseList(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

export function loadCustomerNotificationsConfig(
  env: Record<string, string | undefined> = process.env,
): CustomerNotificationsConfig {
  const mode = (env.CUSTOMER_NOTIFICATIONS_MODE?.trim() || 'off').toLowerCase() as CustomerNotificationsMode;
  if (!MODES.includes(mode)) {
    throw new CustomerNotificationsConfigurationError(
      `CUSTOMER_NOTIFICATIONS_MODE="${mode}" inconnu. Valeurs acceptées : ${MODES.join(', ')}.`,
    );
  }

  const fallback = env.CUSTOMER_NOTIFICATIONS_SMS_FALLBACK?.trim().toLowerCase();
  if (fallback && fallback !== 'off') {
    throw new CustomerNotificationsConfigurationError(
      `CUSTOMER_NOTIFICATIONS_SMS_FALLBACK="${fallback}" refusé : seul "off" est pris en charge.`,
    );
  }

  const approvedTemplates = new Set<string>();
  for (const entry of parseList(env.WHATSAPP_APPROVED_TEMPLATES)) {
    const [name, language, ...rest] = entry.split(':').map((part) => part.trim());
    if (!name || !language || rest.length > 0) {
      throw new CustomerNotificationsConfigurationError(
        `WHATSAPP_APPROVED_TEMPLATES : entrée "${entry}" invalide (attendu nom:langue, ex. am_vehicle_ready_v1:fr).`,
      );
    }
    approvedTemplates.add(approvedTemplateKey(name, language));
  }

  const rawCap = env.CUSTOMER_NOTIFICATIONS_MONTHLY_CAP?.trim();
  const monthlyCap = rawCap ? Number(rawCap) : DEFAULT_MONTHLY_CAP;
  if (!Number.isInteger(monthlyCap) || monthlyCap < 0) {
    throw new CustomerNotificationsConfigurationError(
      `CUSTOMER_NOTIFICATIONS_MONTHLY_CAP="${rawCap}" invalide (entier positif ou nul attendu).`,
    );
  }

  const rawTimeout = env.CUSTOMER_NOTIFICATIONS_RECEIPT_TIMEOUT_MINUTES?.trim();
  const receiptTimeoutMinutes = rawTimeout ? Number(rawTimeout) : DEFAULT_RECEIPT_TIMEOUT_MINUTES;
  if (!Number.isInteger(receiptTimeoutMinutes) || receiptTimeoutMinutes < 5 || receiptTimeoutMinutes > 10_080) {
    throw new CustomerNotificationsConfigurationError(
      `CUSTOMER_NOTIFICATIONS_RECEIPT_TIMEOUT_MINUTES="${rawTimeout}" invalide (entier de 5 à 10080 attendu).`,
    );
  }

  const testRecipients = new Set<string>();
  for (const raw of parseList(env.WHATSAPP_TEST_RECIPIENTS)) {
    const e164 = toE164(raw);
    if (e164) testRecipients.add(e164);
  }

  if (mode === 'live') {
    const provider = env.WHATSAPP_PROVIDER?.trim().toLowerCase();
    if (provider !== 'whatsapp-cloud') {
      throw new CustomerNotificationsConfigurationError(
        'CUSTOMER_NOTIFICATIONS_MODE=live exige WHATSAPP_PROVIDER=whatsapp-cloud.',
      );
    }
    if (approvedTemplates.size === 0) {
      throw new CustomerNotificationsConfigurationError(
        'CUSTOMER_NOTIFICATIONS_MODE=live exige au moins un modèle dans WHATSAPP_APPROVED_TEMPLATES.',
      );
    }
    if (!rawCap) {
      throw new CustomerNotificationsConfigurationError(
        'CUSTOMER_NOTIFICATIONS_MODE=live exige un plafond explicite CUSTOMER_NOTIFICATIONS_MONTHLY_CAP.',
      );
    }
  }

  return { mode, testRecipients, approvedTemplates, monthlyCap, receiptTimeoutMinutes };
}
