/** Types et libellés des notifications client (contrat : src/modules/customer-notifications). */

export type CustomerNotificationEvent =
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_REMINDER'
  | 'SERVICE_ORDER_RECEIVED'
  | 'QUOTE_APPROVAL_REQUESTED'
  | 'VEHICLE_READY'
  | 'INVOICE_AVAILABLE'
  | 'INVOICE_PAYMENT_REMINDER'
  | 'PAYMENT_CONFIRMED';

export type CustomerNotificationStatus =
  | 'PENDING' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED' | 'SIMULATED';

export type ConsentStatus = 'GRANTED' | 'REVOKED';
export type ConsentSource = 'IN_PERSON' | 'SIGNED_FORM' | 'PHONE_CALL' | 'CUSTOMER_MESSAGE';

export interface ConsentEvent {
  id: string;
  action: ConsentStatus;
  phoneE164: string;
  source: ConsentSource;
  consentTextVersion: string;
  note: string | null;
  occurredAt: string;
  recordedBy: { firstName: string; lastName: string } | null;
}

export interface ChannelConsent {
  channel: 'WHATSAPP' | 'SMS';
  status: ConsentStatus;
  phoneE164: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
  events: ConsentEvent[];
}

export interface CustomerConsents {
  consentText: { version: string; text: string };
  consents: ChannelConsent[];
}

export interface RecordConsentBody {
  status: ConsentStatus;
  source: ConsentSource;
  phone?: string;
  note?: string;
}

export interface CustomerNotificationRow {
  id: string;
  eventType: CustomerNotificationEvent;
  channel: 'WHATSAPP' | 'SMS' | null;
  status: CustomerNotificationStatus;
  skipReason: string | null;
  recipientE164: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  acceptedAt: string | null;
  failedAt: string | null;
}

export interface NotificationPreference {
  eventType: CustomerNotificationEvent;
  enabled: boolean;
  defaultEnabled: boolean;
}

export const EVENT_LABELS: Record<CustomerNotificationEvent, { label: string; hint: string }> = {
  APPOINTMENT_CONFIRMED:    { label: 'Rendez-vous confirmé',      hint: 'À la création ou au déplacement d’un rendez-vous.' },
  APPOINTMENT_REMINDER:     { label: 'Rappel de rendez-vous',     hint: 'La veille du rendez-vous.' },
  SERVICE_ORDER_RECEIVED:   { label: 'Véhicule pris en charge',   hint: 'Quand l’ordre de travail passe en réception.' },
  QUOTE_APPROVAL_REQUESTED: { label: 'Devis à valider',           hint: 'À l’envoi d’un devis, avec un lien sécurisé.' },
  VEHICLE_READY:            { label: 'Véhicule prêt',             hint: 'Quand l’ordre de travail passe à « Prêt ».' },
  INVOICE_AVAILABLE:        { label: 'Facture disponible',        hint: 'À l’émission de la facture.' },
  INVOICE_PAYMENT_REMINDER: { label: 'Relance de facture',        hint: 'Facture impayée : J+7 puis J+15.' },
  PAYMENT_CONFIRMED:        { label: 'Paiement reçu',             hint: 'À l’enregistrement d’un paiement confirmé.' },
};

export const STATUS_LABELS: Record<CustomerNotificationStatus, { label: string; className: string }> = {
  PENDING:   { label: 'En attente',          className: 'bg-slate-100 text-slate-700' },
  ACCEPTED:  { label: 'Accepté par WhatsApp', className: 'bg-blue-100 text-blue-800' },
  SENT:      { label: 'Envoyé',              className: 'bg-blue-100 text-blue-800' },
  DELIVERED: { label: 'Remis',               className: 'bg-emerald-100 text-emerald-800' },
  READ:      { label: 'Lu',                  className: 'bg-emerald-100 text-emerald-800' },
  FAILED:    { label: 'Échec',               className: 'bg-red-100 text-red-800' },
  SKIPPED:   { label: 'Non envoyé',          className: 'bg-amber-100 text-amber-800' },
  SIMULATED: { label: 'Simulé (non envoyé)', className: 'bg-violet-100 text-violet-800' },
};

/** Raisons de `resolveDispatch` (src/modules/customer-notifications/resolve-dispatch.ts). */
export const SKIP_REASON_LABELS: Record<string, string> = {
  MODE_OFF: 'Notifications désactivées sur la plateforme',
  DISABLED_BY_GARAGE: 'Désactivé dans les paramètres du garage',
  NOT_ENTITLED: 'Forfait sans WhatsApp',
  STALE: 'Plus d’actualité (objet modifié ou annulé)',
  NO_CONSENT: 'Pas de consentement WhatsApp',
  TEMPLATE_NOT_APPROVED: 'Modèle de message non approuvé',
  SANDBOX_RECIPIENT_NOT_ALLOWED: 'Numéro hors liste de test',
  QUOTA_EXCEEDED: 'Plafond mensuel atteint',
};

export const SOURCE_LABELS: Record<ConsentSource, string> = {
  IN_PERSON: 'Au comptoir',
  SIGNED_FORM: 'Formulaire signé',
  PHONE_CALL: 'Par téléphone',
  CUSTOMER_MESSAGE: 'Message du client',
};
