# Cartographie des APIs, Endpoints et Schémas — Atelier Maître

Ce document est généré à partir de la lecture directe du code source NestJS (controllers + services) et du schéma Prisma. Il décrit chaque module, ses endpoints, ses schémas d'entrée/sortie, ses règles de traitement métier et les triggers de base de données.

**Base URL Backend** : `http://localhost:3006/api`  
**Authentification** : JWT Bearer Token (sauf routes `@Public()`)  
**Base de données** : PostgreSQL 16 via Supabase + Prisma 7

---

## 1. Schémas de Données Principaux & Enums

### A. Rôles et Permissions (RBAC)

Le projet utilise un système d'autorisation granulaire combinant Rôles et Permissions :

**Permissions disponibles** :

| Code | Périmètre |
|------|-----------|
| `VEH_VIEW` | Voir les clients et véhicules |
| `VEH_CREATE` | Créer/modifier/supprimer les clients et véhicules |
| `ORD_VIEW` | Consulter le planning, l'équipe et les OT |
| `ORD_CREATE` | Ouvrir/modifier/assigner des OT et des rendez-vous |
| `STK_VIEW` | Voir le stock, enregistrer des mouvements et des ASP |
| `FAC_CREATE` | Créer des devis, des factures et enregistrer des paiements/ventes comptoir |

**Rôles & Matrice des Permissions (Seed par défaut)** :

| Rôle | Permissions |
|------|-------------|
| `ADMIN` | Bypass complet de toutes les barrières |
| `CHEF_ATELIER` | `VEH_VIEW`, `VEH_CREATE`, `ORD_VIEW`, `ORD_CREATE`, `STK_VIEW`, `STK_CREATE`, `FAC_CREATE` |
| `TECHNICIEN` | `VEH_VIEW`, `ORD_VIEW`, `STK_VIEW` |
| `RECEPTIONNISTE` | `VEH_VIEW`, `VEH_CREATE`, `ORD_VIEW`, `ORD_CREATE` |
| `CAISSIER` | `VEH_VIEW`, `ORD_VIEW`, `FAC_CREATE`, `STK_VIEW` |

---

### B. Enums de Statuts (Prisma)

```
OTStatus        : DRAFT → RECEIVED → DIAGNOSING → QUOTE_PENDING → QUOTE_APPROVED
                  → IN_PROGRESS → QC_PENDING → QC_REJECTED → QC_DONE → READY
                  → INVOICED → CLOSED  (ou CANCELLED depuis quasiment n'importe quel état)

QuoteStatus     : DRAFT → SENT → APPROVED → REJECTED → REVISED → BILLED

InvoiceStatus   : DRAFT → ISSUED → PARTIAL → PAID → DISPUTED → CANCELLED

PaymentMethod   : CASH | ORANGE_MONEY | MTN_MOBILE_MONEY | BANK_TRANSFER | CHECK

StockMovementType : PURCHASE | OT_CONSUMPTION | ASP_PURCHASE | COUNTER_SALE
                    | RETURN | ADJUSTMENT | TRANSFER

PartStatus      : PENDING | ASP_ORDERED | STOCK_RESERVED | RECEIVED | CONSUMED | CANCELLED

AppointmentStatus : SCHEDULED | CONFIRMED | CANCELLED | NO_SHOW | COMPLETED

UserStatus      : ACTIVE | SUSPENDED | DELETED

VehicleStatus   : IN_WORKSHOP | WAITING_PICKUP | IMMOBILIZED | DELIVERED
```

---

### C. Machine à États OT — Transitions Autorisées

Codées dans `src/modules/workshop/workshop.service.ts` (`OT_TRANSITIONS`) :

