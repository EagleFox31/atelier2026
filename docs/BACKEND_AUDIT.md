# Audit de Cohérence Backend — Atelier Maître
> Généré le 2026-05-21 · Base de données : Supabase (PostgreSQL 16)

---

## Résumé Exécutif

| Catégorie | Nombre |
|-----------|--------|
| 🔴 Bloquants (app ne démarre pas) | 3 |
| 🟠 Critiques (runtime / RBAC cassé) | 4 |
| 🟡 Incohérences (comportement inattendu) | 5 |
| 🔵 Endpoints manquants | 10 |
| ✅ Modules fonctionnels | 11 |

---

## 1. Architecture générale

### Stack
- **Runtime** : NestJS 11 + Next.js 15 dans un seul process (`server.ts → src/main.ts`)
- **ORM** : Prisma 7.7.0 sur PostgreSQL (Supabase)
- **Queue** : BullMQ + Redis
- **Auth** : JWT (1j) + `tokenVersion` pour révocation
- **RBAC** : Rôles + Permissions en base (seed partiel)

### Modules NestJS enregistrés dans `app.module.ts`
| Module | Controller | Service | Statut |
|--------|-----------|---------|--------|
| AuthModule | ✅ | ✅ | OK |
| WorkshopModule | ✅ | ✅ | OK (endpoints partiels) |
| StockModule | ✅ | ✅ | OK (endpoints partiels) |
| BillingModule | ✅ | ✅ | OK (endpoints partiels) |
| CustomersModule | ✅ | ✅ | OK |
| VehiclesModule | ✅ | ✅ | OK |
| TeamModule | ✅ | ✅ | OK |
| PlanningModule | ✅ | — | OK (direct Prisma) |
| NotificationsModule | ✅ | — | OK |
| ReportsModule | ✅ | — | OK (partiel) |
| SharedModule (Global) | AuditController | PrismaService + AuditService | OK |

---

## 2. 🔴 Bloquants — L'application ne peut pas démarrer correctement

### B1 · `schema.prisma` — `url` manquant dans le datasource
**Fichier** : `prisma/schema.prisma` lignes 6-8

```prisma
// ❌ ACTUEL — Prisma ne sait pas où se connecter
datasource db {
  provider = "postgresql"
}

// ✅ CORRIGÉ — Requis pour Supabase
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Pooler Supabase (pgbouncer=true)
  directUrl = env("DIRECT_URL")     // Connexion directe pour migrations
}
```

**Impact** : Sans `url`, Prisma lève une erreur à la génération du client et au démarrage. Aucune requête DB n'aboutit.

---

### B2 · `PrismaService.$use()` — Supprimé dans Prisma 7
**Fichier** : `src/shared/prisma/prisma.service.ts` lignes 24-59

La méthode `$use()` (middleware Prisma) a été dépréciée en Prisma 5 et **supprimée en Prisma 6+**. Le projet utilise Prisma **7.7.0**. L'appel `(this as any).$use(...)` contourne TypeScript mais échouera à l'exécution.

```typescript
// ❌ Supprimé en Prisma 7
(this as any).$use(async (params, next) => { ... });

// ✅ Remplacement avec $extends (Prisma 5+)
// À refactoriser avec PrismaClient.$extends({ query: { ... } })
```

**Impact** : Le middleware de soft-delete automatique est non fonctionnel. Les `findMany` ne filtrent pas `deletedAt: null` automatiquement (les services le font manuellement, donc partiellement sauvé, mais le comportement est incohérent).

---

### B3 · `StockController` — Référence de champ Prisma invalide
**Fichier** : `src/modules/stock/stock.controller.ts` ligne 36

```typescript
// ❌ Invalide — .fields.minThreshold n'est pas une valeur comparable
where.qtyAvailable = { lte: this.prisma.partsCatalog.fields.minThreshold };

// ✅ La route dédiée /stock/parts/low-stock utilise déjà $queryRaw, ce filtre
// inline peut simplement être supprimé ou remplacé par :
if (lowStock === 'true') {
  where.AND = [{ qtyAvailable: { lte: this.prisma.partsCatalog.fields.minThreshold } }];
  // OU utiliser $queryRaw comme dans getLowStockParts()
}
```

