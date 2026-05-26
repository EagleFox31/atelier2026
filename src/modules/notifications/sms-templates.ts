export const SMS_TEMPLATES: Record<string, Record<string, string>> = {
  VEHICLE_READY: {
    fr: 'Votre véhicule est prêt à être récupéré à l\'atelier. Merci pour votre confiance.',
    en: 'Your vehicle is ready for pickup at the workshop. Thank you for your trust.',
  },
};

export function resolveSmsMessage(templateCode: string, lang: string, fallback?: string): string {
  const fromTemplate = SMS_TEMPLATES[templateCode]?.[lang] ?? SMS_TEMPLATES[templateCode]?.fr;
  if (fromTemplate) return fromTemplate;
  if (fallback) return fallback;
  throw new Error(`Modèle SMS inconnu : ${templateCode}`);
}
