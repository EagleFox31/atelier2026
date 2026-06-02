import type { GuideRole } from '@/lib/guide-roles';

export type GettingStartedCheckId =
  | 'customer'
  | 'vehicle'
  | 'reception_or_ot'
  | 'appointment'
  | 'assign_tech'
  | 'quote'
  | 'payment'
  | 'team_member'
  | 'workshop_settings'
  | 'demo_request'
  | 'open_assigned_ot'
  | 'stock_view';

export interface GettingStartedTaskDef {
  id: GettingStartedCheckId;
  label: string;
  description: string;
  href: string;
}

export interface TourStepDef {
  /** Sélecteur `[data-tour="…"]` — omis = popover centré */
  target?: string;
  title: string;
  description: string;
}

const RECEPTION_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'customer',
    label: 'Créer ou retrouver un client',
    description: 'Au moins une fiche client avec téléphone.',
    href: '/customers',
  },
  {
    id: 'vehicle',
    label: 'Enregistrer un véhicule',
    description: 'Plaque + marque / modèle liés au client.',
    href: '/vehicles',
  },
  {
    id: 'reception_or_ot',
    label: 'Ouvrir un OT (réception express)',
    description: 'Client + véhicule + plainte en un parcours.',
    href: '/reception',
  },
  {
    id: 'appointment',
    label: 'Planifier un rendez-vous',
    description: 'Créneau sur le planning du jour ou à venir.',
    href: '/planning',
  },
];

const CHEF_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'reception_or_ot',
    label: 'Voir les OT du jour',
    description: 'Tableau des ordres de travail actifs.',
    href: '/workshop',
  },
  {
    id: 'assign_tech',
    label: 'Assigner un technicien',
    description: 'Un OT reçu avec un mécanicien attribué.',
    href: '/workshop',
  },
  {
    id: 'quote',
    label: 'Créer un devis',
    description: 'Au moins un devis enregistré.',
    href: '/billing',
  },
  {
    id: 'stock_view',
    label: 'Consulter le stock',
    description: 'Ouvrir le catalogue pièces.',
    href: '/stock',
  },
];

const TECH_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'open_assigned_ot',
    label: 'Ouvrir un OT qui vous est assigné',
    description: 'Votre liste filtre vos véhicules.',
    href: '/workshop',
  },
  {
    id: 'reception_or_ot',
    label: 'Lire plainte et check réception',
    description: 'Sur la fiche OT avant diagnostic.',
    href: '/workshop',
  },
  {
    id: 'stock_view',
    label: 'Consulter le stock',
    description: 'Vérifier disponibilité d’une pièce.',
    href: '/stock',
  },
];

const CASHIER_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'quote',
    label: 'Voir les factures à encaisser',
    description: 'File d’attente caisse ou facturation.',
    href: '/cashier/collect',
  },
  {
    id: 'payment',
    label: 'Enregistrer un paiement',
    description: 'Au moins un paiement enregistré.',
    href: '/cashier/collect',
  },
  {
    id: 'reception_or_ot',
    label: 'Repérer un OT prêt',
    description: 'Véhicules au statut Prêt dans les OT.',
    href: '/workshop',
  },
];

const ADMIN_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'workshop_settings',
    label: 'Configurer l’atelier',
    description: 'Nom, adresse, téléphone sur les PDF.',
    href: '/settings',
  },
  {
    id: 'team_member',
    label: 'Ajouter un membre d’équipe',
    description: 'Compte avec rôle adapté.',
    href: '/team',
  },
  {
    id: 'customer',
    label: 'Avoir des clients en base',
    description: 'Données de démo ou premier client.',
    href: '/customers',
  },
  {
    id: 'reception_or_ot',
    label: 'Suivre un OT complet',
    description: 'Au moins un ordre de travail créé.',
    href: '/workshop',
  },
];

const SUPER_ADMIN_TASKS: GettingStartedTaskDef[] = [
  {
    id: 'demo_request',
    label: 'Consulter les demandes démo',
    description: 'Leads du formulaire public.',
    href: '/demo-requests',
  },
  {
    id: 'team_member',
    label: 'Gérer les comptes',
    description: 'Équipe et accès administrateurs.',
    href: '/team',
  },
  {
    id: 'reception_or_ot',
    label: 'Voir l’activité atelier',
    description: 'Ordres de travail en cours.',
    href: '/workshop',
  },
];

export const GETTING_STARTED_BY_ROLE: Record<GuideRole, GettingStartedTaskDef[]> = {
  RECEPTIONNISTE: RECEPTION_TASKS,
  CHEF_ATELIER: CHEF_TASKS,
  TECHNICIEN: TECH_TASKS,
  CAISSIER: CASHIER_TASKS,
  ADMIN: ADMIN_TASKS,
  SUPER_ADMIN: SUPER_ADMIN_TASKS,
};

