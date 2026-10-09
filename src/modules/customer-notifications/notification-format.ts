/**
 * Mise en forme des variables de modèle WhatsApp (heure de Douala, montants XAF).
 * Pas de `toLocaleString('fr-FR')` pour les montants : il insère des espaces
 * insécables que les modèles Meta et les PDF rendent mal.
 */
export const NOTIFICATION_TIME_ZONE = 'Africa/Douala';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: NOTIFICATION_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: NOTIFICATION_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `09/10/2026` */
export function formatNotificationDate(date: Date): string {
  return dateFormat.format(date);
}

/** `14:30` */
export function formatNotificationTime(date: Date): string {
  return timeFormat.format(date);
}

/** `125 000 FCFA` (espaces ordinaires). */
export function formatNotificationAmount(amountXaf: number | string | { toString(): string }): string {
  const value = Math.round(Number(amountXaf.toString()));
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

type CustomerNameSource = {
  customerType?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/** Raison sociale pour une entreprise, sinon prénom + nom ; chaîne vide si rien. */
export function customerDisplayName(customer: CustomerNameSource): string {
  if (customer.customerType === 'COMPANY' && customer.companyName?.trim()) {
    return customer.companyName.trim();
  }
  const name = [customer.firstName, customer.lastName].filter((part) => part?.trim()).join(' ').trim();
  return name || customer.companyName?.trim() || '';
}
