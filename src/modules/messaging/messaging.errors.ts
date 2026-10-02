/**
 * Modèle d'erreur commun à tous les fournisseurs de messagerie (SMS, WhatsApp).
 *
 * Chaque adaptateur traduit les erreurs propres à son fournisseur dans l'une
 * des deux familles ci-dessous. Le consommateur (ex. `SmsProcessor`) n'a alors
 * qu'une décision à prendre :
 *   - `PermanentMessagingError` → réessayer ne changera rien : échec définitif
 *     (BullMQ `UnrecoverableError`, notification FAILED) ;
 *   - `TemporaryMessagingError` → panne passagère : on relance l'erreur pour
 *     que BullMQ réessaie (nombre de tentatives borné par le job).
 *
 * Règle de sécurité : le `message` d'une erreur peut être stocké en base et
 * journalisé. Il ne doit JAMAIS contenir de secret (token, clé), ni le corps du
 * message envoyé, ni le numéro complet du destinataire.
 */

/** Échecs définitifs : le même envoi échouera toujours. */
export type PermanentMessagingErrorCode =
  | 'INVALID_RECIPIENT' // numéro invalide, inconnu, liste noire
  | 'SENDER_REJECTED' // nom d'expéditeur refusé / non provisionné
  | 'INSUFFICIENT_CREDIT' // solde fournisseur épuisé
  | 'CONTENT_REJECTED' // contenu refusé (spam, type de message invalide)
  | 'PROVIDER_CONFIGURATION'; // token invalide, scope manquant, abonnement inactif

/** Échecs passagers : un nouvel essai plus tard peut réussir. */
export type TemporaryMessagingErrorCode =
  | 'TIMEOUT' // délai dépassé
  | 'UNAVAILABLE' // 5xx, erreur réseau, route momentanément indisponible
  | 'RATE_LIMITED'; // 429 / limite de débit

export type MessagingErrorCode = PermanentMessagingErrorCode | TemporaryMessagingErrorCode;

export abstract class MessagingError extends Error {
  abstract readonly permanent: boolean;

  protected constructor(
    readonly code: MessagingErrorCode,
    message: string,
    /** Nom du fournisseur à l'origine de l'erreur (ex. `simulator`). */
    readonly provider: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PermanentMessagingError extends MessagingError {
  readonly permanent = true;

  constructor(code: PermanentMessagingErrorCode, message: string, provider: string) {
    super(code, message, provider);
  }
}

export class TemporaryMessagingError extends MessagingError {
  readonly permanent = false;

  constructor(
    code: TemporaryMessagingErrorCode,
    message: string,
    provider: string,
    /** Indication du fournisseur (en-tête Retry-After…), informative. */
    readonly retryAfterMs?: number,
  ) {
    super(code, message, provider);
  }
}

export function isPermanentMessagingError(error: unknown): error is PermanentMessagingError {
  return error instanceof MessagingError && error.permanent;
}
