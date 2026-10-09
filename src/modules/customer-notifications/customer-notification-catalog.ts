import { CustomerNotificationEvent } from '@prisma/client';

/**
 * Catalogue des notifications client : un événement métier = un modèle WhatsApp.
 *
 * Source unique pour : défaut d'activation par garage, nom et version du modèle
 * Meta (catégorie UTILITY), variables positionnelles dans l'ordre déclaré chez Meta.
 * Ajouter un événement = une entrée ici + la valeur d'enum Prisma ; le moteur suit.
 */
export type NotificationVariable =
  | 'customerName'
  | 'garageName'
  | 'date'
  | 'time'
  | 'plate'
  | 'orderNumber'
  | 'quoteNumber'
  | 'invoiceNumber'
  | 'amount';

export type CatalogEntry = {
  /** Activé par défaut pour un garage sans ligne `garage_notification_settings`. */
  defaultEnabled: boolean;
  /** Base du nom de modèle Meta ; le nom complet est `am_<base>_v<version>`. */
  templateBase: string;
  templateVersion: number;
  /** Variables du modèle, dans l'ordre `{{1}}`, `{{2}}`… */
  variables: readonly NotificationVariable[];
};

export const NOTIFICATION_CATALOG: Record<CustomerNotificationEvent, CatalogEntry> = {
  APPOINTMENT_CONFIRMED: {
    defaultEnabled: true,
    templateBase: 'appointment_confirmed',
    templateVersion: 1,
    variables: ['customerName', 'garageName', 'date', 'time'],
  },
  APPOINTMENT_REMINDER: {
    defaultEnabled: true,
    templateBase: 'appointment_reminder',
    templateVersion: 1,
    variables: ['customerName', 'garageName', 'date', 'time'],
  },
  SERVICE_ORDER_RECEIVED: {
    defaultEnabled: false,
    templateBase: 'service_order_received',
    templateVersion: 1,
    variables: ['customerName', 'garageName', 'plate', 'orderNumber'],
  },
  QUOTE_APPROVAL_REQUESTED: {
    defaultEnabled: true,
    templateBase: 'quote_approval',
    templateVersion: 1,
    variables: ['customerName', 'garageName', 'quoteNumber', 'amount'],
  },
  VEHICLE_READY: {
    defaultEnabled: true,
    templateBase: 'vehicle_ready',
    templateVersion: 1,
    variables: ['customerName', 'plate', 'garageName'],
  },
  INVOICE_AVAILABLE: {
    defaultEnabled: true,
    templateBase: 'invoice_available',
    templateVersion: 1,
    variables: ['customerName', 'invoiceNumber', 'amount', 'garageName'],
  },
  INVOICE_PAYMENT_REMINDER: {
    defaultEnabled: true,
    templateBase: 'invoice_reminder',
    templateVersion: 1,
    variables: ['customerName', 'invoiceNumber', 'amount', 'garageName'],
  },
  PAYMENT_CONFIRMED: {
    defaultEnabled: true,
    templateBase: 'payment_confirmed',
    templateVersion: 1,
    variables: ['customerName', 'amount', 'invoiceNumber', 'garageName'],
  },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'fr';

export function templateName(event: CustomerNotificationEvent): string {
  const entry = NOTIFICATION_CATALOG[event];
  return `am_${entry.templateBase}_v${entry.templateVersion}`;
}

/** Langues candidates : celle du client, puis le français. */
export function templateLanguages(customerLang: string | null | undefined): string[] {
  const lang = customerLang?.trim().toLowerCase();
  return lang && lang !== DEFAULT_TEMPLATE_LANGUAGE ? [lang, DEFAULT_TEMPLATE_LANGUAGE] : [DEFAULT_TEMPLATE_LANGUAGE];
}

export class MissingNotificationVariableError extends Error {
  constructor(readonly event: CustomerNotificationEvent, readonly missing: NotificationVariable[]) {
    super(`Variables manquantes pour ${event} : ${missing.join(', ')}`);
    this.name = 'MissingNotificationVariableError';
  }
}

/**
 * Règle Meta (erreur 132018) : une variable ne contient ni saut de ligne, ni
 * tabulation, ni plus de 4 espaces consécutifs.
 */
export function sanitizeTemplateVariable(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

/** Variables positionnelles du modèle ; échec immédiat si l'une manque (bug de l'émetteur). */
export function orderedTemplateVariables(
  event: CustomerNotificationEvent,
  variables: Partial<Record<NotificationVariable, string>>,
): string[] {
  const keys = NOTIFICATION_CATALOG[event].variables;
  const values = keys.map((key) => sanitizeTemplateVariable(variables[key] ?? ''));
  const missing = keys.filter((_, index) => values[index] === '');
  if (missing.length > 0) throw new MissingNotificationVariableError(event, missing);
  return values;
}
