# TASKS — Corrections Atelier Maître

> Généré le 2026-05-23 — Croisement Schéma Prisma × DTOs × Controllers × Postman × WORKFLOWS.md

Statut : `[ ]` à faire · `[x]` fait · `[~]` partiel / acceptable

---

## 🔴 CRITIQUE — Sécurité & Data Integrity

### ~~T01~~ ✅ — `PATCH /workshop/ot/:id/status` sans `@RequirePermission`
**Fichier :** [src/modules/workshop/workshop.controller.ts](src/modules/workshop/workshop.controller.ts#L99)  
**Problème :** L'endpoint de changement de statut OT n'a aucun guard de permission. N'importe quel utilisateur authentifié (y compris TECHNICIEN) peut forcer une transition.  
**Correction :**
```typescript
@Patch('ot/:id/status')
@RequirePermission('ORD_CREATE')  // ← ajouter
async updateStatus(...)
```
**Risque :** Un technicien peut passer un OT en CLOSED ou CANCELLED sans autorisation.

---

### ~~T02~~ ✅ — `POST /stock/parts` utilise `body: any` — aucune validation
**Fichier :** [src/modules/stock/stock.controller.ts](src/modules/stock/stock.controller.ts#L151)  
**Problème :** `@Body() body: any` — le ValidationPipe ne valide rien. Des champs arbitraires (y compris `qtyAvailable`) peuvent être injectés, corrompant le catalogue.  
**Correction :** Créer `CreatePartDto` avec `class-validator` et l'utiliser en remplacement.  
**Champs requis d'après le schema :** `reference`, `nameFr`, `category`, `salePriceXaf`. Optionnels : `oemReference`, `barcode`, `nameEn`, `unit`, `purchasePriceXaf`, `qtyInStock`, `minThreshold`, `maxThreshold`, `storageLocation`, `preferredSupplierId`, `compatibleMakes`, `isConsumable`.  
**Note :** `qtyAvailable` est une colonne GENERATED — le controller la stripe déjà mais `body: any` ne rejette pas les autres champs invalides.

---

### ~~T03~~ ✅ — Permissions d'écriture Stock protégées par `STK_VIEW`
**Fichier :** [src/modules/stock/stock.controller.ts](src/modules/stock/stock.controller.ts)  
**Problème :** Les opérations d'écriture sont protégées par le droit de lecture :

| Endpoint | Permission actuelle | Permission correcte |
|----------|---------------------|---------------------|
| `POST /stock/movement` (ligne 89) | `STK_VIEW` | `STK_CREATE` (à créer) ou séparation `STK_WRITE` |
| `POST /stock/asp` (ligne 116) | `STK_VIEW` | idem |
| `PATCH /stock/parts/:id` (ligne 157) | `STK_VIEW` | idem |

**Correction :** Soit créer une permission `STK_CREATE` dans le seed, soit utiliser une permission existante appropriée. À minima : documenter le choix intentionnel si c'est voulu.

---

### ~~T04~~ ✅ — `QualityControl.serviceOrderId @unique` bloque le multi-round QC
**Fichier :** [prisma/schema.prisma](prisma/schema.prisma#L558)  
**Problème :** `serviceOrderId @unique` → un seul enregistrement QC par OT. Or le workflow complet est :
```
IN_PROGRESS → QC_PENDING → QC_REJECTED → IN_PROGRESS → QC_PENDING → QC_DONE
```
La 2ème tentative de QC échouera avec une erreur P2002 (unique constraint).  
**Newman-env.json confirme :** `otQcRound: "2"` — le scénario multi-round est bien testé et est censé fonctionner.  
**Correction :** Supprimer `@unique` sur `serviceOrderId` et ajouter un champ `round Int @default(1)` avec `@@unique([serviceOrderId, round])`.  
**Migration requise.** Vérifier aussi le controller `addQualityControl` qui devra gérer l'incrément de round.

---

## 🟠 IMPORTANT — DTOs manquants (validation absente)

> Le `ValidationPipe(whitelist: true, forbidNonWhitelisted: true)` **ne fonctionne pas** sur des interfaces TypeScript inline. Il ne valide que les classes décorées avec `class-validator`. Les endpoints ci-dessous ne rejettent pas les champs inconnus et n'appliquent aucune contrainte de type.

### ~~T05~~ ✅ — DTOs manquants dans WorkshopController
**Fichier :** [src/modules/workshop/workshop.controller.ts](src/modules/workshop/workshop.controller.ts)  
À créer dans `src/modules/workshop/dto/` :

| Méthode | DTO à créer | Champs clés |
|---------|-------------|-------------|
| `POST /workshop/ot` | `CreateServiceOrderDto` | `vehicleId` UUID requis, `customerId` UUID requis, `clientComplaint` string requis, `priority?` IsIn(['LOW','NORMAL','HIGH','URGENT']), `mileageIn?` Int min 0, `promisedAt?` DateString |
| `PATCH /workshop/ot/:id/status` | `UpdateOTStatusDto` | `status` IsEnum(OTStatus) requis, `reason?` string, `cancellationReason?` string |
| `POST /workshop/ot/:id/observation` | `CreateObservationDto` | `description` string requis, `category?` IsIn([...]), `severity?` IsIn(['INFO','WARNING','URGENT']), `includeInQuote?` boolean |
| `POST /workshop/ot/:id/work-item` | `CreateWorkItemDto` | `laborCatalogId` UUID requis, `quantity?` Decimal, `discountPct?` Decimal 0-100, `unitPriceXaf` number requis |
| `POST /workshop/ot/:id/reception-check` | `CreateReceptionCheckDto` | `mileageAtReception` Int requis, `fuelLevel?` Int 0-8, `globalNotes?` string, `checkItems?` Array |
| `POST /workshop/ot/:id/quality-control` | `CreateQualityControlDto` | `overallResult` IsEnum(CheckResult) requis, `checklist?` array, `returnNotes?` string |

---

### ~~T06~~ ✅ — DTOs manquants dans BillingController
**Fichier :** [src/modules/billing/billing.controller.ts](src/modules/billing/billing.controller.ts)  
À créer dans `src/modules/billing/dto/` :

| Méthode | DTO à créer | Champs clés |
|---------|-------------|-------------|
| `POST /billing/quotes` | `CreateQuoteDto` | `serviceOrderId` UUID requis, `customerId` UUID requis, `subtotal` number requis > 0, `lines` Array `@ValidateNested` requis |
| `POST /billing/payment` | `RecordPaymentDto` | `invoiceId` UUID requis, `amount` number requis > 0, `method` IsEnum(PaymentMethod) requis, `transactionRef?` string, `idempotencyKey?` string |

Classe imbriquée pour les lignes du devis : `QuoteLineDto` avec `lineType` IsIn(['LABOR','PART']), `quantity` > 0, `unitPriceXaf` > 0, etc.

---

### ~~T07~~ ✅ — DTOs manquants dans StockController
**Fichier :** [src/modules/stock/stock.controller.ts](src/modules/stock/stock.controller.ts)  
À créer dans `src/modules/stock/dto/` :

| Méthode | DTO à créer | Champs clés |
|---------|-------------|-------------|
| `POST /stock/movement` | `CreateStockMovementDto` | `partId` UUID requis, `type` IsEnum(StockMovementType) requis, `quantity` number requis ≠ 0, `serviceOrderId?` UUID, `referenceDoc?` string, `unitPriceXaf?` number > 0 |
| `POST /stock/asp` | `CreateASPDto` | `partId` UUID requis, `serviceOrderId` UUID requis, `quantity` > 0, `purchasePrice` > 0, `salePrice` > 0, `supplierName` string requis |
| `POST /stock/parts` | `CreatePartDto` | voir T02 |

---

## 🟡 MINEUR — Port & Config

### ~~T08~~ ✅ — Port incorrect dans `Scenarios_Tests_Automatiques.postman_collection.json`
**Fichier :** [postman/Scenarios_Tests_Automatiques.postman_collection.json](postman/Scenarios_Tests_Automatiques.postman_collection.json#L10)  
**Problème :** `"value": "http://localhost:3006/api"` → doit être `http://localhost:3001/api`  
**Cause :** Le `.env.example` définit `API_PORT="3001"`. Le defaut dans `main.ts` est 3006 mais l'env override à 3001.  
**Correction :** Changer la valeur de la variable `baseUrl` dans la collection.

---

### ~~T09~~ ✅ — Port incorrect dans CLAUDE.md
**Fichier :** [CLAUDE.md](CLAUDE.md)  
**Problème :** `## Ports & Proxy` indique `NestJS → **3006**` alors que le port configuré est **3001**.  
**Correction :** Mettre à jour la section Ports & Proxy et toutes les références à 3006 dans CLAUDE.md.

---

### ~~T10~~ ✅ — WORKFLOWS.md §4 dit "aucun lien Appointment ↔ ServiceOrder" — c'est faux
**Fichier :** [WORKFLOWS.md](WORKFLOWS.md#L170)  
**Problème :** Le workflow §4 indique "Il n'y a **aucun lien** entre un `Appointment` et un `ServiceOrder`" — or :
- Le schema Prisma a `serviceOrderId?` sur le modèle `Appointment` (ligne 902)
- Le DTO `CreateAppointmentDto` expose `serviceOrderId?: string` avec `@IsUUID()`
- La relation est donc **déjà implémentée**

**Correction :** Mettre à jour WORKFLOWS.md §4 pour refléter la réalité et supprimer l'item "Migration requise" de la liste des automatisations.

---

## 🟡 MINEUR — Schema non-typé

### ~~T11~~ ✅ — `OTWorkItem.status` et `ASPPurchase.status` sont des String libres
**Fichiers :** [prisma/schema.prisma](prisma/schema.prisma#L543) · [prisma/schema.prisma](prisma/schema.prisma#L737)  
**Problème :** Ces deux champs acceptent n'importe quelle chaîne. Des valeurs invalides peuvent être insérées.  
**Correction recommandée :**
```prisma
// Ajouter dans les enums :
enum WorkItemStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
  @@map("work_item_status_t")
}

enum ASPStatus {
  PENDING
  AUTHORIZED
  RECEIVED
  ACCOUNTED
  CANCELLED
  @@map("asp_status_t")
}
```
Puis remplacer `status String` par `status WorkItemStatus` et `status ASPStatus` dans les modèles respectifs.  
**Migration requise.**

---

## 🟡 MINEUR — Team Service

### ~~T12~~ ✅ — Mot de passe hardcodé dans `TeamService.create()`
**Fichier :** [src/modules/team/team.service.ts](src/modules/team/team.service.ts#L82)  
**Situation :** `bcrypt.hash('Atelier2026!', 10)` — tout nouveau membre créé reçoit ce mot de passe par défaut.  
**Évaluation :** Acceptable pour un atelier fermé (l'admin remet le mot de passe). Mais non documenté.  
**À faire :** Ajouter un champ optionnel `password?: string` dans `CreateTeamMemberDto` — si fourni, l'utiliser ; sinon, appliquer le défaut. Documenter le comportement dans la réponse API.

---

### ~~T13~~ ✅ — Changement de rôle impossible via l'API team
**Fichier :** [src/modules/team/dto/team.dto.ts](src/modules/team/dto/team.dto.ts#L26)  
**Problème :** `UpdateTeamMemberDto` exclut `roleCode` → impossible de changer le rôle d'un utilisateur via `PATCH /team/:id`. Il n'y a pas non plus d'endpoint dédié `POST /team/:id/role`.  
**Correction :** Soit ajouter un endpoint `PATCH /team/:id/role` avec un DTO `AssignRoleDto { roleCode: string }`, soit réintégrer `roleCode` dans `UpdateTeamMemberDto` en gérant la logique de rôle dans le service.

---

## 📋 Tests Postman — Couverture manquante

### T14 — Fin du cycle OT non couverte dans `Atelier_2026`
**Fichier :** [postman/Atelier_2026.postman_collection.json](postman/Atelier_2026.postman_collection.json)  
**Manque :** Les transitions `QC_DONE → READY → INVOICED → CLOSED` ne sont pas dans la collection principale.  
**À ajouter (dans le dossier 03) :**
- `03.12 — Transition QC_PENDING → QC_DONE` (overallResult: OK)
- `03.13 — Transition QC_DONE → READY`
- `03.14 — Vérifier SMS "véhicule prêt" déclenché (GET /notifications/sms)`
- `03.15 — Créer facture depuis devis`
- `03.16 — Enregistrer paiement complet`
- `03.17 — Vérifier OT → INVOICED auto (après paiement)`
- `03.18 — Transition INVOICED → CLOSED`
- `03.19 — Cas d'erreur : CANCELLED avec motif obligatoire`
- `03.20 — Cas d'erreur : CANCELLED sans motif → 400`

---

### T15 — Scenarios manquants dans `Scenarios_Tests_Automatiques`
**Fichier :** [postman/Scenarios_Tests_Automatiques.postman_collection.json](postman/Scenarios_Tests_Automatiques.postman_collection.json)  
**À ajouter :**

| # | Profil | Scénario |
|---|--------|----------|
| 5 | Réceptionniste | Créer un rendez-vous + lier à l'OT créé (`serviceOrderId`) |
| 6 | Chef Atelier | Créer une immobilisation véhicule (WAITING_PARTS) |
| 7 | Magasinier | Créer un ASP (`POST /stock/asp`) |
| 8 | Caissier | Vente comptoir (`POST /counter-sales`) |
| 9 | Admin | Lister les logs d'audit (`GET /audit`) |

---

### T16 — Tests GET manquants dans `Atelier_2026`
Les endpoints de lecture ne sont pas couverts :
- `GET /workshop/ot` (liste avec filtre status)
- `GET /workshop/ot/:id` (détail complet avec relations)
- `GET /billing/quotes/:id`
- `GET /billing/invoices/:id`
- `GET /stock/parts` (avec filtre lowStock)
- `GET /workshop/labor-catalog`

---

## ✅ Automatisations WORKFLOWS.md — État réel

> Pour information : contrairement à ce que laissait entendre WORKFLOWS.md, plusieurs automatisations sont **déjà implémentées** dans le backend.

| Automatisation | État réel |
|----------------|-----------|
| #1 OT → INVOICED auto quand Invoice PAID | ✅ **Implémenté** dans `BillingService.recordPayment()` via `setImmediate` |
| #2 SMS "véhicule prêt" quand OT → READY | ✅ **Implémenté** dans `WorkshopService.updateStatus()` via BullMQ |
| #3 Rappel RDV J-1 | ❌ Non implémenté — `SchedulerService` à compléter |
| #5 SMS alerte stock | ⚠️ **Queue alimentée** dans `StockService` mais **consumer absent** — les jobs s'accumulent sans traitement |
| #6 Réservation pièces auto QUOTE_APPROVED | ❌ Non implémenté |
| #7 SMS devis envoyé | ❌ Non implémenté |
| #8 Relance J+15 facture | ❌ Non implémenté (J+7 existe via SchedulerService) |
| Lien Appointment ↔ ServiceOrder | ✅ **Déjà dans le schema** (voir T10) |

---

## 📊 Résumé des priorités

| Priorité | Tâche | Impact | Effort |
|----------|-------|--------|--------|
| 🔴 | T01 — Guard permission updateStatus | Sécurité | 5 min |
| 🔴 | T02 — CreatePartDto (body: any) | Sécurité | 30 min |
| 🔴 | T04 — QC @unique → multi-round | Bug métier critique | 1h + migration |
| 🟠 | T03 — Permissions STK_VIEW vs écriture | Sécurité RBAC | 15 min |
| 🟠 | T05 — DTOs Workshop | Robustesse | 2h |
| 🟠 | T06 — DTOs Billing | Robustesse | 1h |
| 🟠 | T07 — DTOs Stock | Robustesse | 1h |
| 🟡 | T08 — Port Postman Scenarios | Tests | 2 min |
| 🟡 | T09 — Port CLAUDE.md | Doc | 2 min |
| 🟡 | T10 — WORKFLOWS.md §4 faux | Doc | 5 min |
| 🟡 | T11 — Enums WorkItem/ASP status | Qualité schema | 30 min + migration |
| 🟡 | T12 — Password par défaut | UX | 20 min |
| 🟡 | T13 — Changement de rôle | Fonctionnel | 30 min |
| 🟡 | T14 — Tests Postman fin cycle OT | Couverture | 1h |
| 🟡 | T15 — Tests Postman scénarios manquants | Couverture | 2h |
| 🟡 | T16 — Tests Postman GET manquants | Couverture | 30 min |