**Impact** : `GET /api/stock/parts?lowStock=true` lève une erreur runtime.

---

## 3. 🟠 Critiques — Comportement incorrect au runtime

### C1 · ~~Seed incomplet — RBAC cassé sur installation fraîche~~ ✅ CORRIGÉ
**Fichier** : `prisma/seed.ts`

**Correction apportée** :
- ✅ 5 rôles
- ✅ 6 permissions
- ✅ **`RolePermission`** — matrice complète rôles ↔ permissions
- ✅ **5 utilisateurs de test** (un par rôle, mot de passe `Atelier2026!`)
- ✅ 9 prestations `LaborCatalog` (étendu)
- ✅ `new PrismaClient()` sans le cast `as any`

**Matrice des permissions** :

| Rôle | VEH_VIEW | VEH_CREATE | ORD_VIEW | ORD_CREATE | STK_VIEW | FAC_CREATE |
|------|----------|-----------|----------|-----------|----------|-----------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CHEF_ATELIER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TECHNICIEN | ✅ | — | ✅ | — | ✅ | — |
| RECEPTIONNISTE | ✅ | ✅ | ✅ | ✅ | — | — |
| CAISSIER | ✅ | — | ✅ | — | — | ✅ |

---

### C2 · ~~`TeamController` — `@RequirePermission('ADMIN')` incorrect~~ ✅ CORRIGÉ
**Fichier** : `src/modules/team/team.controller.ts`

**Correction apportée** — remplacement des décorateurs et clarification des accès :

| Endpoint | Avant | Après |
|----------|-------|-------|
| `GET /team` | pas de garde (TODO commenté) | `@RequirePermission('ORD_VIEW')` |
| `GET /team/:id` | pas de garde (TODO commenté) | `@RequirePermission('ORD_VIEW')` |
| `POST /team` | `@RequirePermission('ADMIN')` ❌ | `@RequireRole('ADMIN', 'CHEF_ATELIER')` |
| `PATCH /team/:id` | `@RequirePermission('ADMIN')` ❌ | `@RequireRole('ADMIN', 'CHEF_ATELIER')` |
| `DELETE /team/:id` | `@RequirePermission('ADMIN')` ❌ | `@RequireRole('ADMIN')` |

---

### C3 · ~~`custom_schema.sql` — Colonne `updated_by` inexistante~~ ✅ CORRIGÉ
**Fichier** : `prisma/custom_schema.sql`

**Corrections apportées** :

1. **`fn_trg_ot_status_history`** — `COALESCE(NEW.updated_by, NEW.opened_by)` remplacé par `COALESCE(fn_current_user_id(), NEW.opened_by::UUID)` via une nouvelle fonction helper `fn_current_user_id()` qui lit `app.current_user_id` depuis la session PostgreSQL

2. **`fn_trg_stock_consumption`** — `NEW.updated_by` remplacé par `fn_current_user_id()` avec fallback sur `opened_by` de l'OT via sous-requête. Ajout d'une vérification de stock disponible (`RAISE EXCEPTION` si insuffisant) et d'un guard sur `part_id IS NULL`

3. **`CREATE TRIGGER` manquants** — les fonctions étaient définies mais jamais attachées aux tables. Ajout de :
   - `trg_ot_status_history` → `AFTER INSERT OR UPDATE OF status ON service_orders`
   - `trg_stock_consumption` → `AFTER UPDATE OF part_status ON quote_lines`
   - `DROP TRIGGER IF EXISTS` avant chaque création pour idempotence

4. **`fn_trg_audit_generic`** — laissé sans trigger par défaut (volontaire), avec instructions en commentaire pour l'activer sélectivement sur les tables souhaitées

