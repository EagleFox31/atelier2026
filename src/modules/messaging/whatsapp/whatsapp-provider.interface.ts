/**
 * Contrat d'un fournisseur WhatsApp — interface seule pour l'instant.
 *
 * Aucun fournisseur réel ni webhook entrant n'est branché (issue #22 : choix
 * entre WhatsApp Cloud API officielle et Techsoft à confirmer). Les erreurs
 * suivent le même modèle que le SMS (`messaging.errors.ts`).
 */
export interface WhatsAppProvider {
  readonly name: string;

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
  idempotencyKey: string;
};

export type SendWhatsAppResult = {
  providerMessageId: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ';
};
