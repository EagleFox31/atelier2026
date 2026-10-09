/**
 * Clés d'idempotence des notifications client (uniques par garage).
 * Seul endroit où elles sont construites : un émetteur n'écrit jamais une clé à la main.
 */
const epoch = (date: Date) => Math.floor(date.getTime() / 1000);

export const notificationKeys = {
  appointmentConfirmed: (appointmentId: string, scheduledAt: Date) =>
    `appointment.confirmed:${appointmentId}:${epoch(scheduledAt)}`,
  appointmentReminder: (appointmentId: string, scheduledAt: Date) =>
    `appointment.reminder:${appointmentId}:${epoch(scheduledAt)}`,
  serviceOrderReceived: (serviceOrderId: string) => `ot.received:${serviceOrderId}`,
  quoteSent: (quoteId: string, revision: number) => `quote.sent:${quoteId}:r${revision}`,
  vehicleReady: (serviceOrderId: string, version: number) => `ot.ready:${serviceOrderId}:v${version}`,
  invoiceIssued: (invoiceId: string) => `invoice.issued:${invoiceId}`,
  invoiceReminder: (invoiceId: string, step: number) => `invoice.reminder:${invoiceId}:s${step}`,
  paymentConfirmed: (paymentId: string) => `payment.confirmed:${paymentId}`,
};

/** Horaire du RDV encodé dans la clé (secondes epoch), ou `null` si la clé n'en porte pas. */
export function scheduledEpochFromKey(idempotencyKey: string): number | null {
  const match = /^appointment\.(?:confirmed|reminder):[^:]+:(\d+)$/.exec(idempotencyKey);
  return match ? Number(match[1]) : null;
}

export function epochSeconds(date: Date): number {
  return epoch(date);
}
