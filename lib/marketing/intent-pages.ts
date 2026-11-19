/**
 * Contenu des pages publiques par intention de recherche. Chaque affirmation
 * décrit une fonction présente dans le produit (modules workshop, billing,
 * stock, planning, customer-notifications, reports). Aucun chiffre de
 * résultat, aucun client cité : ne pas en ajouter sans source vérifiable.
 */

export type IntentSection = {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type IntentPage = {
  path: string;
  /** Balise <title> (≤ 60 caractères visés). */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: readonly IntentSection[];
  /** Pages liées (chemins de MARKETING_PAGES). */
  related: readonly string[];
};

export const INTENT_PAGES: Record<string, IntentPage> = {
  '/logiciel-garage-cameroun': {
    path: '/logiciel-garage-cameroun',
    metaTitle: 'Logiciel de gestion de garage au Cameroun | Atelier Maître',
    metaDescription:
      'Atelier Maître, logiciel de gestion de garage pensé pour le Cameroun : OT, devis et factures en XAF avec TVA 19,25 %, stock, planning et notifications clients.',
    eyebrow: 'Logiciel garage · Cameroun',
    h1: 'Logiciel de gestion de garage pour le Cameroun',
    intro:
      'Atelier Maître réunit dans une seule application web tout le parcours d\'un véhicule au garage : accueil, diagnostic, devis, réparation, contrôle qualité, facture et encaissement. Les montants sont en FCFA (XAF) et la fiscalité camerounaise est intégrée.',
    sections: [
      {
        title: 'Ce que fait le logiciel',
        bullets: [
          'Ordres de travail avec statuts, du véhicule reçu jusqu\'à la clôture.',
          'Devis et factures PDF en XAF, TVA 19,25 % et timbre fiscal calculés.',
          'Stock de pièces relié aux OT, alertes de seuil et vente comptoir.',
          'Planning des rendez-vous et charge de l\'atelier.',
          'Notifications clients (rendez-vous, véhicule prêt, facture) avec consentement.',
          'Tableau de bord : chiffre d\'affaires, factures en attente, performance des techniciens.',
        ],
      },
      {
        title: 'Adapté aux garages camerounais',
        paragraphs: [
          'Les prix et factures sont en XAF, les numéros de téléphone au format camerounais (+237). L\'application fonctionne dans le navigateur et s\'installe sur un téléphone Android ou un iPhone, sans serveur sur place ni matériel à acheter.',
          'Un même compte gère un ou plusieurs garages (par exemple un atelier à Douala et un autre à Yaoundé), chaque employé ne voyant que son atelier.',
        ],
      },
      {
        title: 'Chaque rôle a son écran',
        paragraphs: [
          'Le gérant suit l\'activité, le chef d\'atelier crée et valide les OT, le technicien consulte ses missions depuis son téléphone, la réception ouvre les dossiers et la caisse encaisse. Les droits se règlent par rôle.',
        ],
      },
    ],
    related: ['/tarifs', '/ordre-de-travail-atelier', '/facture-garage-xaf', '/comparatif-excel-cahier'],
  },

  '/ordre-de-travail-atelier': {
    path: '/ordre-de-travail-atelier',
    metaTitle: 'Ordre de travail atelier automobile | Atelier Maître',
    metaDescription:
      'Créez et suivez vos ordres de travail (OT) d\'atelier : réception, diagnostic, devis, réparation, contrôle qualité et facture, avec l\'historique de chaque véhicule.',
    eyebrow: 'Ordres de travail',
    h1: 'Ordre de travail d\'atelier : suivez chaque véhicule de l\'accueil à la facture',
    intro:
      'Dans Atelier Maître, l\'ordre de travail (OT) est le fil conducteur : il relie le client, le véhicule, le devis, les pièces sorties du stock, le contrôle qualité et la facture.',
    sections: [
      {
        title: 'Les étapes d\'un OT',
        bullets: [
          'Reçu : le véhicule est enregistré à l\'accueil avec le motif de visite.',
          'Diagnostic : le technicien note ses constats.',
          'Devis : envoyé au client, qui peut le valider ou le refuser en ligne.',
          'En cours : les travaux démarrent une fois le devis validé.',
          'Contrôle qualité : validé ou renvoyé en atelier.',
          'Prêt, facturé puis clôturé.',
        ],
      },
      {
        title: 'Un statut que tout le monde voit',
        paragraphs: [
          'Chaque passage d\'étape est contrôlé selon le rôle de l\'utilisateur, et deux personnes ne peuvent pas écraser la modification de l\'autre. La réception sait répondre au client qui appelle, sans aller chercher le chef d\'atelier.',
          'L\'historique des interventions reste attaché au véhicule : à la visite suivante, vous retrouvez ce qui a été fait.',
        ],
      },
    ],
    related: ['/facture-garage-xaf', '/planning-atelier', '/gestion-stock-pieces-auto'],
  },

  '/facture-garage-xaf': {
    path: '/facture-garage-xaf',
    metaTitle: 'Devis et facture garage en XAF (TVA 19,25 %) | Atelier Maître',
    metaDescription:
      'Devis et factures de garage en FCFA (XAF) avec TVA 19,25 % et timbre fiscal, générés en PDF depuis l\'ordre de travail, avec suivi des paiements.',
    eyebrow: 'Devis & factures',
    h1: 'Devis et facture de garage en XAF, TVA 19,25 % incluse',
    intro:
      'La facture part de l\'ordre de travail : main-d\'œuvre et pièces déjà saisies, TVA et timbre calculés. Plus de devis sous Word puis de facture sous Excel à ressaisir.',
    sections: [
      {
        title: 'Du devis à l\'encaissement',
        bullets: [
          'Devis PDF en XAF, envoyé au client par un lien qu\'il peut valider ou refuser.',
          'Facture générée depuis l\'OT, avec TVA 19,25 % et timbre fiscal.',
          'Paiements partiels suivis jusqu\'au solde, sans double enregistrement.',
          'Logo et coordonnées de votre garage sur les documents.',
        ],
      },
      {
        title: 'Factures en attente sous contrôle',
        paragraphs: [
          'Le tableau de bord liste les factures non soldées. Selon votre forfait et le consentement du client, une relance de paiement peut lui être envoyée.',
        ],
      },
    ],
    related: ['/ordre-de-travail-atelier', '/tarifs', '/sms-clients-garage'],
  },

  '/gestion-stock-pieces-auto': {
    path: '/gestion-stock-pieces-auto',
    metaTitle: 'Gestion de stock de pièces auto pour garage | Atelier Maître',
    metaDescription:
      'Gérez le stock de pièces détachées de votre garage : mouvements liés aux ordres de travail, alertes de seuil et vente comptoir.',
    eyebrow: 'Stock pièces',
    h1: 'Gestion du stock de pièces auto, reliée à l\'atelier',
    intro:
      'Une pièce posée sur un véhicule sort du stock depuis l\'OT. Le stock reste juste sans inventaire manuel quotidien, et la rupture se voit avant que le client attende.',
    sections: [
      {
        title: 'Fonctions',
        bullets: [
          'Catalogue de pièces avec quantités et prix en XAF.',
          'Mouvements de stock liés aux ordres de travail.',
          'Alertes quand une pièce passe sous son seuil.',
          'Vente comptoir de pièces sans ordre de travail.',
        ],
      },
      {
        title: 'Pourquoi relier stock et OT',
        paragraphs: [
          'Quand la sortie de pièce et la facture viennent de la même saisie, une pièce ne peut plus être posée sans être facturée, ni facturée sans sortir du stock.',
        ],
      },
    ],
    related: ['/ordre-de-travail-atelier', '/facture-garage-xaf', '/comparatif-excel-cahier'],
  },

  '/planning-atelier': {
    path: '/planning-atelier',
    metaTitle: 'Planning atelier et rendez-vous garage | Atelier Maître',
    metaDescription:
      'Planifiez les rendez-vous de votre garage et la charge de l\'atelier, avec une vue réception pensée pour le téléphone et des rappels clients.',
    eyebrow: 'Planning atelier',
    h1: 'Planning d\'atelier et rendez-vous clients',
    intro:
      'Le planning montre les rendez-vous du jour et la charge de l\'atelier. La réception programme un rendez-vous en quelques secondes, depuis un ordinateur ou un téléphone.',
    sections: [
      {
        title: 'Fonctions',
        bullets: [
          'Prise de rendez-vous par client et véhicule.',
          'Vue du jour pour la réception, adaptée au mobile.',
          'Rappel de rendez-vous envoyé au client, s\'il l\'a accepté.',
          'Rendez-vous rattaché à l\'ordre de travail du véhicule.',
        ],
      },
    ],
    related: ['/ordre-de-travail-atelier', '/sms-clients-garage', '/logiciel-garage-cameroun'],
  },

  '/sms-clients-garage': {
    path: '/sms-clients-garage',
    metaTitle: 'SMS et WhatsApp aux clients du garage | Atelier Maître',
    metaDescription:
      'Prévenez vos clients automatiquement : rappel de rendez-vous, véhicule prêt, devis à valider, facture disponible. Consentement et désinscription gérés.',
    eyebrow: 'Notifications clients',
    h1: 'SMS et WhatsApp aux clients du garage, sans les relancer un par un',
    intro:
      'Atelier Maître envoie les messages utiles au bon moment, à partir de ce qui se passe dans l\'atelier. Fini les relances une par une depuis le téléphone personnel du réceptionnaire.',
    sections: [
      {
        title: 'Messages prévus',
        bullets: [
          'Rappel de rendez-vous.',
          'Véhicule reçu, puis véhicule prêt.',
          'Devis à valider.',
          'Facture disponible, relance de paiement, paiement confirmé.',
        ],
      },
      {
        title: 'Respect du client',
        paragraphs: [
          'Un message n\'est envoyé qu\'au client qui l\'a accepté. Il peut se désinscrire en répondant « STOP », et chaque envoi est tracé. Chaque type de message s\'active ou se coupe dans les réglages du garage.',
          'Les notifications clients sont incluses dans les forfaits Pro et Business. La mise en service des envois se fait avec notre équipe au démarrage : demandez une démo pour connaître les canaux disponibles pour votre garage.',
        ],
      },
    ],
    related: ['/planning-atelier', '/facture-garage-xaf', '/tarifs'],
  },
};
