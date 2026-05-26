# Onboarding — Chef d'atelier

Vous pilotez le flux de l'atelier de bout en bout : affectation des techniciens, devis, contrôle qualité, gestion du stock. Le dashboard est votre tour de contrôle.

---

## Connexion

URL fournie par votre admin. Compte : `chef@atelier.cm` en environnement de test.

---

## Flux quotidien type

### 1. Matin — prise en main

1. **Dashboard** (`/`) → lisez les 4 stats du jour (OT en cours, reçus, terminés, CA)
2. Bloc **Tâches prioritaires** → traitez les OT urgents en premier
3. Bloc **Véhicules en attente** → ce sont les OT REÇUS sans technicien assigné

### 2. Affecter un technicien à un OT

1. **Ordres de Travail** → cliquez sur l'OT en statut **REÇU**
2. Onglet **Infos** → **Assigner** → sélectionnez le technicien disponible
3. L'OT passe en **DIAGNOSING** — le technicien peut commencer

### 3. Créer un devis après diagnostic

Quand les observations du technicien sont complètes (statut **DIAGNOSING**) :

1. Ouvrez l'OT → onglet **Devis** → **Nouveau devis**
2. Les observations marquées "À inclure" s'importent automatiquement en lignes
3. Ajoutez/modifiez les lignes (main-d'œuvre, pièces)
4. Le système calcule automatiquement : HT + TVA 19,25% + timbre éventuel
5. **Envoyer au client** → statut devis **ENVOYÉ**
6. Client approuve → bouton **Marquer approuvé** → OT passe en **IN_PROGRESS**

### 4. Gérer le stock

- **Stock & Pièces** (`/stock`) → vue catalogue avec alertes rouge si stock bas
- **Nouvelle pièce** : bouton + en haut à droite
- **Mouvement d'entrée** (réapprovisionnement) : onglet **Mouvements** → **Entrée stock**
- **Achat spécial (ASP)** : si une pièce doit être achetée hors stock pour un OT spécifique → onglet **ASP** dans la fiche OT

### 5. Contrôle qualité (QC)

Quand les travaux sont terminés (technicien a tout validé) :

1. OT passe en **QC_PENDING** → ouvrez la fiche
2. Onglet **Contrôle Qualité** → remplissez la checklist
3. **Approuver** → OT passe en **QC_DONE** puis **READY**
4. **Rejeter** → OT repasse en **QC_REJECTED** → retour atelier avec motif

### 6. OT prêt → prévenir le client

1. Onglet **Notifications** dans la fiche OT → SMS automatique au client (simulation Orange/MTN)
2. Le caissier prend le relais pour la facturation

---

## Pages que vous utilisez

| Page | Accès |
|------|-------|
| `/` | Dashboard principal |
| `/workshop` | Tableau de tous les OT |
| `/workshop/[id]` | Fiche OT complète |
| `/billing` | Devis et factures |
| `/billing/quotes/[id]` | Détail et édition d'un devis |
| `/stock` | Catalogue pièces + alertes |
| `/stock/movements` | Historique des mouvements |
| `/team` | Vue de l'équipe |
| `/reports` | CA et performance techniciens |

---

## Lire les alertes stock

Sur `/stock`, une pièce apparaît en rouge quand `qtyAvailable ≤ minThreshold`.
Action immédiate : contacter le fournisseur ou créer un ASP sur l'OT concerné.

---

## Points clés

- **Ne sautez pas le QC.** Un véhicule qui part sans contrôle qualité engagera votre responsabilité.
- Les devis ont un système d'**idempotence** : si vous rechargez la page, les montants ne se dupliquent pas.
- Le champ **version** sur les OT empêche les modifications simultanées — si vous avez un conflit, rechargez et recommencez.
- Les rapports (`/reports`) montrent le taux d'efficacité par technicien : utilisez-les lors des entretiens hebdomadaires.
