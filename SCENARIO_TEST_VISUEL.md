# 🧪 Scénario de test visuel — Atelier 2026

> **Avant de commencer** : nettoie la base avec `npm run reset:demo`, puis lance `npm run dev`.
> Toutes les actions ci-dessous se font dans le navigateur sur `http://localhost:3000`.

---

## Comptes disponibles

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@atelier.cm | Atelier2026! | ADMIN (tout faire) |
| reception@atelier.cm | Atelier2026! | RÉCEPTIONNISTE |
| chef@atelier.cm | Atelier2026! | CHEF ATELIER |
| tech1@atelier.cm | Atelier2026! | TECHNICIEN |
| caisse@atelier.cm | Atelier2026! | CAISSIER |

---

## PARTIE 1 — Authentification

### 1.1 Login valide
1. Aller sur `/login`
2. Saisir `admin@atelier.cm` / `Atelier2026!`
3. Cliquer **Se connecter**
4. ✅ Redirection vers le tableau de bord, sidebar visible

### 1.2 Login invalide
1. Retourner sur `/login` (ou se déconnecter d'abord)
2. Saisir `faux@atelier.cm` / `MauvaisMotDePasse`
3. Cliquer **Se connecter**
4. ✅ On reste sur `/login`, aucune redirection

### 1.3 Login par code employé
1. Sur `/login`, saisir `EMP-001` / `Atelier2026!`
2. ✅ Connexion réussie (même compte que admin@atelier.cm)

### 1.4 Protection des routes
1. Se déconnecter (icône déconnexion en haut à droite de la sidebar)
2. Essayer d'accéder directement à `/workshop`
3. ✅ Redirection automatique vers `/login`

---

## PARTIE 2 — Créer un client

> Connecté en tant qu'**admin@atelier.cm**

### 2.1 Nouveau client particulier
1. Aller sur `/customers`
2. ✅ La page affiche "Aucun client" (base vide)
3. Cliquer **Nouveau client**
4. Remplir :
   - **Nom complet** : `Martin Ndjock`
   - **Téléphone** : `+237 699 00 11 22`
   - **Email** : `martin.ndjock@gmail.cm`
   - **Ville** : `Yaoundé`
5. Cliquer **Enregistrer**
6. ✅ Toast "Client créé", le client apparaît dans la liste

### 2.2 Nouveau client entreprise
1. Cliquer **Nouveau client** à nouveau
2. Sélectionner le type **Entreprise**
3. Remplir :
   - **Raison sociale** : `Transport Douala Express`
   - **Téléphone** : `+237 233 42 10 00`
4. Enregistrer
5. ✅ L'entreprise apparaît dans la liste avec l'icône "bâtiment"

---

## PARTIE 3 — Ajouter un véhicule

### 3.1 Véhicule pour Martin Ndjock
1. Cliquer sur **Martin Ndjock** dans la liste clients
2. ✅ Page détail client — section "Véhicules" vide
3. Cliquer **Nouveau Véhicule**
4. Remplir :
   - **Immatriculation** : `LT-4521-A`
   - **Marque** : `Toyota`
   - **Modèle** : `Hilux`
   - **Année** : `2019`
   - **Kilométrage** : `87000`
5. Enregistrer
6. ✅ Le véhicule `LT-4521-A Toyota Hilux` apparaît dans la fiche client

### 3.2 Vérifier la fiche véhicule
1. Cliquer sur la carte du véhicule
2. ✅ Page `/vehicles/[id]` avec les infos et un historique vide

---

## PARTIE 4 — Créer un Ordre de Travail

### 4.1 Création de l'OT
1. Aller sur `/workshop`
2. ✅ Page vide "Aucun ordre de travail"
3. Cliquer **Nouvel OT**
4. Dans la modale :
   - **Chercher un client** : taper `Martin` → sélectionner `Martin Ndjock`
   - **Chercher un véhicule** : sélectionner `LT-4521-A Toyota Hilux`
   - **Kilométrage à l'entrée** : `87500`
   - **Plainte client** : `Bruit métallique au freinage avant droit, fumée légère à froid`
5. Cliquer **Ouvrir l'OT**
6. ✅ Toast "OT créé", carte OT visible avec statut **BROUILLON**

### 4.2 Ouvrir la fiche OT
1. Cliquer sur la carte de l'OT
2. ✅ Page détail : référence `OT-XXXXX`, statut BROUILLON, client/véhicule affichés

---

## PARTIE 5 — Workflow de l'OT (machine à états)

> Chaque bouton de transition est affiché uniquement si la transition est autorisée.

### 5.1 BROUILLON → REÇU
1. Sur la fiche OT, cliquer **→ Reçu**
2. ✅ Statut passe à **REÇU**, historique mis à jour

### 5.2 REÇU → EN DIAGNOSTIC
1. Cliquer **→ En diagnostic**
2. ✅ Statut **EN DIAGNOSTIC**

### 5.3 EN DIAGNOSTIC → DEVIS EN ATTENTE
1. Cliquer **→ Devis en attente**
2. ✅ Statut **DEVIS EN ATTENTE** — indique qu'un devis doit être préparé

### 5.4 Créer le devis via l'API
> La création de devis depuis l'UI n'est pas encore implémentée.
> Utilise la console du navigateur (F12 → Console) :

```javascript
// Remplacer OT_ID par l'ID réel de l'OT (visible dans l'URL)
// Remplacer CUSTOMER_ID par l'ID réel du client

const OT_ID = 'colle-ici-lid-de-lot';
const CUSTOMER_ID = 'colle-ici-lid-du-client';
const token = localStorage.getItem('atelier_token');

const res = await fetch('/api/billing/quotes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    serviceOrderId: OT_ID,
    customerId: CUSTOMER_ID,
    subtotal: 75000,
    lines: [
      {
        lineType: 'LABOR',
        description: 'Remplacement plaquettes de frein AV',
        quantity: 1,
        unitPriceXaf: 45000,
        discountPct: 0,
      },
      {
        lineType: 'LABOR',
        description: 'Main d\'œuvre diagnostic',
        quantity: 2,
        unitPriceXaf: 15000,
        discountPct: 0,
      }
    ]
  })
});
const quote = await res.json();
console.log('Devis créé :', quote.id, quote.reference);
```

5. ✅ Dans la console : `Devis créé : xxxxxxx  QT-XXXXX`
6. Rafraîchir la page OT → ✅ Le devis apparaît dans la section "Devis"

### 5.5 DEVIS EN ATTENTE → DEVIS APPROUVÉ
1. Sur la fiche OT, cliquer **→ Devis approuvé**
2. ✅ Statut **DEVIS APPROUVÉ**

### 5.6 Approuver le devis côté Facturation
1. Aller sur `/billing` → onglet **Devis**
2. ✅ Le devis `QT-XXXXX` est visible en statut **BROUILLON**
3. Cliquer sur le devis
4. Cliquer **Approuver (client a signé)**
5. ✅ Statut du devis passe à **APPROUVÉ**, bouton "Convertir en Facture" apparaît

### 5.7 Retour sur l'OT — DEVIS APPROUVÉ → EN COURS
1. Retourner sur la fiche OT
2. Cliquer **→ En cours**
3. ✅ Statut **EN COURS**

### 5.8 EN COURS → QC EN ATTENTE
1. Cliquer **→ QC en attente** (simule fin des travaux)
2. ✅ Statut **CONTRÔLE QUALITÉ EN ATTENTE**

### 5.9 QC EN ATTENTE → QC VALIDÉ
1. Cliquer **→ QC validé**
2. ✅ Statut **QC VALIDÉ**

### 5.10 QC VALIDÉ → PRÊT
1. Cliquer **→ Prêt**
2. ✅ Statut **PRÊT** — véhicule prêt à être remis au client

---

## PARTIE 6 — Facturation

### 6.1 Convertir le devis en facture
1. Aller sur `/billing` → onglet **Devis**
2. Cliquer sur le devis `QT-XXXXX`
3. Cliquer **Convertir en Facture**
4. ✅ Toast "Facture créée", bouton "Convertir" remplacé par "Déjà facturé"

### 6.2 Vérifier la facture
1. Aller sur `/billing` → onglet **Factures**
2. ✅ La facture `FAC-XXXXX` est visible, statut **ÉMISE**
3. Cliquer sur la facture
4. ✅ Détail : montant HT, TVA 19.25%, timbre, total TTC visible

### 6.3 Passer l'OT en FACTURÉ
1. Retourner sur la fiche OT
2. Cliquer **→ Facturé**
3. ✅ Statut **FACTURÉ**

### 6.4 Enregistrer un paiement partiel
1. Sur la page détail facture, cliquer **Enregistrer un paiement**
2. Remplir :
   - **Montant** : `40000`
   - **Mode de paiement** : `Espèces`
3. Cliquer **Valider le paiement**
4. ✅ Toast "Paiement enregistré", statut facture → **PARTIEL**

### 6.5 Solder la facture
1. Cliquer à nouveau **Enregistrer un paiement**
2. Entrer le solde restant (montant total - 40000)
3. Valider
4. ✅ Statut facture → **PAYÉE**, badge vert

### 6.6 Clôturer l'OT
1. Retourner sur la fiche OT
2. Cliquer **→ Clôturé**
3. ✅ Statut **CLÔTURÉ** — fin du cycle

---

## PARTIE 7 — Stock

### 7.1 Consulter le catalogue pièces
1. Aller sur `/stock`
2. ✅ Liste des pièces en catalogue (pré-chargées ou vide)

### 7.2 Ajouter une pièce au catalogue
1. Cliquer **Nouvelle pièce** (si bouton visible)
2. Remplir les informations de la pièce
3. ✅ Pièce créée avec stock initial

### 7.3 Voir les mouvements de stock
1. Aller sur `/stock/movements`
2. ✅ Historique des entrées/sorties

---

## PARTIE 8 — Planning

### 8.1 Créer un rendez-vous
1. Aller sur `/planning`
2. Cliquer **Nouveau RDV**
3. Remplir :
   - **Client** : `Martin Ndjock`
   - **Véhicule** : `LT-4521-A`
   - **Date/heure** : demain matin
   - **Motif** : `Révision périodique`
4. ✅ RDV créé, visible dans le calendrier

---

## PARTIE 9 — Équipe

### 9.1 Voir la liste des employés
1. Aller sur `/team`
2. ✅ Les 6 employés de test sont listés (EMP-001 à EMP-005 + SYS-001)

### 9.2 Créer un nouvel employé
1. Cliquer **Nouveau membre**
2. Remplir :
   - **Prénom** : `Serge`
   - **Nom** : `Mballa`
   - **Email** : `serge.mballa@atelier.cm`
   - **Rôle** : `TECHNICIEN`
3. ✅ Employé créé avec code `EMP-006`, mot de passe par défaut `Atelier2026!`

---

## PARTIE 10 — Tests de rôles

### 10.1 Login RÉCEPTIONNISTE
1. Se déconnecter
2. Se connecter avec `reception@atelier.cm`
3. ✅ Peut créer des clients, véhicules et OTs

### 10.2 Login TECHNICIEN
1. Se connecter avec `tech1@atelier.cm`
2. Aller sur `/workshop`
3. ✅ Peut voir les OTs mais ne peut **pas** changer le statut vers des états non autorisés (ex: DIAGNOSING → QUOTE_PENDING refusé avec 403)

### 10.3 Login CAISSIER
1. Se connecter avec `caisse@atelier.cm`
2. Aller sur `/billing`
3. ✅ Peut enregistrer des paiements, créer des factures
4. Aller sur `/team`
5. ✅ Accès refusé (rôle insuffisant) ou page vide selon l'implémentation frontend

---

## PARTIE 11 — Vente comptoir (sans OT)

> Vente directe sans ordre de travail, pour les clients de passage.

1. Aller sur `/billing` (ou l'URL de vente comptoir si disponible)
2. ✅ Vérifier que le formulaire de vente comptoir est accessible

---

## PARTIE 12 — Rapports

1. Aller sur `/reports`
2. ✅ Affiche le chiffre d'affaires et les performances des techniciens
3. Vérifier que les données du scénario (OT clôturé + facture payée) sont reflétées

---

## ✅ Checklist finale

| # | Élément | Attendu | OK ? |
|---|---------|---------|------|
| 1 | Login/logout | Fonctionne | ☐ |
| 2 | Protection routes | Redirect /login | ☐ |
| 3 | Création client | Toast + liste | ☐ |
| 4 | Création véhicule | Apparaît fiche client | ☐ |
| 5 | Création OT | Carte OT visible | ☐ |
| 6 | Cycle complet OT | DRAFT → CLOSED | ☐ |
| 7 | Création devis (API) | Visible sur fiche OT | ☐ |
| 8 | Approbation devis | Statut APPROUVÉ | ☐ |
| 9 | Conversion facture | Statut ÉMISE | ☐ |
| 10 | Paiement partiel | Statut PARTIEL | ☐ |
| 11 | Solde facture | Statut PAYÉE | ☐ |
| 12 | Clôture OT | Statut CLÔTURÉ | ☐ |
| 13 | RBAC rôles | 403 sur actions interdites | ☐ |
| 14 | Rapports | Données cohérentes | ☐ |