---

### C4 · Double écriture dans `ot_status_history`
**Fichiers** : `src/modules/workshop/workshop.service.ts` + `prisma/custom_schema.sql`

- Le trigger SQL `fn_trg_ot_status_history` insère automatiquement dans `ot_status_history` à chaque `UPDATE` du statut
- `WorkshopService.updateStatus()` appelle aussi `this.audit.log(...)` mais vers `audit_logs` (différente table) — OK

⚠️ Si le trigger SQL est activé sur Supabase, chaque changement de statut insère **1 ligne dans `ot_status_history`** via le trigger. C'est correct. Mais `WorkshopService` n'essaie pas de créer lui-même des entrées dans `ot_status_history`, donc pas de doublon — juste à vérifier que le trigger est bien activé.

---

## 4. 🟡 Incohérences — Comportement inattendu mais non bloquant

### I1 · `BillingModule` et `StockModule` n'importent pas `SharedModule`
Ces deux modules injectent `PrismaService` mais n'importent pas `SharedModule`. Cela fonctionne car `SharedModule` est `@Global()`, mais c'est incohérent avec les autres modules qui importent `SharedModule` explicitement.

```typescript
// BillingModule — manque SharedModule dans imports:
@Module({
  providers: [BillingService],     // BillingService injecte PrismaService
  controllers: [BillingController], // BillingController injecte PrismaService
  exports: [BillingService],
})
```

---

### I2 · `JwtAuthGuard` — Catch trop large
**Fichier** : `src/guards/auth.guard.ts` ligne 60

```typescript
// ❌ Masque toutes les erreurs (DB down, token expiré, etc.)
} catch {
  throw new UnauthorizedException('Token invalide');
}
```

Une erreur de base de données retournera `401 Unauthorized` au lieu d'un `503`. Difficile à déboguer en production.

---

### I3 · `schema.prisma` — `engineType = "library"` vs Supabase
**Fichier** : `prisma/schema.prisma` ligne 3

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "library"   // ⚠️ Peut poser problème selon l'environnement
}
```

Sur Supabase/Cloud Run, `engineType = "library"` est recommandé pour éviter le binaire natif. C'est correct, mais à documenter car certains environnements nécessitent `"binary"`.

---

### I4 · `seed.ts` — Instanciation type-unsafe
**Fichier** : `prisma/seed.ts` ligne 2

```typescript
const prisma = new (PrismaClient as any)({});
// Devrait être simplement :
const prisma = new PrismaClient();
```

---

### I5 · `Appointment` non lié aux `ServiceOrder`
**Fichier** : `prisma/schema.prisma` lignes 866-884

Le modèle `Appointment` n'a pas de champ `serviceOrderId`. Un rendez-vous ne peut pas être transformé en OT directement depuis la base de données.

---

## 5. 🔵 Endpoints manquants

### Workshop
| Endpoint | Utilité | Priorité |
|----------|---------|----------|
| `GET /api/workshop/labor-catalog` | Liste les prestations pour créer des work-items | 🔴 Haute |
| `PATCH /api/workshop/ot/:id/assign` | Assigner un chef/technicien à l'OT | 🟠 Moyenne |
| `POST /api/workshop/ot/:id/quality-control` | Enregistrer le contrôle qualité | 🟠 Moyenne |
| `DELETE /api/workshop/ot/:id/work-item/:itemId` | Supprimer une ligne de travail | 🟡 Basse |

### Stock
| Endpoint | Utilité | Priorité |
|----------|---------|----------|
| `GET /api/stock/parts/:id` | Détail d'une pièce | 🔴 Haute |
| `POST /api/stock/parts` | Créer une pièce | 🔴 Haute |
| `PATCH /api/stock/parts/:id` | Modifier une pièce | 🔴 Haute |
| `GET /api/stock/suppliers` | Liste des fournisseurs | 🟠 Moyenne |

### Billing
| Endpoint | Utilité | Priorité |
|----------|---------|----------|
| `GET /api/billing/quotes/:id` | Détail d'un devis | 🔴 Haute |
| `GET /api/billing/invoices/:id` | Détail d'une facture | 🔴 Haute |
| `GET/POST /api/billing/counter-sales` | Ventes comptoir | 🟠 Moyenne |

### Vehicles
| Endpoint | Utilité | Priorité |
|----------|---------|----------|
| `GET /api/vehicles/makes` | Marques pour dropdown | 🟠 Moyenne |
| `GET /api/vehicles/makes/:id/models` | Modèles pour dropdown | 🟠 Moyenne |

### Dashboard
| Endpoint | Utilité | Priorité |
|----------|---------|----------|
| `app/api/dashboard/stats/route.ts` | Données hardcodées, requêtes Prisma commentées | 🟠 Moyenne |

---

## 6. Configuration Supabase — Ce qui manque dans `.env.example`

Le fichier `.env.example` actuel est incomplet pour un déploiement Supabase complet.

```bash
# Manquants à ajouter :

