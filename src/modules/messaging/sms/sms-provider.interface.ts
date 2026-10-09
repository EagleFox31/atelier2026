import type { CameroonOperator } from '../shared/phone';

/**
 * Contrat d'un fournisseur SMS (simulateur, Techsoft, SmsPro…).
 *
 * Les modules métier n'importent jamais un fournisseur : ils mettent un job en
 * file `sms-notifications`, et `SmsProcessor` appelle l'implémentation injectée
 * via le jeton `SMS_PROVIDER` (choisie par la variable `SMS_PROVIDER`).
 *
 * Erreurs : une implémentation lève UNIQUEMENT `PermanentMessagingError` ou
 * `TemporaryMessagingError` (voir `messaging.errors.ts`). Toute autre erreur est
 * traitée comme temporaire par les consommateurs.
 */
export interface SmsProvider {
  /** Nom stable du fournisseur (valeur de `SMS_PROVIDER`), stocké pour le suivi. */
  readonly name: string;

  /**
   * `true` si aucun message ne quitte le serveur (simulateur) : un envoi
   * « réussi » est alors enregistré `SIMULATED`, jamais compté comme envoyé.
   */
  readonly simulated: boolean;

  sendSms(request: SendSmsRequest): Promise<SendSmsResult>;

  /** Statut de remise (DLR) d'un message déjà accepté — par interrogation. */
  getDeliveryStatus(providerMessageId: string): Promise<SmsDeliveryStatus>;

  /** Solde de crédits, si le fournisseur l'expose. */
  getBalance?(): Promise<SmsBalance>;

  /** Vérifie qu'un nom d'expéditeur est utilisable chez le fournisseur. */
  validateSender?(senderId: string): Promise<SenderValidation>;
}

export type SendSmsRequest = {
  /** Destinataire au format E.164 (`+2376XXXXXXXX`), déjà normalisé par l'appelant. */
  to: string;
  text: string;
  /** Nom d'expéditeur ; à défaut, celui configuré pour le fournisseur. */
  senderId?: string;
  /**
   * Clé stable par envoi logique (id de notification ou de job) : un nouvel
   * essai du même job réutilise la même clé, pour que le fournisseur — s'il le
   * permet — ignore un doublon.
   */
  idempotencyKey: string;
};

/** État au moment où le fournisseur a accepté le message. */
export type SmsAcceptedStatus = 'QUEUED' | 'SENT' | 'DELIVERED';

export type SendSmsResult = {
  /** Identifiant du message chez le fournisseur (stocké dans `gatewayRef`). */
  providerMessageId: string;
  status: SmsAcceptedStatus;
  operator?: CameroonOperator;
};

export type SmsDeliveryStatus = {
  status: SmsAcceptedStatus | 'FAILED' | 'UNKNOWN';
  deliveredAt?: Date;
  /** Code d'erreur fournisseur, sans donnée sensible. */
  errorCode?: string;
};

export type SmsBalance = {
  /** Crédits SMS restants ; `null` si inconnu. */
  smsCredits: number | null;
  expiresAt?: Date;
};

export type SenderValidation = { valid: boolean; reason?: string };
