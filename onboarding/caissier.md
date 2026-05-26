# Onboarding — Caissier

Votre rôle intervient en fin de cycle : le véhicule est prêt, le chef d'atelier a tout validé. Vous émettez la facture, encaissez le paiement, clôturez l'OT.

---

## Connexion

URL fournie par votre admin. Compte : `caisse@atelier.cm` en environnement de test.

---

## Flux quotidien type

### 1. Encaisser un véhicule prêt

Un OT en statut **READY** signifie que les travaux sont terminés et validés.

1. **Facturation** (`/billing`) → onglet **Factures** → cherchez ou attendez les OT en statut READY
2. Ou directement depuis **Ordres de Travail** → filtrez par **READY** → ouvrez l'OT → bouton **Créer la facture**
3. La facture se génère automatiquement depuis le devis approuvé (lignes, montants, TVA 19,25%, timbre si applicable)
4. Vérifiez les montants → **Émettre la facture** → statut **ÉMISE**
5. Encaissez :
   - Onglet **Paiements** sur la facture → **Enregistrer un paiement**
   - Sélectionnez le mode : Espèces / Orange Money / MTN Mobile Money / Virement / Chèque
   - Saisissez le montant et la référence de transaction (obligatoire pour les paiements mobiles)
6. Si paiement total → facture passe en **PAYÉE** → OT clôturé automatiquement
7. Si paiement partiel → facture passe en **PARTIEL** → vous pouvez enregistrer un second paiement plus tard

### 2. Vente comptoir (client sans OT)

Un client achète une pièce directement au comptoir, sans passage à l'atelier.

1. **Stock & Pièces** (`/stock`) → bouton **Vente comptoir** (ou depuis le menu)
2. Ajoutez les pièces vendues + quantités
3. Renseignez le client (ou laissez "client de passage" avec nom + téléphone)
4. Choisissez le mode de paiement → validez
5. Le stock se décrément automatiquement

### 3. Vérifier les impayés

1. **Facturation** → onglet **Factures** → filtrez par statut **PARTIEL** ou **ÉMISE**
2. Les factures en retard sont signalées visuellement
3. Contactez le client → enregistrez le paiement restant quand il arrive

---

## Pages que vous utilisez

| Page | Accès |
|------|-------|
| `/billing` | Devis et factures |
| `/billing/invoices/[id]` | Détail facture + paiements |
| `/billing/invoices/new` | Créer une facture manuelle (rare) |
| `/workshop` | Voir les OT en statut READY |
| `/stock` | Ventes comptoir |

---

## Calcul fiscal (rappel)

| Élément | Valeur |
|---------|--------|
| TVA | 19,25% sur le HT |
| Timbre fiscal | 1 000 XAF si total > 20 000 XAF |
| Total TTC | HT + TVA + Timbre |

Le système calcule tout automatiquement. Vous n'avez rien à saisir manuellement.

---

## Points clés

- **Ne créez jamais une facture sur un OT non-READY.** Attendez la validation QC du chef d'atelier.
- Pour Orange Money et MTN Mobile Money, la référence de transaction est obligatoire — demandez-la au client avant de valider.
- Un paiement enregistré ne peut pas être supprimé (traçabilité comptable). En cas d'erreur, signalez à l'administrateur.
- En cas de litige (`/billing` → statut **CONTESTÉE**), ne touchez à rien — c'est le chef d'atelier ou l'admin qui gère.
