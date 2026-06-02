# Plan multi-tenant — Atelier Maître

> Routing : **path-based** (pas de sous-domaines)
> Modèle : 1 Tenant = 1 entreprise (ex: Trigenys SA) → N Garages

---

## Architecture de routing

```
/inscription                    → wizard public (crée Tenant + Garage + Admin)
/login                          → connexion unique (backend résout le tenant)
/[tenantSlug]/dashboard         → tableau de bord du garage actif
/[tenantSlug]/workshop          → OT du garage actif
/[tenantSlug]/team              → équipe du garage actif
...

Si multi-garages :
/[tenantSlug]/garages           → liste des garages du tenant
/[tenantSlug]/[garageSlug]/...  → données d'un garage spécifique
```

> Pour le MVP, `[tenantSlug]` peut rester invisible (redirect automatique
> après login). Il devient visible seulement quand on active le multi-garages.

---

## Phase 1 — Schema multi-tenant (AVANT le wizard)

### Nouvelles tables

```prisma
model Tenant {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  slug      String   @unique           // "trigenys" → /trigenys/...
  name      String                     // "Trigenys Cameroun SA"
  email     String   @unique           // email du compte admin principal
  plan      String   @default("starter") // starter | pro | enterprise
  status    String   @default("active")
  createdAt DateTime @default(now())
  garages   Garage[]
  users     User[]
  @@map("tenants")
}

model Garage {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  slug      String                     // "bastos", "akwa"
  name      String                     // "Garage Bastos Yaoundé"
  city      String
  address   String
  phone     String
  niu       String?
  status    String   @default("active")
  createdAt DateTime @default(now())
  tenant    Tenant   @relation(...)
  @@unique([tenantId, slug])
  @@map("garages")
}
```

### Colonnes à ajouter sur les tables existantes

| Table | Colonnes ajoutées | Valeur par défaut |
|-------|-------------------|-------------------|
| `users` | `tenant_id`, `garage_id` | tenant/garage "default" |
| `customers` | `garage_id` | garage "default" |
| `vehicles` | `garage_id` | garage "default" |
| `service_orders` | `garage_id` | garage "default" |
| `parts_catalog` | `garage_id` | garage "default" |
| `invoices`, `quotes`, `payments` | `garage_id` | garage "default" |
| `appointments` | `garage_id` | garage "default" |
| `stock_movements` | `garage_id` | garage "default" |
| `workshop_settings` | `garage_id` | garage "default" |
| `audit_logs` | `tenant_id`, `garage_id` | valeurs "default" |

> **Stratégie** : colonnes nullable d'abord → peuplées → NOT NULL après migration.
> L'existant continue de tourner sans interruption.

### Isolation des données (Prisma extension)

```typescript
// Extension ajoutée à PrismaService pour filtrer auto par garageId :
prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query, model }) {
        if (HAS_GARAGE_ID.includes(model)) {
          args.where = { ...args.where, garageId: ctx.garageId };
        }
        return query(args);
      }
    }
  }
})
```

### JWT enrichi

```json
{
  "sub": "user-id",
  "tenantId": "uuid",
  "garageId": "uuid",
  "version": 1
}
```

---

## Phase 2 — Wizard d'inscription (à faire maintenant)

### Route : `/inscription`

Wizard public 4 étapes, **non protégé** (pas de JWT requis).

```
Étape 1 — Votre compte
  prénom, nom, email, mot de passe
  → validation email unique

Étape 2 — Votre atelier
  nom du garage, ville, téléphone, adresse, NIU (optionnel)
  → slug auto-généré depuis le nom

Étape 3 — Votre équipe (optionnel — skip possible)
  Ajouter chef, tech, réception, caissier
  Même logique que TeamMemberForm (identifiant prenom.nom auto)

Étape 4 — Récapitulatif
  Résumé + bouton "Créer mon atelier"
  → POST /api/public/signup
  → redirect /login avec message "Compte créé — connectez-vous"
```

### Endpoint backend

```
POST /api/public/signup   (@Public)
Body: {
  // Compte admin
  firstName, lastName, email, password,
  // Garage
  garageName, city, address, phone, niu?,
  // Équipe optionnelle
  members?: { firstName, lastName, roleCode, specialty? }[]
}

Réponse: { tenantId, garageId, employeeCode }
```

### Logique backend (transaction atomique)

```typescript
await prisma.$transaction([
  prisma.tenant.create({ data: { slug, name, email, ... } }),
  prisma.garage.create({ data: { tenantId, slug, name, city, ... } }),
  prisma.user.create({ data: { ...admin, tenantId, garageId, role: 'ADMIN' } }),
  prisma.workshopSettings.create({ data: { garageId, shopName, ... } }),
  // membres optionnels...
])
```

---

## Phase 3 — Middleware & isolation (après wizard)

- `GarageGuard` : lit `garageId` du JWT, injecte dans le contexte NestJS
- `TenantInterceptor` : ajoute `tenantId` / `garageId` à chaque requête
- Prisma extension : filtre auto sur toutes les queries
- Guard `SameGarage` : vérifie qu'une ressource appartient au garage du user

---

## Phase 4 — Frontend multi-garage (quand 1er client multi-garage)

- `GarageContext` : garage actif en mémoire
- `GarageSwitcher` dans le header (liste des garages du tenant)
- Prefix `[tenantSlug]` dans les routes Next.js → `app/[tenant]/...`
- Les API calls incluent le garageId courant (via header ou JWT)

---

## Ordre d'implémentation

```
[x] Wizard /inscription (Phase 2 — en cours)
[ ] Schema tenant/garage + colonnes FK (Phase 1)
[ ] Endpoint public/signup (Phase 2 backend)
[ ] Middleware isolation (Phase 3)
[ ] Frontend [tenantSlug] routing (Phase 4)
```

---

## Règles à ne pas oublier

1. **Slug auto** depuis le nom : "Garage Bastos" → `garage-bastos`, conflits → `garage-bastos-2`
2. **Mot de passe admin** : hashé côté backend, jamais stocké en clair (contrairement à `tempPassword` des employés)
3. **Transaction atomique** : si une étape du signup échoue, tout est rollback — pas de tenant orphelin
4. **Email unique global** : un email ne peut être admin que d'un seul tenant
5. **workshop_settings MVP** : la fiche `id='default'` actuelle devient la fiche du garage par défaut au moment de la migration
6. **Path routing** : le `[tenantSlug]` est optionnel au MVP (redirect auto post-login), il devient visible en Phase 4