export const TOUR_STEPS_BY_ROLE: Record<GuideRole, TourStepDef[]> = {
  RECEPTIONNISTE: [
    {
      title: 'Bienvenue — Réception',
      description:
        'Ce tour vous montre les raccourcis essentiels. Vous pouvez le quitter à tout moment (Échap).',
    },
    {
      target: 'tour-header-guide',
      title: 'Guide permanent',
      description: 'Le bouton ? donne une aide détaillée sur chaque écran, adaptée à votre profil.',
    },
    {
      target: 'tour-header-notifications',
      title: 'Notifications',
      description: 'Alertes OT, véhicule prêt, demandes internes — sans quitter votre travail.',
    },
    {
      target: 'tour-dash-reception',
      title: 'Réception express',
      description: 'Flux recommandé : client → véhicule → check → OT en une fois.',
    },
    {
      target: 'tour-nav-workshop',
      title: 'Ordres de travail',
      description: 'Suivez chaque véhicule jusqu’à la mise à disposition client.',
    },
    {
      target: 'tour-getting-started',
      title: 'Premiers pas',
      description: 'Icône checklist en haut : ouvrez pour voir la progression et les tâches à faire.',
    },
  ],
  CHEF_ATELIER: [
    {
      title: 'Bienvenue — Chef d’atelier',
      description: 'Pilotage OT, devis, QC et stock depuis ce tour.',
    },
    {
      target: 'tour-header-guide',
      title: 'Aide contextuelle',
      description: 'Sur chaque page, le ? explique ce que vous pouvez faire ici.',
    },
    {
      target: 'tour-nav-dashboard',
      title: 'Tableau de bord',
      description: 'Vue du jour : urgences, OT sans technicien, indicateurs.',
    },
    {
      target: 'tour-nav-workshop',
      title: 'Ordres de travail',
      description: 'Assignation, statuts, devis et contrôle qualité.',
    },
    {
      target: 'tour-nav-billing',
      title: 'Facturation',
      description: 'Devis client, validation, préparation facture.',
    },
    {
      target: 'tour-getting-started',
      title: 'Checklist',
      description: 'Validez vos premiers réflexes atelier.',
    },
  ],
  TECHNICIEN: [
    {
      title: 'Bienvenue — Technicien',
      description: 'Votre espace principal est la liste des OT.',
    },
    {
      target: 'tour-header-guide',
      title: 'Guide',
      description: 'Aide sur la fiche OT : observations, pièces, travaux.',
    },
    {
      target: 'tour-nav-workshop',
      title: 'Vos OT',
      description: 'Les véhicules assignés apparaissent en priorité.',
    },
    {
      target: 'tour-workshop-new',
      title: 'Ouvrir une fiche',
      description: 'Cliquez une ligne pour diagnostic, pièces et fin de travaux.',
    },
    {
      target: 'tour-getting-started',
      title: 'Premiers pas',
      description: 'Suivez la checklist pour être opérationnel.',
    },
  ],
  CAISSIER: [
    {
      title: 'Bienvenue — Caisse',
      description: 'Encaissement, impayés et clôture de journée.',
    },
    {
      target: 'tour-header-guide',
      title: 'Guide',
      description: 'Aide sur Encaisser, factures et vente comptoir.',
    },
    {
      target: 'tour-nav-collect',
      title: 'Encaisser',
      description: 'Votre file principale des factures à payer.',
    },
    {
      target: 'tour-nav-receivables',
      title: 'Impayés',
      description: 'Soldes restants et relances.',
    },
    {
      target: 'tour-getting-started',
      title: 'Checklist',
      description: 'Premiers encaissements à valider.',
    },
  ],
  ADMIN: [
    {
      title: 'Bienvenue — Administrateur',
      description: 'Configuration garage, équipe et supervision.',
    },
    {
      target: 'tour-header-guide',
      title: 'Guide',
      description: 'Documentation intégrée par écran.',
    },
    {
      target: 'tour-nav-team',
      title: 'Équipe',
      description: 'Comptes, rôles, mots de passe temporaires.',
    },
    {
      target: 'tour-nav-settings',
      title: 'Paramètres',
      description: 'Identité légale sur devis et factures.',
    },
    {
      target: 'tour-nav-audit',
      title: 'Audit',
      description: 'Qui a modifié quoi et quand.',
    },
    {
      target: 'tour-getting-started',
      title: 'Premiers pas',
      description: 'Checklist de mise en service.',
    },
  ],
  SUPER_ADMIN: [
    {
      title: 'Bienvenue — Super Admin',
      description: 'Plateforme multi-ateliers et demandes démo.',
    },
    {
      target: 'tour-header-guide',
      title: 'Guide',
      description: 'Aide sur tenants, démo et audit.',
    },
    {
      target: 'tour-nav-demo',
      title: 'Demandes démo',
      description: 'Leads du site — badge si nouvelles demandes.',
    },
    {
      target: 'tour-nav-team',
      title: 'Équipe',
      description: 'Création des administrateurs d’atelier.',
    },
    {
      target: 'tour-getting-started',
      title: 'Checklist',
      description: 'Premiers contrôles plateforme.',
    },
  ],
};

/** Map data-tour sur la nav sidebar (href → clé) */
export const NAV_TOUR_TARGET_BY_HREF: Record<string, string> = {
  '/dashboard': 'tour-nav-dashboard',
  '/reception': 'tour-nav-reception',
  '/workshop': 'tour-nav-workshop',
  '/planning': 'tour-nav-planning',
  '/billing': 'tour-nav-billing',
  '/stock': 'tour-nav-stock',
  '/team': 'tour-nav-team',
  '/settings': 'tour-nav-settings',
  '/audit': 'tour-nav-audit',
  '/demo-requests': 'tour-nav-demo',
  '/cashier/collect': 'tour-nav-collect',
  '/cashier/receivables': 'tour-nav-receivables',
  '/customers': 'tour-nav-customers',
};
