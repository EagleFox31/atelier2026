/**
 * Contrat d'un fournisseur WhatsApp — interface seule pour l'instant.
 *
 * Aucun fournisseur réel ni webhook entrant n'est branché (issue #22 : choix
 * entre WhatsApp Cloud API officielle et Techsoft à confirmer). Les erreurs
 * suivent le même modèle que le SMS (`messaging.errors.ts`).
 */
export interface WhatsAppProvider {
  readonly name: string;

  /** `true` si aucun message ne quitte le serveur (simulateur) → statut `SIMULATED`. */
  readonly simulated: boolean;

  /**
   * Compte émetteur chez le fournisseur (ex. `phone_number_id` Meta), jamais un secret.
   * Sert à rattacher les accusés de remise au bon compte. Absent = compte unique de la plateforme.
   */
  readonly accountRef?: string;

  /** Message libre (autorisé uniquement dans une fenêtre de conversation ouverte chez Meta). */
  sendWhatsAppMessage(request: SendWhatsAppMessageRequest): Promise<SendWhatsAppResult>;

  /** Message à partir d'un modèle pré-approuvé (notifications sortantes). */
  sendTemplate(request: SendWhatsAppTemplateRequest): Promise<SendWhatsAppResult>;
}

export type SendWhatsAppMessageRequest = {
  /** Destinataire E.164. */
  to: string;
  text: string;
  idempotencyKey: string;
};

export type SendWhatsAppTemplateRequest = {
  to: string;
  templateName: string;
  /** Code langue du modèle (`fr`, `en`). */
  language: string;
  /** Variables positionnelles du modèle, dans l'ordre. */
  variables: string[];
  /** Boutons URL dynamiques du modèle (ex. lien de devis), dans l'ordre de déclaration chez Meta. */
  buttons?: WhatsAppTemplateUrlButton[];
  idempotencyKey: string;
};

/**
 * Bouton « URL » d'un modèle : seul le suffixe variable est envoyé (`{{1}}` de
 * l'URL déclarée chez Meta), jamais l'URL complète.
 */
export type WhatsAppTemplateUrlButton = {
  /** Position du bouton dans le modèle (0 à 9). */
  index: number;
  /** Partie variable de l'URL (ex. jeton opaque du lien de devis). */
  urlSuffix: string;
};

export type SendWhatsAppResult = {
  providerMessageId: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ';
};