# Auth
JWT_SECRET="votre-secret-jwt-fort-256bits"

# Redis (pour BullMQ)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# App
PORT="3000"
NODE_ENV="development"
```

Le `.env.example` actuel a déjà les bons placeholders pour `DATABASE_URL` et `DIRECT_URL` (format Supabase avec `pgbouncer=true`).

---

## 7. Instructions Supabase — À exécuter manuellement

Le fichier `prisma/custom_schema.sql` contient des objets SQL que Prisma ne gère pas :
- Extensions : `uuid-ossp`, `pgcrypto`
- Séquences : `seq_ot`, `seq_quote`, `seq_invoice`, `seq_asp`, `seq_counter`
- Fonctions : `fn_next_ref()`, `fn_trg_ot_status_history()`, `fn_trg_stock_consumption()`
- Triggers : à créer manuellement après `prisma migrate`

**Ordre d'exécution recommandé :**
1. Configurer `DATABASE_URL` + `DIRECT_URL` dans `.env`
2. `npx prisma migrate dev` (ou `prisma db push` pour Supabase)
3. Exécuter `prisma/custom_schema.sql` dans le SQL Editor de Supabase
4. `npx prisma db seed`

---

## 8. Inventaire complet des routes API

### Auth — `POST/GET /api/auth/...`
| Méthode | Route | Accès | État |
|---------|-------|-------|------|
| POST | `/login` | Public | ✅ |
| POST | `/logout` | JWT | ✅ |
| GET | `/profile` | JWT | ✅ |

### Workshop — `/api/workshop/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/ot` | ORD_VIEW | ✅ |
| GET | `/ot/:id` | ORD_VIEW | ✅ |
| POST | `/ot` | ORD_CREATE | ✅ |
| PATCH | `/ot/:id/status` | — | ✅ |
| POST | `/ot/:id/observation` | — | ✅ |
| POST | `/ot/:id/work-item` | — | ✅ |
| POST | `/ot/:id/reception-check` | — | ✅ |
| GET | `/labor-catalog` | — | ✅ |
| PATCH | `/ot/:id/assign` | — | ✅ |
| POST | `/ot/:id/quality-control` | — | ✅ |
| DELETE | `/ot/:id/work-item/:itemId` | ORD_CREATE | ✅ |

### Customers — `/api/customers/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/` | VEH_VIEW | ✅ |
| GET | `/:id` | VEH_VIEW | ✅ |
| POST | `/` | VEH_CREATE | ✅ |
| PATCH | `/:id` | VEH_CREATE | ✅ |
| DELETE | `/:id` | VEH_CREATE | ✅ |

### Vehicles — `/api/vehicles/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/` | VEH_VIEW | ✅ |
| GET | `/:id` | VEH_VIEW | ✅ |
| POST | `/` | VEH_CREATE | ✅ |
| PATCH | `/:id` | VEH_CREATE | ✅ |
| DELETE | `/:id` | VEH_CREATE | ✅ |
| GET | `/makes` | VEH_VIEW | ✅ |
| GET | `/models` | VEH_VIEW | ✅ |

### Stock — `/api/stock/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/parts` | STK_VIEW | ✅ |
| GET | `/parts/low-stock` | STK_VIEW | ✅ |
| GET | `/movements` | STK_VIEW | ✅ |
| POST | `/movement` | STK_VIEW | ✅ |
| POST | `/asp` | STK_VIEW | ✅ |
| GET | `/parts/:id` | STK_VIEW | ✅ |
| POST | `/parts` | STK_VIEW | ✅ |
| PATCH | `/parts/:id` | STK_VIEW | ✅ |
| GET | `/suppliers` | STK_VIEW | ✅ |

### Billing — `/api/billing/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| POST | `/quote/compute` | — | ✅ |
| GET | `/quotes` | FAC_CREATE | ✅ |
| POST | `/quotes` | FAC_CREATE | ✅ |
| POST | `/quotes/:id/approve` | FAC_CREATE | ✅ |
| GET | `/invoices` | FAC_CREATE | ✅ |
| POST | `/invoice/from-quote/:quoteId` | FAC_CREATE | ✅ |
| POST | `/payment` | FAC_CREATE | ✅ |
| GET | `/quotes/:id` | FAC_CREATE | ✅ |
| GET | `/invoices/:id` | FAC_CREATE | ✅ |
| GET | `/counter-sales` | FAC_CREATE | ✅ |
| POST | `/counter-sales` | FAC_CREATE | ✅ |

