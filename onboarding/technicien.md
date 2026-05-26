# Onboarding — Technicien

Votre espace de travail est la page **Ordres de Travail**. Tout ce que vous faites — diagnostic, observations, consommation de pièces, avancement — se passe sur la fiche OT.

---

## Connexion

URL fournie par votre admin. Email + mot de passe communiqués à l'embauche.

---

## Flux quotidien type

### 1. Voir vos OT du jour

1. **Ordres de Travail** (`/workshop`) → onglet **En cours**
2. Les OT qui vous sont assignés apparaissent en tête de liste
3. Un OT en statut **REÇU** est prêt pour le diagnostic

### 2. Démarrer un diagnostic

1. Cliquez sur l'OT → lisez la **plainte client** (en haut de la fiche)
2. Consultez le **check de réception** pour connaître l'état du véhicule à l'entrée
3. Onglet **Observations** → **Ajouter une observation** :
   - Catégorie (mécanique, électricité, carrosserie…)
   - Description précise de ce que vous constatez
   - Sévérité (Info / Avertissement / Critique)
   - Cochez **"À inclure dans le devis"** si la réparation est nécessaire
4. Le chef d'atelier utilisera vos observations pour créer le devis

### 3. Travailler sur un OT (statut IN_PROGRESS)

Une fois le devis approuvé par le client, le chef d'atelier vous notifie. L'OT passe en **EN COURS**.

1. Onglet **Travaux** → commencez les items qui vous sont assignés
2. Notez vos heures réelles sur chaque item de travail
3. Si vous consommez une pièce du stock : onglet **Pièces** → sélectionnez la pièce, saisissez la quantité
4. Le stock se met à jour automatiquement

### 4. Signaler la fin des travaux

1. Changez l'état des items de travail en **Terminé**
2. Ajoutez une observation finale si vous avez constaté autre chose pendant les travaux
3. Prévenez le chef d'atelier — il lance le contrôle qualité

---

## Pages que vous utilisez

| Page | Accès |
|------|-------|
| `/workshop` | Tableau de bord des OT |
| `/workshop/[id]` | Fiche OT détaillée (votre espace principal) |
| `/vehicles/[id]` | Historique du véhicule (utile pour le diagnostic) |
| `/stock` | Consulter les pièces disponibles |

---

## Ce que vous ne gérez pas

- Créer ou modifier les clients et véhicules → Réceptionniste
- Créer des devis → Chef d'atelier
- Émettre des factures → Caissier

---

## Points clés

- **Observations = traçabilité**. Tout ce que vous constatez doit être noté, même si ce n'est pas dans la plainte initiale. Ça couvre l'atelier en cas de litige.
- Soyez précis sur les heures réelles : elles servent à calculer la performance et les futurs devis.
- Si une pièce manque en stock, signalez-le en observation avec sévérité **Critique** — le chef d'atelier déclenchera une commande ASP (achat spécial).
- Ne changez pas le statut de l'OT vous-même — c'est le chef d'atelier qui pilote la machine à états.
