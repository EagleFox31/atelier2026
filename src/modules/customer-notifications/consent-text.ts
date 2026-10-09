/**
 * Texte lu ou montré au client avant d'enregistrer son accord WhatsApp.
 * Toute modification du texte = nouvelle version : chaque événement du journal
 * garde la version à laquelle le client a répondu (preuve).
 */
export const WHATSAPP_CONSENT_TEXT = {
  version: 'whatsapp-fr-v1',
  text:
    'J’accepte de recevoir sur WhatsApp les messages de suivi de mon garage : '
    + 'confirmations et rappels de rendez-vous, devis à valider, véhicule prêt, factures et paiements. '
    + 'Aucun message publicitaire. Je peux retirer mon accord à tout moment auprès du garage.',
} as const;