| État actuel | → Transitions autorisées |
|-------------|--------------------------|
| `DRAFT` | `RECEIVED`, `CANCELLED` |
| `RECEIVED` | `DIAGNOSING`, `CANCELLED` |
| `DIAGNOSING` | `QUOTE_PENDING`, `CANCELLED` |
| `QUOTE_PENDING` | `QUOTE_APPROVED`, `CANCELLED` |
| `QUOTE_APPROVED` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `QC_PENDING`, `CANCELLED` |
| `QC_PENDING` | `QC_REJECTED`, `QC_DONE` *(pas de CANCELLED ici)* |
| `QC_REJECTED` | `IN_PROGRESS`, `CANCELLED` |
| `QC_DONE` | `READY` |
| `READY` | `INVOICED`, `CLOSED` |
| `INVOICED` | `CLOSED` |
| `CLOSED` | *(aucune transition)* |
| `CANCELLED` | `RECEIVED` *(correction d'erreur rare)* |

**Règles métier bloquantes** :
- `ORD-001` : Passage à `RECEIVED` → `mileageIn` obligatoire.
- `ORD-003` : Passage à `READY` → Toutes les lignes de pièces de devis doivent être `RECEIVED` ou `CONSUMED`.
- `ORD-004` : Passage à `CANCELLED` → `cancellationReason` obligatoire.

---

## 2. Règles de Calcul Fiscal (Localisation Cameroun)

Centralisé dans `BillingService.computeAmounts()` :

```
TVA      = subtotal × 0.1925   (arrondi à l'entier avec Math.round)
Timbre   = (subtotal + TVA) > 20 000 XAF ? 1 000 : 0
Total    = subtotal + TVA + Timbre
```

> ⚠️ Le timbre est appliqué si `(subtotal + taxAmount) > 20000`, pas sur le `total` final.

---

## 3. Cartographie des Endpoints par Module

---

### 🔑 Module : Authentification (`/api/auth`)

#### `POST /auth/login`
- **Accès** : Public (`@Public()`)
- **HTTP** : `200 OK`
- **In (Body)** :
  ```json
  {
    "identifier": "admin@atelier.cm",  // Email OU code employé (ex: ADM001)
    "password": "Atelier2026!"         // Accepte aussi le champ "passwordHash"
  }
  ```
- **Traitements** :
  1. Recherche par `email` OU `employeeCode` (Prisma `OR`).
  2. Vérifie `status === 'ACTIVE'` (sinon 401 "Compte désactivé").
  3. Compare le mot de passe via `bcrypt.compare`.
  4. Met à jour `lastLoginAt` en base.
  5. Génère un JWT signé avec `{ sub: userId, email, version: tokenVersion }`.
- **Out (200)** :
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "firstName": "Super",
      "lastName": "Admin",
      "email": "admin@atelier.cm",
      "employeeCode": "ADM001"
    }
  }
  ```
- **Erreurs** : `401` identifiants invalides | `401` compte désactivé

---

#### `POST /auth/logout`
- **Accès** : JWT Requis
- **HTTP** : `200 OK`
- **In** : En-tête `Authorization: Bearer <token>`
- **Traitements** : Incrémente `tokenVersion` → invalide tous les JWT existants de cet utilisateur.
- **Out (200)** :
  ```json
  { "success": true, "message": "Déconnecté avec succès (sessions invalidées)" }
  ```

---

#### `GET /auth/profile`
- **Accès** : JWT Requis
- **HTTP** : `200 OK`
- **Traitements** : Extrait les rôles et permissions de l'utilisateur connecté depuis le JWT enrichi par le guard.
- **Out (200)** :
  ```json
  {
    "id": "uuid",
    "firstName": "Super",
    "lastName": "Admin",
    "email": "admin@atelier.cm",
    "employeeCode": "ADM001",
    "status": "ACTIVE",
    "roles": ["ADMIN"],
    "permissions": ["VEH_VIEW", "VEH_CREATE", "ORD_VIEW", "ORD_CREATE", "STK_VIEW", "FAC_CREATE"]
  }
  ```

---

### 👥 Module : Équipe/Utilisateurs (`/api/team`)

#### `GET /team`
- **Accès** : Permission `ORD_VIEW`
- **In (Query Params)** :
  - `search`? : `string` — Recherche sur prénom, nom, email, code employé
  - `roleId`? : `uuid` — Filtre par rôle actif (`revokedAt = null`)
- **Traitements** : Exclut les utilisateurs supprimés (`deletedAt = null`). Le `passwordHash` n'est jamais exposé.
- **Out (200)** : Tableau d'utilisateurs avec leurs rôles actifs.
  ```json
  [{
    "id": "uuid",
    "employeeCode": "TEC001",
    "firstName": "Jean",
    "lastName": "Tchinda",
    "email": "jean@atelier.cm",
    "phone": "+237677...",
    "status": "ACTIVE",
    "roles": [{ "roleId": "...", "role": { "code": "TECHNICIEN", "label": "..." } }],
    "createdAt": "2026-01-01T00:00:00Z"
  }]
  ```

---

#### `GET /team/:id`
- **Accès** : Permission `ORD_VIEW`
- **In (Route Param)** : `id` (UUID)
- **Out (200)** : Objet utilisateur enrichi avec ses rôles actifs + OT assignés en cours + work-items en `IN_PROGRESS`.
- **Erreurs** : `404` membre introuvable

---

#### `POST /team`
- **Accès** : Rôles `ADMIN` ou `CHEF_ATELIER`
- **In (Body)** : Champs du modèle `User` (voir schéma Prisma).
- **Out (201)** : `{ id, firstName, lastName, email }`
- **Note** : Pas de hachage automatique du mot de passe dans ce endpoint — à utiliser avec précaution. La création via `auth` est préférable.

---

#### `PATCH /team/:id`
- **Accès** : Rôles `ADMIN` ou `CHEF_ATELIER`
- **In (Route + Body)** : Champs à mettre à jour.
- **Out (200)** : `{ id, firstName, lastName, email }`

---

#### `DELETE /team/:id`
- **Accès** : Rôle `ADMIN` uniquement
- **Traitements** : **Soft Delete** — définit `deletedAt = now()` et `status = 'DELETED'`.
- **Out (200)** : `{ id }`

---

### 🔧 Module : Ordres de Travail (`/api/workshop`)

#### `GET /workshop/ot`
- **Accès** : Permission `ORD_VIEW`
- **In (Query Params)** :
  - `status`? : `OTStatus`
  - `search`? : `string` — Recherche sur `reference`, `clientComplaint`, `customer.lastName`, `vehicle.plateNumber`
- **Out (200)** : Tableau d'OT avec `customer`, `vehicle`, `workItems`. Trié par `createdAt DESC`.

---

#### `GET /workshop/ot/:id`
- **Accès** : Permission `ORD_VIEW`
- **In (Route Param)** : `id` (UUID)
- **Out (200)** : OT complet avec :
  - `customer`, `vehicle`
  - `workItems` (+ `laborCatalog`, `technician`)
  - `observations` (+ `observer`)
  - `receptionChecks` (+ `checkItems` + `catalog`)
  - `statusHistory` (+ `user`), trié `changedAt DESC`
  - `quotes` (+ `lines`)
- **Erreurs** : `400` OT introuvable

---

#### `POST /workshop/ot`
- **Accès** : Permission `ORD_CREATE`
- **In (Body)** :
  ```json
  {
    "vehicleId": "uuid",
    "customerId": "uuid",
    "clientComplaint": "Problème de freinage",
    "priority": "URGENT",      // Optionnel — NORMAL | URGENT | EMERGENCY, défaut: NORMAL
    "mileageIn": 145000,       // Optionnel — si renseigné → status = RECEIVED
    "promisedAt": "2026-05-25T17:00:00Z" // Optionnel
  }
  ```
- **Traitements** :
  - Si `mileageIn` fourni → `status = RECEIVED`
  - Sinon → `status = DRAFT`
  - `openedBy` = utilisateur connecté (JWT)
  - Référence générée automatiquement : `OT-2026-XXXXX` (séquence SQL `seq_ot`)
- **Out (201)** : Objet `ServiceOrder` créé.

---

#### `PATCH /workshop/ot/:id/status`
- **Accès** : JWT Requis
- **In (Route + Body)** :
  ```json
  {
    "status": "IN_PROGRESS",
    "reason": "Démarrage des réparations",          // Optionnel
    "cancellationReason": "Client a annulé"         // Requis si status = CANCELLED
  }
  ```
- **Traitements (Transaction Prisma + Optimistic Locking)** :
  1. Récupère l'OT actuel (avec `workItems`, `quotes.lines`).
  2. Valide la transition dans `OT_TRANSITIONS[ot.status]`.
  3. Applique les règles `ORD-001`, `ORD-003`, `ORD-004`.
  4. Met à jour avec `version: { increment: 1 }` (conflit → `409`).
  5. **Trigger SQL** `trg_ot_status_history` → enregistre la transition dans `ot_status_history`.
  6. **AuditService** → écrit dans `audit_logs` (côté applicatif).
  7. **SMS automatique** : Si `targetStatus === READY` → ajoute un job BullMQ dans la queue `sms-notifications` (message "votre véhicule est prêt").
- **Out (200)** : L'OT mis à jour.
- **Erreurs** : `400` transition invalide | `400` règle métier | `409` conflit concurrent

---

#### `PATCH /workshop/ot/:id/assign`
- **Accès** : Permission `ORD_CREATE`
- **In (Route + Body)** :
  ```json
  { "assignedChefId": "uuid-du-technicien-chef" }
  ```
- **Traitements** : Met à jour `assignedChef` sur l'OT.
- **Out (200)** : L'OT mis à jour.

---

#### `POST /workshop/ot/:id/observation`
- **Accès** : JWT Requis
- **In (Body)** :
  ```json
  {
    "description": "Plaquettes de frein avant usées à 90%",
    "category": "FREINAGE",    // Optionnel, défaut: "AUTRE"
    "severity": "CRITICAL",    // Optionnel: INFO | WARNING | CRITICAL, défaut: "INFO"
    "includeInQuote": true     // Optionnel, défaut: true
  }
  ```
- **Traitements** : `observedBy` = utilisateur connecté. Si `includeInQuote: true`, ce constat sera proposé lors de la création du devis.
- **Out (201)** : Objet `TechnicianObservation` créé.

---

#### `POST /workshop/ot/:id/work-item`
- **Accès** : JWT Requis
- **In (Body)** :
  ```json
  {
    "laborCatalogId": "uuid",
    "quantity": 1.5,           // Nombre d'heures, défaut: 1
    "unitPriceXaf": 7500,
    "discountPct": 5           // 0-100, défaut: 0
  }
  ```
- **Out (201)** : Objet `OTWorkItem` créé.

---

#### `DELETE /workshop/ot/:id/work-item/:itemId`
- **Accès** : Permission `ORD_CREATE`
- **In (Route Params)** : `id` (OT UUID) + `itemId` (work-item UUID)
- **Traitements** : Suppression physique (`DELETE`). Vérifie que `serviceOrderId = id` (sécurité).
- **Out (200)** : L'objet `OTWorkItem` supprimé.

---

#### `POST /workshop/ot/:id/reception-check`
- **Accès** : JWT Requis
- **In (Body)** :
  ```json
  {
    "mileageAtReception": 145000,
    "fuelLevel": 75,           // 0-100%, défaut: 50
    "globalNotes": "Pare-brise fissuré"
  }
  ```
- **Out (201)** : Objet `ReceptionCheck` créé.

---

#### `POST /workshop/ot/:id/quality-control`
- **Accès** : Permission `ORD_CREATE`
- **In (Body)** :
  ```json
  {
    "overallResult": "OK",      // OK | WARNING | CRITICAL (enum CheckResult)
    "checklist": [
      { "item": "Serrage des roues", "status": "OK" },
      { "item": "Essai routier", "status": "OK" }
    ],
    "returnNotes": "Tout est en ordre" // Optionnel
  }
  ```
- **Traitements** : `isApproved = (overallResult === 'OK')`. `performedBy` = utilisateur connecté.
- **Out (201)** : Objet `QualityControl` créé.

---

#### `GET /workshop/labor-catalog`
- **Accès** : Permission `ORD_VIEW`
- **Traitements** : Retourne toutes les prestations standards actives (`isActive: true`), triées par `category ASC`.
- **Out (200)** : Tableau d'objets `LaborCatalog`.
  ```json
  [{
    "id": "uuid",
    "code": "MO-VIDANGE",
    "category": "ENTRETIEN",
    "descriptionFr": "Vidange moteur",
    "standardHours": 0.5,
    "unitPriceXaf": 5000,
    "isActive": true
  }]
  ```

---

### 💳 Module : Facturation (`/api/billing`)

#### `POST /billing/quote/compute`
- **Accès** : JWT Requis
- **In (Body)** : `{ "subtotal": 50000 }`
- **Traitements** : Calcul fiscal pur (pas d'écriture en base).
- **Out (201)** :
  ```json
  {
    "subtotal": 50000,
    "taxRate": 0.1925,
    "taxAmount": 9625,
    "stampDuty": 1000,
    "total": 60625
  }
  ```

---

#### `GET /billing/quotes`
- **Accès** : Permission `FAC_CREATE`
- **In (Query Params)** : `serviceOrderId`? (UUID — filtre par OT)
- **Out (200)** : Tableau de devis avec `customer`, `lines`, `serviceOrder.reference`, `creator`.

---

#### `GET /billing/quotes/:id`
- **Accès** : Permission `FAC_CREATE`
- **In (Route Param)** : `id` (UUID du devis)
- **Out (200)** : Devis unique avec `customer`, `lines` (+ `part`, `laborCatalog`), `serviceOrder.reference`.

---

#### `POST /billing/quotes`
- **Accès** : Permission `FAC_CREATE`
- **In (Body)** :
  ```json
  {
    "serviceOrderId": "uuid",
    "customerId": "uuid",
    "subtotal": 120000,
    "lines": [
      {
        "lineType": "PART",             // PART | LABOR
        "partId": "uuid-piece",         // Optionnel
        "laborCatalogId": null,         // Optionnel
        "description": "Filtre à huile",
        "quantity": 1,
        "unitPriceXaf": 15000,
        "discountPct": 0,               // Optionnel, défaut: 0
        "observationId": "uuid-constat" // Optionnel
      }
    ]
  }
  ```
- **Traitements** :
  1. Calcule `taxAmount`, `stampDuty`, `total` via `computeAmounts(subtotal)`.
  2. Pour chaque ligne : `lineTotalXaf = quantity × unitPriceXaf × (1 - discountPct/100)`.
  3. Crée le devis avec statut `DRAFT`. `createdBy` = utilisateur connecté.
- **Out (201)** : Objet `Quote` avec ses `lines`.

---

#### `POST /billing/quotes/:quoteId/approve`
- **Accès** : Permission `FAC_CREATE`
- **In (Route + Body)** :
  ```json
  {
    "clientApprovalMethod": "SIGNATURE",           // SMS | EMAIL | SIGNATURE, défaut: SIGNATURE
    "clientSignatureRef": "base64-ou-url"
  }
  ```
- **Traitements** : Met `status = APPROVED`, `approvedByClientAt = now()`.
- **Out (201)** : Le devis mis à jour.

---

#### `GET /billing/invoices`
- **Accès** : Permission `FAC_CREATE`
- **In (Query Params)** :
  - `customerId`? : UUID
  - `status`? : `InvoiceStatus`
- **Out (200)** : Tableau de factures avec `customer`, `lines`, `payments`, `serviceOrder.reference`, `creator`.

---

#### `GET /billing/invoices/:id`
- **Accès** : Permission `FAC_CREATE`
- **In (Route Param)** : `id` (UUID de la facture)
- **Out (200)** : Facture unique avec `customer`, `lines`, `payments`, `serviceOrder.reference`.

---

#### `POST /billing/invoice/from-quote/:quoteId`
- **Accès** : Permission `FAC_CREATE`
- **In (Route Param)** : `quoteId` (UUID — doit être en statut `APPROVED`)
- **Traitements (Transaction Prisma)** :
  1. Vérifie que le devis existe et est `APPROVED` (sinon `400`).
  2. Crée la facture avec `status = ISSUED`, `issuedAt = now()`, `dueDate = now() + 7 jours`, `balanceXaf = totalXaf`.
  3. Copie toutes les `QuoteLine` en `InvoiceLine`.
  4. Marque les observations non encore facturées (`includeInQuote: true`, `quotedAt: null`) → `quotedAt = now()`.
  5. Met le devis en `status = BILLED`.
- **Out (201)** : L'objet `Invoice` créé.
- **Erreurs** : `400` devis introuvable | `400` devis non APPROVED

---

#### `POST /billing/payment`
- **Accès** : Permission `FAC_CREATE`
- **In (Body)** :
  ```json
  {
    "invoiceId": "uuid",
    "amount": 25000,
    "method": "MTN_MOBILE_MONEY",
    "transactionRef": "TXN98492049",    // Optionnel
    "idempotencyKey": "uuid-unique"     // Optionnel — généré automatiquement si absent
  }
  ```
- **Traitements (Transaction Prisma + Fail-fast)** :
  1. Insère le paiement (`status = CONFIRMED`). Si `idempotencyKey` dupliqué → `400 (P2002)`.
  2. Agrège `SUM(amountXaf)` sur tous les paiements `CONFIRMED` de la facture.
  3. Calcule `balance = max(totalXaf - totalPaid, 0)`.
  4. Met à jour la facture : `amountPaidXaf`, `balanceXaf`, et `status` (`PARTIAL` ou `PAID`). Si `PAID` → `paidAt = now()`.
  5. **Automatisation asynchrone** : Si `balance <= 0` et OT lié → `setImmediate()` appelle `workshopService.updateStatus(otId, INVOICED)`.
- **Out (201)** : L'objet `Payment` créé.
- **Erreurs** : `400` double paiement | `400` facture introuvable

---

### 📦 Module : Stock (`/api/stock`)

#### `GET /stock/parts`
- **Accès** : Permission `STK_VIEW`
- **In (Query Params)** :
  - `search`? : `string` — Recherche sur `nameFr`, `reference`, `oemReference`
  - `category`? : `string`
  - `lowStock`? : `"true"` — Si présent, exécute la requête SQL raw dédiée
- **Traitements** : Si `lowStock=true` → requête SQL raw : `WHERE qty_available <= min_threshold AND is_active = true ORDER BY (qty_available - min_threshold) ASC`.
- **Out (200)** : Tableau de `PartsCatalog` avec `supplier`. Si `lowStock`, retour de colonnes spécifiques via `$queryRaw`.

---

#### `GET /stock/parts/low-stock`
- **Accès** : Permission `STK_VIEW`
- **Traitements** : Route dédiée au tableau de bord des alertes de stock. Même requête SQL raw que `GET /stock/parts?lowStock=true`.
- **Out (200)** :
  ```json
  [{ "id": "...", "reference": "HU-5W30-5L", "name_fr": "Huile 5W30 5L", "qty_in_stock": 2, "qty_available": 2, "min_threshold": 5, "category": "LUBRIFIANTS" }]
  ```

---

#### `GET /stock/movements`
- **Accès** : Permission `STK_VIEW`
- **In (Query Params)** :
  - `partId`? : UUID
  - `serviceOrderId`? : UUID
- **Out (200)** : 100 derniers mouvements (trié `performedAt DESC`) avec `part`, `performer`, `serviceOrder.reference`.

---

#### `GET /stock/parts/:id`
- **Accès** : Permission `STK_VIEW`
- **In (Route Param)** : `id` (UUID)
- **Out (200)** : Une pièce avec son `supplier`.

---

#### `POST /stock/parts`
- **Accès** : Permission `STK_VIEW`
- **In (Body)** : Champs de `PartsCatalog` (voir schéma Prisma).
- **Out (201)** : La pièce créée.
- **Note** : Pas de validation DTO stricte — passe directement à Prisma.

---

#### `PATCH /stock/parts/:id`
- **Accès** : Permission `STK_VIEW`
- **In (Route + Body)** : Champs à mettre à jour.
- **Out (200)** : La pièce mise à jour.

---

#### `POST /stock/movement`
- **Accès** : Permission `STK_VIEW`
- **In (Body)** :
  ```json
  {
    "partId": "uuid",
    "type": "PURCHASE",        // PURCHASE | ADJUSTMENT | RETURN | TRANSFER...
    "quantity": 10,
    "serviceOrderId": "uuid",  // Optionnel
    "referenceDoc": "BL-9829", // Optionnel
    "unitPriceXaf": 4500       // Optionnel
  }
  ```
- **Traitements (Transaction Prisma)** :
  1. Crée un `StockMovement` (les champs `qtyBefore`/`qtyAfter` sont gérés par le trigger SQL si configuré).
  2. **Alerte asynchrone** (`setImmediate`) : Si `qtyInStock <= minThreshold` après mouvement → ajoute un job dans la queue BullMQ `stock-alerts`.
- **Out (201)** : L'objet `StockMovement` créé.

---

#### `POST /stock/asp`
- **Accès** : Permission `STK_VIEW`
- **In (Body)** :
  ```json
  {
    "partId": "uuid",
    "serviceOrderId": "uuid",
    "quantity": 1,
    "purchasePrice": 22000,
    "salePrice": 30000,
    "supplierName": "Maison de la Pièce Douala"
  }
  ```
- **Traitements (Transaction Prisma)** :
  1. Crée un `ASPPurchase` (référence `ASP-2026-XXXXX`). `status = RECEIVED`, `receivedAt = now()`.
  2. Crée un mouvement `PURCHASE` (entrée) en stock.
  3. Crée un mouvement `OT_CONSUMPTION` (sortie immédiate, `quantity = -quantity`).
- **Out (201)** : L'objet `ASPPurchase` créé.

---

#### `GET /stock/suppliers`
- **Accès** : Permission `STK_VIEW`
- **Traitements** : Retourne tous les fournisseurs actifs, triés par `name ASC`.
- **Out (200)** : Tableau d'objets `Supplier`.

---

### 👤 Module : Clients (`/api/customers`)

#### `GET /customers`
- **Accès** : Permission `VEH_VIEW`
- **In (Query Params)** :
  - `search`? : Recherche sur `lastName` ou `phonePrimary`
  - `type`? : `INDIVIDUAL` | `COMPANY`
- **Out (200)** : Clients non supprimés (soft-delete géré par Prisma extension).

---

#### `POST /customers`
- **Accès** : Permission `VEH_CREATE`
- **In (Body — validé par class-validator)** :
  ```json
  {
    "customerType": "INDIVIDUAL",      // INDIVIDUAL | COMPANY
    "lastName": "Tchinda",
    "firstName": "Jean",               // Optionnel pour COMPANY
    "companyName": null,               // Requis pour COMPANY
    "phonePrimary": "+237677000000",   // Requis
    "phoneSecondary": null,            // Optionnel
    "email": "jean@email.cm",          // Optionnel, validé par @IsEmail
    "address": "Akwa",                 // Optionnel
    "city": "Douala",                  // Optionnel, défaut: "Douala"
    "isVip": false,                    // Optionnel, défaut: false
    "notes": null                      // Optionnel
  }
  ```
- **Out (201)** : L'objet `Customer` inséré.

---

#### `DELETE /customers/:id`
- **Accès** : Permission `VEH_CREATE`
- **Traitements** : **Soft Delete** — définit `deletedAt = now()`.
- **Out (200)** : Le client mis à jour.

---

### 🚗 Module : Véhicules (`/api/vehicles`)

#### `GET /vehicles/makes`
- **Accès** : Permission `VEH_VIEW`
- **Out (200)** : Tableau de `VehicleMake` (référentiel des marques).

---

#### `GET /vehicles/models?makeId=uuid`
- **Accès** : Permission `VEH_VIEW`
- **In (Query Param)** : `makeId` (UUID de la marque)
- **Out (200)** : Tableau de `VehicleModel` filtré par marque.

---

#### `POST /vehicles`
- **Accès** : Permission `VEH_CREATE`
- **In (Body)** :
  ```json
  {
    "customerId": "uuid",
    "plateNumber": "LT 1234 A",        // Requis — format regex
    "plateFormat": "NEW",              // Optionnel — NEW | OLD, défaut: NEW
    "vin": "1FA6P8CF...",              // Optionnel — unique
    "makeId": "uuid-marque",           // Optionnel
    "modelId": "uuid-modele",          // Optionnel
    "year": 2018,                      // Optionnel
    "color": "Noir",                   // Optionnel
    "fuelType": "ESSENCE",             // Optionnel
    "engineCode": "1NZ-FE",           // Optionnel
    "engineCc": 1500,                  // Optionnel
    "transmission": "MANUELLE",        // Optionnel
    "currentMileage": 128000           // Optionnel
  }
  ```
- **Out (201)** : Le véhicule créé (statut initial `DELIVERED`).

---

### 📅 Module : Planning (`/api/planning`)

#### `GET /planning/appointments`
- **Accès** : Permission `ORD_VIEW`
- **In (Query Params)** :
  - `date`? : `"YYYY-MM-DD"` — Retourne les RDV de ce jour entre `00:00:00` et `23:59:59`
  - `status`? : `AppointmentStatus`
- **Out (200)** : Tableau de rendez-vous avec `customer`, `vehicle`.

---

#### `POST /planning/appointments`
- **Accès** : Permission `ORD_CREATE`
- **In (Body)** :
  ```json
  {
    "customerId": "uuid",
    "vehicleId": "uuid",               // Optionnel
    "scheduledAt": "2026-05-23T09:00:00Z",
    "durationMinutes": 60,             // Optionnel, défaut: 60
    "reason": "Vidange et révision générale",
    "status": "SCHEDULED"             // Optionnel, défaut: SCHEDULED
  }
  ```
- **Out (201)** : L'objet `Appointment` créé.

---

### 🧾 Module : Ventes Comptoir (`/api/counter-sales`)

#### `GET /counter-sales`
- **Accès** : Permission `FAC_CREATE`
- **In (Query Params)** : `search`? — Recherche sur `reference`, `walkInName`, `customer.lastName`
- **Traitements** : Retourne les 50 dernières ventes comptoir (trié `createdAt DESC`).
- **Out (200)** :
  ```json
  [{
    "id": "uuid",
    "reference": "VCC-2026-00001",
    "customerId": null,
    "walkInName": "Client Passage",
    "walkInPhone": "+237...",
    "subtotalXaf": 15000,
    "taxAmountXaf": 2888,
    "stampDutyXaf": 0,
    "totalXaf": 17888,
    "paymentMethod": "CASH",
    "paidAt": "2026-05-22T...",
    "lines": [{ "partId": "uuid", "quantity": 1, "unitPriceXaf": 15000, "part": { ... } }],
    "seller": { "firstName": "Paul", "lastName": "Ewane" }
  }]
  ```
- **Note** : Le modèle `CounterSale` **n'a pas de champ `status`** — le statut est déduit de `paidAt`.

---

#### `POST /counter-sales`
- **Accès** : Permission `FAC_CREATE`
- **In (Body)** :
  ```json
  {
    "customerId": "uuid",              // Optionnel (client enregistré)
    "walkInName": "Client Passage",    // Optionnel (client de passage)
    "walkInPhone": "+237699...",       // Optionnel
    "subtotalXaf": 15000,              // Requis
    "paymentMethod": "CASH",           // Optionnel, défaut: CASH
    "paymentRef": "OM-REF-XXX",        // Optionnel
    "notes": "...",                    // Optionnel
    "lines": [
      {
        "partId": "uuid",
        "quantity": 2,
        "unitPriceXaf": 7500,
        "discountPct": 0,
        "lineTotalXaf": 15000          // Calculé côté frontend ou API
      }
    ]
  }
  ```
- **Traitements** :
  1. Calcule `taxAmountXaf = Math.round(subtotalXaf × 0.1925)`.
  2. Calcule `totalXaf = subtotalXaf + taxAmountXaf`.
  3. **Note** : Le timbre fiscal n'est **pas appliqué** ici (contrairement à `BillingService.computeAmounts`).
  4. `soldBy` = utilisateur connecté (JWT).
- **Out (201)** : Objet `CounterSale` avec ses lignes et les infos de pièces.

---

### 💬 Module : Notifications SMS (`/api/notifications`)

#### `POST /notifications/sms/send`
- **Accès** : Rôle `ADMIN` requis
- **In (Body)** :
  ```json
  {
    "phone": "+237699112233",
    "message": "Bonjour, votre véhicule est prêt.",
    "customerId": "uuid",              // Optionnel
    "lang": "fr"                       // Optionnel
  }
  ```
- **Traitements** : Ajoute un job dans la queue Redis BullMQ `sms-notifications`. Un worker consomme et simule la passerelle SMS (MTN/Orange CM).
- **Out (201)** : `{ "jobId": "...", "status": "Queued" }`

---

### 📊 Module : Rapports (`/api/reports`)

#### `GET /reports/revenue`
- **Accès** : Rôle `ADMIN`
- **In (Query Params)** : `startDate`? et `endDate`? (`YYYY-MM-DD`)
- **Traitements** : Agrège le chiffre d'affaires et le total encaissé depuis les factures `PAID`.
- **Out (200)** :
  ```json
  {
    "totalRevenue": 2450000,
    "totalCollected": 2450000,
    "period": { "startDate": "2026-01-01", "endDate": "2026-05-22" }
  }
  ```

---

#### `GET /reports/workshop-performance`
- **Accès** : Rôle `ADMIN`
- **Traitements** : Compare `estimatedHours` vs `actualHours` sur les `OTWorkItem` par technicien.
- **Out (200)** :
  ```json
  {
    "Jean Tchinda": { "estimatedHours": 14.5, "actualHours": 12.0 },
    "Paul Ewane": { "estimatedHours": 8.0, "actualHours": 9.5 }
  }
  ```

---

## 4. Triggers et Fonctions SQL (PostgreSQL 16)

Définis dans `prisma/custom_schema.sql`. À exécuter dans le SQL Editor Supabase **après** `prisma migrate`.

### Trigger 1 : `trg_ot_status_history`
- **Table** : `service_orders`
- **Événement** : `AFTER INSERT OR UPDATE OF status`
- **Effet** : Insère automatiquement une ligne dans `ot_status_history` avec `from_status`, `to_status`, `changed_by` (récupéré via la variable de session `app.current_user_id` ou `opened_by` comme fallback), et `changed_at`.
- **Sécurité** : Ignoré si `status` n'a pas changé (UPDATE sans changement).

### Trigger 2 : `trg_stock_consumption`
- **Table** : `quote_lines`
- **Événement** : `AFTER UPDATE OF part_status`
- **Effet** : Si `part_status` passe à `CONSUMED` et que `part_id` est renseigné :
  1. Verrouillage pessimiste `FOR UPDATE` sur `parts_catalog`.
  2. Vérifie `qty_in_stock >= quantity` (sinon `RAISE EXCEPTION` — *Fail-Fast SQL*).
  3. Insère un `StockMovement` `OT_CONSUMPTION` avec `quantity = -quantity`.
  4. Met à jour `parts_catalog.qty_in_stock = qty_in_stock - quantity`.
- **Acteur** : Résout `fn_current_user_id()` ou fallback sur `service_orders.opened_by`.

### Trigger 3 : `fn_trg_audit_generic` (optionnel)
- **État** : Défini mais **non attaché** par défaut.
- **Usage** : À activer sélectivement sur les tables sensibles (ex: `customers`, `invoices`).
- **Effet** : Insère dans `audit_logs` pour chaque `INSERT` ou `UPDATE`.

### Séquences & Génération de Références

| Séquence | Préfixe | Format | Exemple |
|----------|---------|--------|---------|
| `seq_ot` | `OT` | `OT-YYYY-NNNNN` | `OT-2026-00001` |
| `seq_quote` | `DEV` | `DEV-YYYY-NNNNN` | `DEV-2026-00001` |
| `seq_invoice` | `FAC` | `FAC-YYYY-NNNNN` | `FAC-2026-00001` |
| `seq_asp` | `ASP` | `ASP-YYYY-NNNNN` | `ASP-2026-00001` |
| `seq_counter` | `VCC` | `VCC-YYYY-NNNNN` | `VCC-2026-00001` |

Fonction : `fn_next_ref(prefix TEXT, seq_name TEXT)` — appelée via `dbgenerated()` dans le schéma Prisma.

---

## 5. Queues BullMQ (Redis)

| Queue | Jobs | Déclencheur | Worker |
|-------|------|-------------|--------|
| `sms-notifications` | `vehicle_ready` | `PATCH /workshop/ot/:id/status` → `READY` | `src/workers/` (simule SMS MTN/Orange) |
| `sms-notifications` | Job manuel | `POST /notifications/sms/send` | Idem |
| `stock-alerts` | `low-stock` | `POST /stock/movement` si stock ≤ seuil | Worker d'alerte stock |

---

## 6. Schéma Prisma — Modèles Clés

| Modèle Prisma | Table SQL | Clés Importantes |
|---------------|-----------|-----------------|
| `User` | `users` | `employeeCode`, `tokenVersion`, soft-delete via `deletedAt` |
| `Customer` | `customers` | `phonePrimary`, `customerType`, soft-delete via `deletedAt` |
| `Vehicle` | `vehicles` | `plateNumber` + `plateFormat`, `vin` unique, `status: VehicleStatus` |
| `ServiceOrder` | `service_orders` | `reference` (auto), `status: OTStatus`, `version` (optimistic lock) |
| `Quote` | `quotes` | `reference` (auto `DEV-`), `taxRate = 0.1925`, `stampDutyXaf` |
| `Invoice` | `invoices` | `reference` (auto `FAC-`), `balanceXaf`, `amountPaidXaf`, `creditNoteFor` (auto-référence) |
| `Payment` | `payments` | `idempotencyKey` unique, `status` (toujours `CONFIRMED`) |
| `PartsCatalog` | `parts_catalog` | `qtyAvailable` = colonne calculée, `minThreshold`, index `idx_parts_low_stock` |
| `StockMovement` | `stock_movements` | `movementType`, `qtyBefore`, `qtyAfter` (gérés par trigger SQL) |
| `ASPPurchase` | `asp_purchases` | `reference` (auto `ASP-`), `partDescription`, `status` (string) |
| `CounterSale` | `counter_sales` | `reference` (auto `VCC-`), pas de champ `status` |
| `LaborCatalog` | `labor_catalog` | `code` unique, `standardHours`, `unitPriceXaf` |

---

*Document généré par audit direct du code source — `src/modules/` + `prisma/schema.prisma` + `prisma/custom_schema.sql`.*
