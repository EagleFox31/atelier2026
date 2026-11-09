/**
 * Source unique du contenu commercial public d'Atelier Maître : forfaits, FAQ,
 * fonctionnalités. Consommée par la landing, les pages publiques, le JSON-LD
 * et `llms.txt` — un prix ou une réponse ne se modifie qu'ici.
 *
 * Aucun chiffre client, aucun témoignage : uniquement ce que le produit fait
 * et ce qui est affiché publiquement.
 */

export type PlanId = 'essential' | 'pro' | 'business';

export type PricingPlan = {
  id: PlanId;
  name: string;
  /** Prix mensuel en XAF (FCFA), hors options. */
  monthly: number;
  /** Prix annuel en XAF (FCFA). */
  annual: number;
  /** Équivalent mensuel du prix annuel, arrondi. */
  annualEquivalent: number;
  description: string;
  badge: string | null;
  features: readonly string[];
};

export const CURRENCY = 'XAF' as const;

/** Durée de l'essai gratuit (cycle pilote, voir SubscriptionModule). */
export const TRIAL_DAYS = 30;

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'essential',
    name: 'Essentiel',
    monthly: 20000,
    annual: 200000,
    annualEquivalent: 16667,
    description: 'Pour structurer un atelier indépendant.',
    badge: null,
    features: [
      '1 garage',
      'Jusqu’à 5 utilisateurs',
      'OT, devis & factures PDF',
      'Stock + alertes seuil',
      'Planning & rendez-vous',
      'Tableau de bord essentiel',
      'Support en français',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 45000,
    annual: 450000,
    annualEquivalent: 37500,
    description: 'Pour les ateliers qui pilotent une équipe complète.',
    badge: 'Recommandé',
    features: [
      '1 garage',
      'Utilisateurs illimités',
      'Tout Essentiel',
      'SMS Orange / MTN intégrés',
      'Reporting avancé',
      'Accompagnement au démarrage',
      'Support prioritaire',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 65000,
    annual: 650000,
    annualEquivalent: 54167,
    description: 'Pour les structures multi-sites et les équipes plus larges.',
    badge: 'Multi-sites',
    features: [
      '2 garages inclus',
      'Utilisateurs illimités',
      'Tout Pro',
      'Vue consolidée multi-garages',
      'Rôles & permissions avancés',
      '+20 000 FCFA / mois par garage supplémentaire',
      'Support prioritaire',
    ],
  },
];

export type FaqItem = { q: string; a: string };

export const FAQ: readonly FaqItem[] = [
  {
    q: 'Pour qui est fait Atelier Maître ?',
    a: 'Pour les propriétaires de garage au Cameroun — qu\'ils aient un seul atelier ou plusieurs. Que vous ayez 2 employés ou 20, l\'application s\'adapte à votre équipe.',
  },
  {
    q: 'Je gère plusieurs garages, ça marche ?',
    a: 'Oui. Vous créez un compte, vous ajoutez vos garages (Douala, Yaoundé, Bafoussam…). Chaque employé travaille dans son atelier, vous voyez tout depuis un seul tableau de bord.',
  },
  {
    q: 'Comment l\'avoir sur mon téléphone ?',
    a: 'Sur Android : ouvrez le site, appuyez sur "Ajouter à l\'écran d\'accueil" — c\'est comme une appli normale. Sur iPhone : dans Safari, appuyez sur Partager puis "Sur l\'écran d\'accueil". Gratuit, sans passer par un store.',
  },
  {
    q: 'Faut-il un serveur sur place ?',
    a: 'Non. Un téléphone avec internet suffit — rien à installer, rien à acheter. Vos données sont sécurisées en ligne et accessibles depuis n\'importe où.',
  },
  {
    q: 'Et mes clients et véhicules déjà enregistrés ?',
    a: 'On s\'en occupe. On vous aide à importer votre liste de clients et de véhicules au démarrage — vous ne repartez pas de zéro.',
  },
  {
    q: 'Combien coûte Atelier Maître ?',
    a: `Trois forfaits mensuels en FCFA : Essentiel à 20 000, Pro à 45 000 et Business à 65 000 (2 garages inclus). Le paiement annuel revient moins cher. L'essai est gratuit pendant ${TRIAL_DAYS} jours.`,
  },
  {
    q: 'Les factures respectent-elles la fiscalité camerounaise ?',
    a: 'Oui. Les devis et factures sont en XAF, avec la TVA à 19,25 % et le timbre fiscal, et se génèrent en PDF à partir de l\'ordre de travail, sans ressaisie.',
  },
  {
    q: 'Puis-je voir l\'application avant de m\'engager ?',
    a: 'Oui. Réservez une démonstration : on vous montre le parcours complet sur des données d\'exemple, de l\'accueil du véhicule à l\'encaissement.',
  },
];

/** Fonctionnalités, formulées pour `featureList` (JSON-LD) et `llms.txt`. */
export const FEATURE_LIST: readonly string[] = [
  'Ordres de travail (OT) avec statuts, contrôle qualité et historique par véhicule',
  'Devis et factures PDF en XAF avec TVA 19,25 % et timbre fiscal',
  'Lien de devis à valider ou refuser par le client',
  'Encaissements et vente comptoir de pièces',
  'Stock de pièces auto avec alertes de seuil et mouvements liés aux OT',
  'Planning atelier et rendez-vous',
  'Notifications clients par SMS et WhatsApp avec gestion du consentement',
  'Tableau de bord et rapports (chiffre d\'affaires, performance des techniciens)',
  'Multi-garages et rôles (gérant, chef d\'atelier, technicien, réception, caisse)',
  'Application web installable sur téléphone (PWA), sans serveur sur place',
];

export function formatXaf(amount: number): string {
  // Espace fine insécable remplacée par une espace simple : rendu identique serveur/client.
  return `${amount.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;
}