### Team — `/api/team/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/` | — | ✅ |
| GET | `/:id` | — | ✅ |
| POST | `/` | CHEF_ATELIER, ADMIN | ✅ |
| PATCH | `/:id` | CHEF_ATELIER, ADMIN | ✅ |
| DELETE | `/:id` | ADMIN | ✅ |

### Planning — `/api/planning/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/appointments` | ORD_VIEW | ✅ |
| POST | `/appointments` | ORD_CREATE | ✅ |
| PATCH | `/appointments/:id` | ORD_CREATE | ✅ |
| DELETE | `/appointments/:id` | ORD_CREATE | ✅ |

### Notifications — `/api/notifications/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/sms` | ADMIN | ✅ |
| POST | `/sms/send` | ADMIN | ✅ |

### Reports — `/api/reports/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/revenue` | ADMIN | ✅ |
| GET | `/workshop-performance` | ADMIN | ✅ |

### Audit — `/api/audit/...`
| Méthode | Route | Permission | État |
|---------|-------|-----------|------|
| GET | `/` | ADMIN | ✅ |

---

## 9. Plan de correction recommandé

### Étape 1 — Bloquants (avant tout test)
1. Ajouter `url` et `directUrl` dans `schema.prisma`
2. Refactoriser `PrismaService.$use()` en `$extends`
3. Corriger le filtre `lowStock` dans `stock.controller.ts`

### Étape 2 — Critiques (avant production)
4. Compléter le seed : utilisateur admin, `RolePermission`, données de test
5. Remplacer `@RequirePermission('ADMIN')` par `@RequireRole('ADMIN')` dans `TeamController`
6. Corriger les triggers SQL (`updated_by` inexistant) dans `custom_schema.sql`

### Étape 3 — Endpoints manquants (pour couvrir le frontend)
7. `GET /workshop/labor-catalog`
8. `GET/POST/PATCH /stock/parts/:id`
9. `GET /billing/quotes/:id` et `GET /billing/invoices/:id`
10. `GET /vehicles/makes` et `GET /vehicles/makes/:id/models`
11. Counter Sales controller
12. Dashboard stats réelles (décommenter requêtes Prisma)

### Étape 4 — Connexion frontend
13. Remplacer `lib/mock-data.ts` par des appels API réels
14. Ajouter un client HTTP (fetch/axios) avec intercepteur JWT
