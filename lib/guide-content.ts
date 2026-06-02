import type { GuideRole } from '@/lib/guide-roles';

export interface GuideContent {
  title: string;
  intro: string;
  canDo: string[];
  steps: string[];
  tips?: string[];
  related?: { href: string; label: string }[];
}

export interface GuidePageDef {
  id: string;
  priority: number;
  match: (pathname: string) => boolean;
  indexHref: string;
  indexLabel: string;
  guides: Partial<Record<GuideRole, GuideContent>>;
}

function g(
  title: string,
  intro: string,
  canDo: string[],
  steps: string[],
  extras?: { tips?: string[]; related?: { href: string; label: string }[] },
): GuideContent {
  return { title, intro, canDo, steps, ...extras };
}

/** Pages triées par `priority` décroissant à la résolution. */
export const GUIDE_PAGES: GuidePageDef[] = [
  // ─── Facturation détail ───────────────────────────────────────────────────
  {
    id: 'billing-invoice-detail',
    priority: 100,
    match: (p) => /^\/billing\/invoices\/[^/]+$/.test(p) && !p.endsWith('/print'),
    indexHref: '/billing',
    indexLabel: 'Facturation',
    guides: {
      CAISSIER: g(
        'Fiche facture',
        'C’est ici que vous encaissez le client et suivez le solde restant.',
        [
          'Consulter le détail HT, TVA 19,25 %, timbre et total TTC',
          'Enregistrer un paiement (espèces, Orange Money, MTN, virement, chèque)',
          'Voir l’historique des paiements déjà enregistrés',
          'Imprimer ou rouvrir la facture liée à l’OT',
        ],
        [
          'Vérifiez que l’OT est bien en statut Prêt ou Facturé avant d’encaisser.',
          'Cliquez « Enregistrer un paiement » et choisissez le mode.',
          'Pour Orange / MTN : saisissez obligatoirement la référence de transaction.',
          'Si le montant couvre le total : la facture passe Payée et l’OT peut être clôturé.',
          'Paiement partiel : la facture reste Partielle — le solde s’affiche pour un prochain encaissement.',
        ],
        {
          tips: [
            'Un paiement enregistré n’est pas supprimable (traçabilité). En cas d’erreur, prévenez l’administrateur.',
            'Ne facturez pas un OT qui n’a pas passé le contrôle qualité.',
          ],
          related: [
            { href: '/cashier/collect', label: 'Encaisser (liste)' },
            { href: '/cashier/receivables', label: 'Impayés' },
          ],
        },
      ),
      CHEF_ATELIER: g(
        'Fiche facture',
        'Suivi de la facture émise après travaux validés.',
        [
          'Contrôler les montants issus du devis approuvé',
          'Consulter les paiements enregistrés par la caisse',
          'Identifier une facture impayée ou partielle',
        ],
        [
          'Ouvrez la facture depuis l’OT ou l’onglet Factures.',
          'Comparez les lignes avec le devis approuvé si le client conteste.',
          'Laissez l’encaissement au caissier sauf urgence.',
        ],
        { related: [{ href: '/billing', label: 'Liste factures' }] },
      ),
      ADMIN: g(
        'Fiche facture',
        'Vue complète pour contrôle et litige.',
        [
          'Auditer montants, TVA, timbre',
          'Voir qui a enregistré les paiements',
          'Exporter / imprimer pour le client',
        ],
        [
          'Ouvrez la facture depuis Facturation ou l’OT.',
          'En cas d’anomalie, croisez avec le Journal d’audit.',
        ],
        { related: [{ href: '/audit', label: 'Journal d’audit' }] },
      ),
    },
  },
  {
    id: 'billing-quote-detail',
    priority: 99,
    match: (p) => /^\/billing\/quotes\/[^/]+$/.test(p) && !p.includes('/print') && !p.endsWith('/new'),
    indexHref: '/billing',
    indexLabel: 'Facturation',
    guides: {
      CHEF_ATELIER: g(
        'Fiche devis',
        'Préparez et faites valider le devis client avant les travaux.',
        [
          'Modifier les lignes (pièces, main-d’œuvre)',
          'Envoyer / marquer envoyé au client',
          'Enregistrer l’approbation (bon signé, SMS, accord verbal noté)',
          'Passer l’OT en travaux après approbation',
        ],
        [
          'Vérifiez les observations « à inclure » importées depuis l’OT.',
          'Ajustez quantités et prix — TVA et timbre se recalculent.',
          'Soumettez au client puis enregistrez le mode d’approbation.',
          'Une fois approuvé : l’OT peut passer en cours.',
        ],
        {
          tips: ['Les montants sont idempotents : un rechargement ne duplique pas les lignes.'],
          related: [{ href: '/workshop', label: 'Ordres de travail' }],
        },
      ),
      RECEPTIONNISTE: g(
        'Fiche devis',
        'Consultation seule : vous aidez le client à comprendre le montant.',
        [
          'Lire le détail des lignes et le total TTC',
          'Communiquer le montant au client (téléphone ou comptoir)',
          'Orienter vers la caisse une fois la voiture prête',
        ],
        [
          'Ouvrez le devis depuis l’OT ou Facturation.',
          'Ne modifiez pas les lignes — contactez le chef d’atelier.',
          'Après accord client, le chef marque le devis approuvé.',
        ],
        { related: [{ href: '/workshop', label: 'Ordres de travail' }] },
      ),
      ADMIN: g(
        'Fiche devis',
        'Contrôle des devis et validation client.',
        [
          'Consulter et corriger si nécessaire',
          'Valider une approbation exceptionnelle',
        ],
        [
          'Vérifiez le mode d’approbation (bon signé, digital, verbal).',
          'En cas de litige, consultez l’historique OT et l’audit.',
        ],
      ),
    },
  },
  {
    id: 'billing-quote-new',
    priority: 98,
    match: (p) => p === '/billing/quotes/new',
    indexHref: '/billing',
    indexLabel: 'Facturation',
    guides: {
      CHEF_ATELIER: g(
        'Nouveau devis',
        'Création d’un devis depuis un OT en diagnostic.',
        [
          'Choisir l’OT concerné',
          'Importer les observations marquées pour devis',
          'Ajouter main-d’œuvre et pièces',
        ],
        [
          'Depuis l’OT : onglet Devis → Nouveau, ou cette page avec OT pré-sélectionné.',
          'Complétez chaque ligne (libellé, quantité, prix unitaire).',
          'Enregistrez puis envoyez au client.',
        ],
      ),
      ADMIN: g(
        'Nouveau devis',
        'Création manuelle de devis.',
        ['Créer un devis hors flux standard si besoin'],
        ['Sélectionnez l’OT', 'Renseignez les lignes', 'Enregistrez'],
      ),
    },
  },
  {
    id: 'billing-invoice-new',
    priority: 97,
    match: (p) => p === '/billing/invoices/new',
    indexHref: '/billing',
    indexLabel: 'Facturation',
    guides: {
      CAISSIER: g(
        'Nouvelle facture',
        'Cas rare : facture hors OT standard.',
        ['Créer une facture manuelle'],
        ['Utilisez de préférence le flux OT → Prêt → Facturer', 'Si manuel : renseignez client et lignes', 'Émettez puis encaissez'],
        { tips: ['Privilégiez toujours la facture générée depuis l’OT.'] },
      ),
      CHEF_ATELIER: g(
        'Nouvelle facture',
        'Facturation exceptionnelle.',
        ['Émettre une facture sans passer par le devis OT'],
        ['Réservez ce flux aux cas particuliers validés par l’admin'],
      ),
    },
  },
  {
    id: 'billing',
    priority: 50,
    match: (p) => p === '/billing',
    indexHref: '/billing',
    indexLabel: 'Facturation',
    guides: {
      CHEF_ATELIER: g(
        'Facturation',
        'Centre devis et factures de l’atelier.',
        [
          'Lister les devis (brouillon, envoyé, approuvé, refusé)',
          'Lister les factures (émise, partielle, payée)',
          'Ouvrir une fiche pour éditer ou suivre',
          'Créer un devis depuis un OT',
        ],
        [
          'Onglet Devis : filtrez par statut pour voir ce qui attend le client.',
          'Onglet Factures : repérez les impayés (émise / partielle).',
          'Cliquez une ligne pour ouvrir le détail.',
        ],
        { related: [{ href: '/workshop', label: 'Ordres de travail' }] },
      ),
      CAISSIER: g(
        'Facturation',
        'Retrouvez les factures à encaisser.',
        [
          'Voir les factures Émises ou Partielles',
          'Ouvrir une facture pour enregistrer un paiement',
          'Consulter l’historique des factures payées',
        ],
        [
          'Filtrez par statut « Émise » ou « Partielle ».',
          'Ouvrez la facture liée à l’OT annoncé prêt.',
          'Encaissez depuis la fiche facture.',
        ],
        {
          related: [
            { href: '/cashier/collect', label: 'Encaisser' },
            { href: '/cashier/receivables', label: 'Impayés' },
          ],
        },
      ),
      RECEPTIONNISTE: g(
        'Facturation',
        'Lecture seule pour informer le client.',
        [
          'Consulter un devis ou une facture',
          'Annoncer un montant TTC au client',
        ],
        [
          'Recherchez par référence OT ou client.',
          'Ne modifiez pas — contactez le chef ou la caisse.',
        ],
      ),
      ADMIN: g(
        'Facturation',
        'Supervision devis et factures.',
        [
          'Tout consulter et corriger',
          'Analyser les impayés',
          'Contrôler TVA et timbre',
        ],
        [
          'Utilisez les filtres par statut.',
          'Croisez avec Rapports pour le CA.',
        ],
        { related: [{ href: '/reports', label: 'Rapports' }] },
      ),
    },
  },
  // ─── Caisse ───────────────────────────────────────────────────────────────
  {
    id: 'cashier-collect',
    priority: 90,
    match: (p) => p === '/cashier/collect',
    indexHref: '/cashier/collect',
    indexLabel: 'Encaisser',
    guides: {
      CAISSIER: g(
        'Encaisser',
        'File d’attente des factures à payer — votre écran principal.',
        [
          'Voir les factures en attente (émise / partielle)',
          'Ouvrir une facture et enregistrer le paiement',
          'Basculer vers impayés ou clôture de journée',
        ],
        [
          'Triez ou cherchez la facture / le client.',
          'Ouvrez la fiche facture.',
          'Enregistrez le paiement avec le bon mode et la référence mobile si besoin.',
        ],
        {
          related: [
            { href: '/cashier/receivables', label: 'Impayés' },
            { href: '/cashier/closing', label: 'Clôture caisse' },
          ],
        },
      ),
    },
  },
  {
    id: 'cashier-receivables',
    priority: 90,
    match: (p) => p === '/cashier/receivables',
    indexHref: '/cashier/receivables',
    indexLabel: 'Impayés',
    guides: {
      CAISSIER: g(
        'Impayés',
        'Suivi des factures non soldées.',
        [
          'Lister les soldes restants',
          'Relancer un client et enregistrer un complément de paiement',
        ],
        [
          'Identifiez les factures Partielles ou Émises anciennes.',
          'Ouvrez la facture et enregistrez le paiement reçu.',
        ],
        { related: [{ href: '/cashier/collect', label: 'Encaisser' }] },
      ),
    },
  },
  {
    id: 'cashier-history',
    priority: 90,
    match: (p) => p === '/cashier/history',
    indexHref: '/cashier/history',
    indexLabel: 'Historique caisse',
    guides: {
      CAISSIER: g(
        'Historique caisse',
        'Tous les encaissements passés.',
        [
          'Consulter les paiements par date ou mode',
          'Vérifier une transaction Orange / MTN',
        ],
        [
          'Filtrez par période si disponible.',
          'Cliquez une ligne pour voir le détail facture.',
        ],
      ),
    },
  },
  {
    id: 'cashier-closing',
    priority: 90,
    match: (p) => p === '/cashier/closing',
    indexHref: '/cashier/closing',
    indexLabel: 'Clôture caisse',
    guides: {
      CAISSIER: g(
        'Clôture caisse',
        'Fin de journée : rapprochement espèces et mobile money.',
        [
          'Clôturer la journée de caisse',
          'Saisir les totaux réels par mode de paiement',
          'Valider l’écart éventuel avec commentaire',
        ],
        [
          'Vérifiez que toutes les factures du jour sont encaissées ou justifiées.',
          'Lancez la clôture et renseignez les montants comptés.',
          'Confirmez — la clôture est historisée.',
        ],
        { tips: ['Faites la clôture chaque soir avant de partir.'] },
      ),
    },
  },
  // ─── OT détail ──────────────────────────────────────────────────────────
  {
    id: 'workshop-edit',
    priority: 95,
    match: (p) => /^\/workshop\/[^/]+\/edit$/.test(p),
    indexHref: '/workshop',
    indexLabel: 'Ordres de travail',
    guides: {
      RECEPTIONNISTE: g(
        'Modifier l’OT',
        'Corriger les informations d’accueil avant travaux.',
        ['Modifier plainte, kilométrage, client ou véhicule si erreur'],
        ['Corrigez uniquement ce qui est nécessaire', 'Enregistrez', 'Prévenez le chef si l’OT est déjà en cours'],
      ),
      CHEF_ATELIER: g(
        'Modifier l’OT',
        'Ajustements administratifs sur l’ordre de travail.',
        ['Modifier les métadonnées OT', 'Réassigner si besoin depuis la fiche principale'],
        ['Évitez de modifier un OT clôturé', 'Utilisez la fiche OT pour l’assignation technicien'],
      ),
    },
  },
  {
    id: 'workshop-detail',
    priority: 94,
    match: (p) => /^\/workshop\/[^/]+$/.test(p) && !p.endsWith('/edit'),
    indexHref: '/workshop',
    indexLabel: 'Ordres de travail',
    guides: {
      TECHNICIEN: g(
        'Fiche ordre de travail',
        'Votre espace de travail quotidien.',
        [
          'Lire la plainte client et le check de réception',
          'Ajouter des observations (diagnostic)',
          'Consommer des pièces stock',
          'Suivre les travaux et marquer les tâches terminées',
          'Voir les notifications de changement de statut (cloche)',
        ],
        [
          'Lisez d’abord la plainte en haut de fiche.',
          'Onglet Observations : notez tout ce que vous constatez, cochez « à inclure au devis » si réparation nécessaire.',
          'Onglet Pièces : sortez les pièces utilisées (stock mis à jour).',
          'Onglet Travaux : avancez les lignes de travail.',
          'Prévenez le chef quand c’est fini — c’est lui qui lance le QC.',
        ],
        {
          tips: [
            'Ne changez pas vous-même le statut global de l’OT.',
            'Sévérité Critique sur une pièce manquante = alerte chef.',
          ],
          related: [{ href: '/stock', label: 'Stock' }],
        },
      ),
      CHEF_ATELIER: g(
        'Fiche ordre de travail',
        'Pilotage complet d’un véhicule en atelier.',
        [
          'Assigner / réassigner un technicien',
          'Piloter la machine à états (diagnostic → devis → travaux → QC → prêt)',
          'Créer et suivre le devis',
          'Lancer le contrôle qualité (QC)',
          'Déclencher SMS / notification client véhicule prêt',
          'Demande d’achat spécial (ASP) si pièce manquante',
        ],
        [
          'Vérifiez le statut actuel dans l’en-tête.',
          'Sans technicien : assignez depuis Infos ou Actions.',
          'Diagnostic OK : créez le devis (onglet Devis).',
          'Travaux finis : passez en QC et remplissez la checklist.',
          'QC validé : statut Prêt — le caissier facture.',
        ],
        {
          tips: ['Conflit de version : rechargez la page si une action échoue (optimistic lock).'],
          related: [{ href: '/billing', label: 'Facturation' }],
        },
      ),
      RECEPTIONNISTE: g(
        'Fiche ordre de travail',
        'Suivi client et réception.',
        [
          'Consulter plainte, statut, devis (lecture)',
          'Compléter ou corriger le check de réception',
          'Voir si la voiture est prête pour rappeler le client',
        ],
        [
          'Onglet Réception : kilométrage, carburant, checklist, signature.',
          'Ne validez pas un QC — c’est le chef.',
          'Voiture Prête : informez le client et orientez vers la caisse.',
        ],
        { tips: ['Un client = un OT par véhicule.'] },
      ),
      CAISSIER: g(
        'Fiche ordre de travail',
        'Vue pour facturer un véhicule prêt.',
        [
          'Vérifier que l’OT est Prêt ou Facturé',
          'Accéder à la facture depuis l’OT',
        ],
        [
          'Si statut Prêt : créez ou ouvrez la facture.',
          'Encaissez depuis la fiche facture.',
        ],
        { related: [{ href: '/cashier/collect', label: 'Encaisser' }] },
      ),
      ADMIN: g(
        'Fiche ordre de travail',
        'Vue complète administrateur.',
        [
          'Tout consulter et actions selon permissions',
          'Audit des changements de statut',
        ],
        [
          'Utilisez les onglets selon le besoin.',
          'Litige : croisez avec Journal d’audit.',
        ],
      ),
    },
  },
  {
    id: 'workshop-list',
    priority: 40,
    match: (p) => p === '/workshop',
    indexHref: '/workshop',
    indexLabel: 'Ordres de travail',
    guides: {
      TECHNICIEN: g(
        'Ordres de travail',
        'Liste de tous les OT ; les vôtres sont prioritaires.',
        [
          'Filtrer par statut (reçu, en cours, QC…)',
          'Ouvrir une fiche pour travailler',
          'Voir les OT qui vous sont assignés',
        ],
        [
          'Commencez par l’onglet ou filtre « En cours ».',
          'Cliquez un OT pour ouvrir la fiche.',
        ],
      ),
      RECEPTIONNISTE: g(
        'Ordres de travail',
        'Tableau de bord des réparations en cours.',
        [
          'Créer un nouvel OT',
          'Suivre le statut d’un véhicule',
          'Ouvrir la réception express en alternative',
        ],
        [
          'Bouton Nouvel OT : client + véhicule + plainte.',
          'Ou utilisez Réception express pour tout enchaîner.',
        ],
        { related: [{ href: '/reception', label: 'Réception express' }] },
      ),
      CHEF_ATELIER: g(
        'Ordres de travail',
        'Tour de contrôle de l’atelier.',
        [
          'Voir tous les OT actifs',
          'Repérer REÇU sans technicien',
          'Filtrer par statut QC, Prêt, etc.',
        ],
        [
          'Chaque matin : triez par REÇU et assignez.',
          'Priorisez QC en attente avant fin de journée.',
        ],
        { related: [{ href: '/dashboard', label: 'Tableau de bord' }] },
      ),
      CAISSIER: g(
        'Ordres de travail',
        'Repérer les véhicules prêts à facturer.',
        [
          'Filtrer les OT au statut Prêt',
          'Ouvrir l’OT pour créer / payer la facture',
        ],
        ['Filtrez Prêt', 'Ouvrez l’OT', 'Facturez puis encaissez'],
        { related: [{ href: '/cashier/collect', label: 'Encaisser' }] },
      ),
      ADMIN: g(
        'Ordres de travail',
        'Supervision de tous les OT du garage.',
        ['Tout consulter', 'Intervenir sur un OT bloqué'],
        ['Utilisez les filtres', 'Ouvrez la fiche pour le détail'],
      ),
    },
  },
  // ─── Réception express ────────────────────────────────────────────────────
  {
    id: 'reception',
    priority: 80,
    match: (p) => p === '/reception',
    indexHref: '/reception',
    indexLabel: 'Réception express',
    guides: {
      RECEPTIONNISTE: g(
        'Réception express',
        'Parcours rapide : client + véhicule + check → OT en une fois.',
        [
          'Rechercher ou créer un client (téléphone, nom)',
          'Rechercher ou créer un véhicule (plaque)',
          'Saisir plainte, kilométrage et checklist réception',
          'Valider pour créer l’OT au statut Reçu',
        ],
        [
          'Étape Client : tapez le téléphone — fiche existante ou création inline.',
          'Étape Véhicule : plaque puis marque / modèle si nouveau.',
          'Étape Réception : plainte client mot pour mot, km, état véhicule.',
          'Validez : vous arrivez sur la fiche OT.',
        ],
        {
          tips: ['C’est le flux recommandé à chaque arrivée sans RDV.'],
          related: [
            { href: '/planning', label: 'Planning RDV' },
            { href: '/customers', label: 'Clients' },
          ],
        },
      ),
      CHEF_ATELIER: g(
        'Réception express',
        'Même outil que la réception pour ouvrir un OT rapidement.',
        ['Créer un OT complet en 3 étapes'],
        ['Utilisez ce flux si la réception est débordée'],
      ),
      ADMIN: g(
        'Réception express',
        'Démonstration ou prise en main du flux d’accueil.',
        ['Tester le parcours client → OT'],
        ['Parcourez les 3 étapes', 'Vérifiez l’OT créé dans Ordres de travail'],
      ),
    },
  },
  {
    id: 'vehicle-reception',
    priority: 93,
    match: (p) => /^\/vehicles\/[^/]+\/reception$/.test(p),
    indexHref: '/vehicles',
    indexLabel: 'Véhicules',
    guides: {
      RECEPTIONNISTE: g(
        'Réception véhicule',
        'Check de réception depuis la fiche véhicule.',
        [
          'Renseigner km, carburant, checklist',
          'Créer ou lier un OT',
        ],
        [
          'Complétez la checklist avant de confier au technicien.',
          'Signez avec le client si présent.',
        ],
      ),
    },
  },
  // ─── Clients & véhicules ────────────────────────────────────────────────
  {
    id: 'customer-detail',
    priority: 70,
    match: (p) => /^\/customers\/[^/]+$/.test(p),
    indexHref: '/customers',
    indexLabel: 'Clients',
    guides: {
      RECEPTIONNISTE: g(
        'Fiche client',
        'Historique client et ses véhicules.',
        [
          'Modifier coordonnées',
          'Ajouter un véhicule',
          'Lancer un nouvel OT depuis un véhicule',
          'Voir les OT passés',
        ],
        [
          'Mettez à jour téléphone / email si changement.',
          'Ajouter véhicule : plaque + marque + modèle.',
          'Réceptionner : ouvre le flux check sur le véhicule.',
        ],
        { related: [{ href: '/reception', label: 'Réception express' }] },
      ),
      CHEF_ATELIER: g(
        'Fiche client',
        'Consultation client et véhicules associés.',
        ['Voir l’historique des OT', 'Accéder aux véhicules'],
        ['Ouvrez un véhicule pour l’historique atelier'],
      ),
      ADMIN: g(
        'Fiche client',
        'Gestion complète fiche client.',
        ['Modifier', 'Soft delete si doublon (via process admin)'],
        ['Évitez la suppression brute en base'],
      ),
    },
  },
  {
    id: 'customers',
    priority: 40,
    match: (p) => p === '/customers',
    indexHref: '/customers',
    indexLabel: 'Clients',
    guides: {
      RECEPTIONNISTE: g(
        'Clients',
        'Répertoire clients de l’atelier.',
        [
          'Rechercher par nom ou téléphone',
          'Créer un nouveau client',
          'Ouvrir une fiche client',
        ],
        [
          'Barre de recherche en haut.',
          'Nouveau client : minimum prénom, nom, téléphone.',
        ],
        { related: [{ href: '/reception', label: 'Réception express' }] },
      ),
      CHEF_ATELIER: g(
        'Clients',
        'Consultation et recherche clients.',
        ['Rechercher un client', 'Ouvrir fiche et véhicules'],
        ['Utilisez la recherche avant de créer un doublon'],
      ),
      ADMIN: g(
        'Clients',
        'Gestion du portefeuille clients.',
        ['CRUD clients', 'Détecter doublons'],
        ['Créez via réception si possible pour éviter les doublons'],
      ),
    },
  },
  {
    id: 'vehicle-detail',
    priority: 70,
    match: (p) => /^\/vehicles\/[^/]+$/.test(p) && !p.includes('/reception'),
    indexHref: '/vehicles',
    indexLabel: 'Véhicules',
    guides: {
      TECHNICIEN: g(
        'Fiche véhicule',
        'Historique utile au diagnostic.',
        [
          'Voir les OT précédents sur ce véhicule',
          'Consulter notes et réparations passées',
        ],
        ['Ouvrez un ancien OT pour le contexte'],
        { related: [{ href: '/workshop', label: 'Ordres de travail' }] },
      ),
      RECEPTIONNISTE: g(
        'Fiche véhicule',
        'Gestion du véhicule et réception.',
        [
          'Modifier plaque, marque, modèle',
          'Lancer réception / nouvel OT',
          'Voir le client propriétaire',
        ],
        [
          'Bouton Réceptionner pour le check d’entrée.',
          'Nouvel OT si nouvelle visite.',
        ],
      ),
      CHEF_ATELIER: g(
        'Fiche véhicule',
        'Historique atelier du véhicule.',
        ['Voir tous les OT', 'Accéder au client'],
        ['Utilisez l’historique avant un devis complexe'],
      ),
    },
  },
  {
    id: 'vehicles',
    priority: 40,
    match: (p) => p === '/vehicles',
    indexHref: '/vehicles',
    indexLabel: 'Véhicules',
    guides: {
      TECHNICIEN: g(
        'Véhicules',
        'Liste des véhicules — consultation.',
        ['Rechercher par plaque', 'Ouvrir historique'],
        ['Recherche plaque sans espaces'],
      ),
      RECEPTIONNISTE: g(
        'Véhicules',
        'Tous les véhicules enregistrés.',
        [
          'Rechercher par plaque',
          'Créer un véhicule (lié à un client)',
          'Ouvrir fiche véhicule',
        ],
        [
          'Créez toujours le client avant si nouveau.',
          'Plaque exacte = retrouvaille rapide.',
        ],
      ),
      CHEF_ATELIER: g(
        'Véhicules',
        'Parc véhicules de l’atelier.',
        ['Recherche', 'Accès historique OT'],
        ['Filtrez par plaque'],
      ),
    },
  },
  // ─── Planning & dashboard ─────────────────────────────────────────────────
  {
    id: 'planning',
    priority: 60,
    match: (p) => p === '/planning',
    indexHref: '/planning',
    indexLabel: 'Planning',
    guides: {
      RECEPTIONNISTE: g(
        'Planning',
        'Calendrier des rendez-vous.',
        [
          'Voir les RDV du jour',
          'Créer un nouveau RDV',
          'Ouvrir un RDV → client / véhicule',
        ],
        [
          'Bouton Nouveau RDV : client, créneau, motif.',
          'Le jour J : transformez le RDV en OT (réception express ou fiche OT).',
        ],
        { related: [{ href: '/reception', label: 'Réception express' }] },
      ),
      CHEF_ATELIER: g(
        'Planning',
        'Anticipation charge atelier.',
        [
          'Voir la charge par jour',
          'Ajuster les RDV',
        ],
        [
          'Comparez avec le dashboard le matin.',
          'Évitez la surbooking sans technicien disponible.',
        ],
      ),
      ADMIN: g(
        'Planning',
        'Supervision des rendez-vous.',
        ['Consulter et créer des RDV'],
        ['Les RDV ne remplacent pas l’OT — validez à l’arrivée'],
      ),
    },
  },
  {
    id: 'dashboard',
    priority: 55,
    match: (p) => p === '/dashboard',
    indexHref: '/dashboard',
    indexLabel: 'Tableau de bord',
    guides: {
      CHEF_ATELIER: g(
        'Tableau de bord',
        'Vue du jour : OT, urgences, indicateurs.',
        [
          'Lire les stats (en cours, reçus, terminés, CA)',
          'Traiter les tâches prioritaires',
          'Voir véhicules en attente d’assignation',
        ],
        [
          'Commencez chaque matin ici.',
          'Cliquez une carte prioritaire pour ouvrir l’OT.',
        ],
        { related: [{ href: '/workshop', label: 'Ordres de travail' }] },
      ),
      RECEPTIONNISTE: g(
        'Tableau de bord',
        'Vue d’accueil : RDV et activité du jour.',
        [
          'Accès rapide réception express',
          'Voir les RDV à venir',
        ],
        [
          'Utilisez le raccourci Réception pour un client sans RDV.',
        ],
        { related: [{ href: '/reception', label: 'Réception express' }] },
      ),
      ADMIN: g(
        'Tableau de bord',
        'Pilotage global du garage.',
        [
          'Indicateurs clés',
          'Accès rapides aux modules',
        ],
        [
          'Croisez avec Rapports hebdomadaires.',
        ],
        { related: [{ href: '/reports', label: 'Rapports' }] },
      ),
    },
  },
  // ─── Stock ────────────────────────────────────────────────────────────────
  {
    id: 'stock-movements',
    priority: 65,
    match: (p) => p === '/stock/movements',
    indexHref: '/stock/movements',
    indexLabel: 'Mouvements stock',
    guides: {
      CHEF_ATELIER: g(
        'Mouvements stock',
        'Entrées, sorties et historique des pièces.',
        [
          'Enregistrer une entrée fournisseur',
          'Consulter les sorties liées aux OT',
          'Tracer un mouvement suspect',
        ],
        [
          'Nouvelle entrée : pièce, quantité, référence bon.',
          'Les sorties OT sont automatiques depuis la fiche OT.',
        ],
      ),
      ADMIN: g(
        'Mouvements stock',
        'Audit des mouvements.',
        ['Tout consulter', 'Contrôler les écarts'],
        ['Filtrez par pièce ou période'],
      ),
    },
  },
  {
    id: 'stock-detail',
    priority: 64,
    match: (p) => /^\/stock\/[^/]+$/.test(p) && p !== '/stock/movements',
    indexHref: '/stock',
    indexLabel: 'Stock',
    guides: {
      CHEF_ATELIER: g(
        'Fiche pièce',
        'Détail d’une référence stock.',
        [
          'Voir quantité, seuil mini, prix',
          'Ajuster stock ou seuil',
          'Voir mouvements récents',
        ],
        [
          'Rouge = sous seuil : commandez.',
          'Modifiez le seuil selon la rotation.',
        ],
      ),
      ADMIN: g(
        'Fiche pièce',
        'Gestion catalogue.',
        ['Modifier fiche pièce', 'Corriger stock'],
        ['Documentez les ajustements manuels'],
      ),
    },
  },
  {
    id: 'stock',
    priority: 40,
    match: (p) => p === '/stock',
    indexHref: '/stock',
    indexLabel: 'Stock & Pièces',
    guides: {
      CHEF_ATELIER: g(
        'Stock & Pièces',
        'Catalogue et alertes rupture.',
        [
          'Voir pièces en alerte (rouge)',
          'Créer une nouvelle pièce',
          'Lancer vente comptoir (avec caissier)',
          'Accéder aux mouvements',
        ],
        [
          'Traitez les alertes rouges en priorité.',
          'ASP depuis la fiche OT si pièce absente du catalogue.',
        ],
        { related: [{ href: '/stock/movements', label: 'Mouvements' }] },
      ),
      TECHNICIEN: g(
        'Stock & Pièces',
        'Consultation disponibilité.',
        [
          'Rechercher une pièce',
          'Voir quantité disponible',
        ],
        [
          'Consommez les pièces depuis la fiche OT (onglet Pièces).',
          'Pas de stock : observation Critique + chef.',
        ],
      ),
      CAISSIER: g(
        'Stock & Pièces',
        'Vente comptoir sans OT.',
        [
          'Vendre des pièces au comptoir',
          'Encaisser et décrémenter le stock',
        ],
        [
          'Bouton Vente comptoir.',
          'Ajoutez lignes, client de passage, paiement.',
        ],
      ),
      ADMIN: g(
        'Stock & Pièces',
        'Gestion catalogue complète.',
        ['CRUD pièces', 'Alertes', 'Mouvements'],
        ['Paramétrez les seuils mini par pièce'],
      ),
    },
  },
  // ─── Équipe, admin, rapports ──────────────────────────────────────────────
  {
    id: 'team',
    priority: 60,
    match: (p) => p === '/team',
    indexHref: '/team',
    indexLabel: 'Équipe',
    guides: {
      ADMIN: g(
        'Équipe',
        'Gestion des comptes employés.',
        [
          'Ajouter un membre (rôle, email, mot de passe temporaire)',
          'Réinitialiser un mot de passe (icône clé)',
          'Suspendre / réactiver un compte',
          'Voir qui est connecté récemment',
        ],
        [
          'Nouveau membre : choisissez le rôle adapté (droits minimaux).',
          'Communiquez le mot de passe temporaire en personne.',
          'Suspendre = révocation JWT immédiate.',
        ],
        { tips: ['Ne partagez pas les mots de passe par SMS non sécurisé.'] },
      ),
      CHEF_ATELIER: g(
        'Équipe',
        'Vue de l’équipe (lecture + création techniciens selon droits).',
        [
          'Voir les techniciens et leurs spécialités',
          'Créer un technicien si autorisé',
        ],
        [
          'Utilisez cette vue pour savoir qui assigner sur un OT.',
        ],
      ),
      SUPER_ADMIN: g(
        'Équipe',
        'Comptes sur la plateforme (tous garages).',
        [
          'Créer administrateurs d’atelier',
          'Suspendre un accès abusif',
          'Reset mot de passe',
        ],
        [
          'Chaque atelier gère ensuite sa propre équipe.',
          'Suspendre coupe toutes les sessions actives.',
        ],
        { related: [{ href: '/admin/tenants', label: 'Tenants' }] },
      ),
    },
  },
  {
    id: 'reports',
    priority: 60,
    match: (p) => p === '/reports',
    indexHref: '/reports',
    indexLabel: 'Rapports',
    guides: {
      ADMIN: g(
        'Rapports',
        'Chiffre d’affaires et performance.',
        [
          'CA par période',
          'Performance par technicien',
          'Exporter pour la direction',
        ],
        [
          'Consultez chaque semaine.',
          'Comparez techniciens pour les entretiens.',
        ],
      ),
      SUPER_ADMIN: g(
        'Rapports',
        'Vue consolidée activité.',
        [
          'Analyser l’activité globale',
          'Comparer les ateliers si multi-tenant',
        ],
        [
          'Utilisez les filtres de période.',
        ],
      ),
    },
  },
  {
    id: 'audit',
    priority: 60,
    match: (p) => p === '/audit',
    indexHref: '/audit',
    indexLabel: 'Journal d\'audit',
    guides: {
      ADMIN: g(
        'Journal d\'audit',
        'Traçabilité : qui a fait quoi.',
        [
          'Filtrer par utilisateur, action, entité',
          'Investiger une modification prix / paiement',
        ],
        [
          'Filtrez entityType + date.',
          'Notez l’IP et l’heure pour un litige.',
        ],
      ),
      SUPER_ADMIN: g(
        'Journal d\'audit',
        'Audit plateforme multi-ateliers.',
        [
          'Voir toutes les actions sensibles',
          'Détecter abus administrateur',
        ],
        [
          'Croisez avec Demandes démo et Équipe.',
        ],
      ),
    },
  },
  {
    id: 'history',
    priority: 55,
    match: (p) => p === '/history',
    indexHref: '/history',
    indexLabel: 'Historique',
    guides: {
      CHEF_ATELIER: g(
        'Historique',
        'Chronologie des actions atelier.',
        ['Voir l’activité récente sur OT et clients'],
        ['Filtrez par type si disponible'],
      ),
      RECEPTIONNISTE: g(
        'Historique',
        'Suivi des dernières opérations.',
        ['Consulter les OT récents'],
        ['Utile pour retrouver une entrée du jour'],
      ),
      ADMIN: g(
        'Historique',
        'Historique opérationnel.',
        ['Superviser l’activité'],
        ['Complément au journal d’audit'],
        { related: [{ href: '/audit', label: 'Journal d\'audit' }] },
      ),
    },
  },
  {
    id: 'notifications-sms',
    priority: 60,
    match: (p) => p === '/notifications',
    indexHref: '/notifications',
    indexLabel: 'Notifications SMS',
    guides: {
      ADMIN: g(
        'Notifications SMS',
        'Historique des SMS (simulation Orange / MTN CM).',
        [
          'Voir SMS envoyés, en attente, échoués',
          'Relancer un client manuellement si échec',
          'Lier un SMS à un OT (référence)',
        ],
        [
          'Filtrez par téléphone.',
          'Statut FAILED = vérifier numéro ou réseau.',
        ],
        {
          tips: [
            'La cloche en haut = notifications in-app (pas SMS).',
            'Les SMS véhicule prêt partent souvent automatiquement au statut Prêt.',
          ],
        },
      ),
    },
  },
  {
    id: 'settings',
    priority: 60,
    match: (p) => p === '/settings',
    indexHref: '/settings',
    indexLabel: 'Paramètres',
    guides: {
      ADMIN: g(
        'Paramètres atelier',
        'Identité du garage sur devis et factures.',
        [
          'Modifier nom, adresse, téléphone, email, NIU',
          'Taux main-d’œuvre par défaut',
          'Logo et mentions légales si configurés',
        ],
        [
          'Mettez à jour après changement de siège ou TVA.',
          'Enregistrez — les prochains devis utilisent les nouvelles valeurs.',
        ],
      ),
      CHEF_ATELIER: g(
        'Paramètres atelier',
        'Consultation des infos garage (modification selon droits).',
        ['Vérifier coordonnées sur les PDF'],
        ['Demandez à l’admin si une modification est nécessaire'],
      ),
    },
  },
  {
    id: 'demo-requests',
    priority: 60,
    match: (p) => p === '/demo-requests',
    indexHref: '/demo-requests',
    indexLabel: 'Demandes démo',
    guides: {
      SUPER_ADMIN: g(
        'Demandes démo',
        'Leads issus du formulaire public /demo.',
        [
          'Voir nouvelles demandes (badge menu)',
          'Changer statut (nouveau, contacté, converti…)',
          'Ajouter des notes de suivi',
          'Recevoir alerte cloche à chaque demande',
        ],
        [
          'Traitez les « Nouveau » en priorité.',
          'Après contact : passez en Contacté puis Converti si inscription.',
        ],
        { related: [{ href: '/team', label: 'Créer compte admin' }] },
      ),
    },
  },
  {
    id: 'admin-tenants',
    priority: 60,
    match: (p) => p === '/admin/tenants',
    indexHref: '/admin/tenants',
    indexLabel: 'Tenants',
    guides: {
      SUPER_ADMIN: g(
        'Tenants',
        'Gestion multi-ateliers / organisations.',
        [
          'Lister les tenants et garages',
          'Voir le statut de chaque organisation',
        ],
        [
          'Un tenant peut avoir plusieurs garages.',
          'L’inscription publique crée un nouveau tenant automatiquement.',
        ],
        { related: [{ href: '/demo-requests', label: 'Demandes démo' }] },
      ),
    },
  },
];

const SORTED_PAGES = [...GUIDE_PAGES].sort((a, b) => b.priority - a.priority);

export function getPageGuide(pathname: string, role: GuideRole): GuideContent | null {
  for (const page of SORTED_PAGES) {
    if (!page.match(pathname)) continue;
    const guide = page.guides[role];
    if (guide) return guide;
  }
  return null;
}

export interface GuideIndexEntry {
  id: string;
  href: string;
  label: string;
  title: string;
}

/** Toutes les pages documentées pour un profil (menu « Voir aussi »). */
export function getProfileGuideIndex(role: GuideRole): GuideIndexEntry[] {
  const seen = new Set<string>();
  const entries: GuideIndexEntry[] = [];

  for (const page of GUIDE_PAGES) {
    const guide = page.guides[role];
    if (!guide) continue;
    if (seen.has(page.indexHref)) continue;
    seen.add(page.indexHref);
    entries.push({
      id: page.id,
      href: page.indexHref,
      label: page.indexLabel,
      title: guide.title,
    });
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Guide générique si la page n’a pas encore de fiche dédiée. */
export function getFallbackGuide(pathname: string, role: GuideRole): GuideContent {
  return {
    title: 'Aide',
    intro: `Pas encore de fiche détaillée pour cette URL. Consultez le menu latéral ou les raccourcis ci-dessous selon votre profil (${role}).`,
    canDo: ['Utiliser la recherche ⌘K pour trouver un client, véhicule ou OT', 'Ouvrir le guide sur une page du menu principal'],
    steps: [
      'Identifiez la section du menu (Principal, Gestion, Réglages).',
      'Si vous ne trouvez pas une action, demandez à votre administrateur (droits RBAC).',
    ],
    tips: ['Le bouton ? affiche une aide adaptée à chaque écran documenté.'],
  };
}
