# Atelier Maître — Contexte projet pour Claude

Application de gestion d'atelier automobile pour le marché camerounais (XAF, TVA 19.25%, SMS Orange/MTN CM).

---

## Stack

- **Frontend** : Next.js 15 (App Router) + React 19 + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend** : NestJS 11 — API REST préfixée `/api`, port **3001**
- **Base de données** : PostgreSQL sur **Supabase** (Prisma 7.7.0)
- **Queue** : Redis + BullMQ (SMS, alertes stock)
- **Auth** : JWT (1 jour) + `tokenVersion` pour révocation

---

## Ports & Proxy

- NestJS → **3001** (variable `API_PORT` — défaut code `3001`)
- Next.js → **3005**
- `next.config.ts` rewrite `/api/*` → `BACKEND_URL/api/*` (défaut `http://localhost:3001`)
- Le browser n'accède jamais directement au port NestJS

## Commandes

```bash
npm run dev            # type-check back + front → lance les deux serveurs
npm run dev:api        # NestJS seul
npm run dev:next       # Next.js seul
npm run type:check     # vérification TypeScript seule
npm run migrate        # migrations Supabase (préférer à prisma migrate deploy — voir ci-dessous)
npx prisma db seed     # seed (rôles, permissions, users de test)
npx prisma generate    # regénérer le client Prisma après changement de schema
```

## Migrations base de données (Supabase)

**Ne pas compter sur `npx prisma migrate deploy` en local** — ça reste souvent **bloqué** sur le pooler Supabase (port 6543).

**Workflow retenu :**

1. Modifier `prisma/schema.prisma` + SQL dans `prisma/migrations/…/migration.sql`
2. Reporter la migration dans `scripts/migrate-missing.mjs`
3. Exécuter **`npm run migrate`**
4. `npx prisma generate` si besoin

| URL | Port | Rôle |
|-----|------|------|
| `DATABASE_URL` | 6543 | Runtime app (PgBouncer) |
| `DIRECT_URL` | 5432 | Migrations / scripts DDL |

Leçons détaillées → **[docs/comprendre-l-app-101.md](docs/comprendre-l-app-101.md)**

## Déploiement MVP (Oracle Always Free)

Guide complet → **[deploy/README.md](deploy/README.md)**

| Composant | Rôle |
|-----------|------|
| `deploy/oci/terraform/` | VM ARM + VCN + cloud-init (Docker) |
| `deploy/docker/docker-compose.prod.yml` | Caddy + Next + NestJS + Redis |
| `deploy/scripts/remote-deploy.sh` | rsync + build sur la VM |

Règles prod :
- **`/api/*` routé par Caddy** vers NestJS (pas le rewrite Next / `BACKEND_URL` au build)
- **`ALLOWED_ORIGINS`** = URL publique du browser (`http://IP` ou domaine HTTPS)
- Migrations au boot API : **`migrate-missing.mjs`** + `DIRECT_URL`
- Seed : **`npx prisma db seed`** depuis la machine locale (pas dans l'image Docker)

## Variables d'environnement (.env)

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Pooler Supabase (pgbouncer=true, port 6543) |
| `DIRECT_URL` | Connexion directe Supabase (migrations, port 5432) |
| `JWT_SECRET` | Secret JWT |
| `API_PORT` | Port NestJS (défaut 3001) |
| `BACKEND_URL` | URL interne NestJS pour le proxy (défaut http://localhost:3001) |
| `ALLOWED_ORIGINS` | CORS — vide = tout autoriser en dev |
| `REDIS_HOST` / `REDIS_PORT` | Redis pour BullMQ |

---

## Modules NestJS

| Module | Routes | Notes |
|--------|--------|-------|
| AuthModule | `/auth/login`, `/auth/logout`, `/auth/profile` | JWT + tokenVersion |
| WorkshopModule | `/workshop/ot/*` | Machine à états OT, optimistic locking |
| CustomersModule | `/customers/*` | CRUD + soft delete |
| VehiclesModule | `/vehicles/*` | CRUD + soft delete + `/makes` + `/models` |
| StockModule | `/stock/*` | BullMQ alertes stock |
| BillingModule | `/billing/*` | TVA 19.25%, timbre, idempotence paiements |
| TeamModule | `/team/*` | Utilisateurs/techniciens |
| PlanningModule | `/planning/appointments/*` | Hard delete (pas de deletedAt) |
| NotificationsModule | `/notifications/sms/*` | Simulation Orange/MTN CM |
| ReportsModule | `/reports/*` | Revenus + performance |
| SettingsModule | `/settings/workshop` | Paramètres atelier (singleton BDD) — GET tous, PATCH ADMIN |
| SharedModule (@Global) | `/audit/*` | PrismaService + AuditService globaux |

---

## Fichiers clés Frontend

| Fichier | Rôle |
|---------|------|
| `lib/api.ts` | Client fetch centralisé, Bearer token auto, redirect `/login` sur 401 |
| `contexts/auth-context.tsx` | `AuthProvider`, `useAuth()`, login/logout, persistance localStorage |
| `app/login/page.tsx` | Page de connexion publique |
| `components/layout/AppLayout.tsx` | Protection routes, redirect `/login` si non authentifié |
| `tsconfig.server.json` | Config TypeScript dédiée NestJS (module commonjs) |
| `scripts/dev.mjs` | Orchestrateur dev — type-check puis lance les deux serveurs |
| `scripts/migrate-missing.mjs` | Migrations Supabase via DIRECT_URL (préféré à `prisma migrate deploy`) |
| `docs/comprendre-l-app-101.md` | Guide vivant — leçons apprises et astuces projet |
| `deploy/README.md` | Déploiement MVP Oracle + Docker Compose |
| `prisma/full_schema.sql` | SQL post-Prisma : triggers, `audit_logs` partitionné, vues (boot Docker / Supabase) |
| `prisma/custom_schema.sql` | Ancien sous-ensemble — préférer `full_schema.sql` |

---

## Soft Delete

Uniquement sur **User**, **Customer**, **Vehicle** (seuls modèles avec `deletedAt`).
- Filtre auto via `PrismaService.$extends`
- `OTWorkItem`, `Appointment` : hard delete intentionnel
- `ServiceOrder`, `Quote`, `Invoice` : transitions de statut uniquement

## RBAC

| Rôle | Permissions |
|------|------------|
| ADMIN | Tout (bypass guard) |
| CHEF_ATELIER | VEH_VIEW, VEH_CREATE, ORD_VIEW, ORD_CREATE, STK_VIEW, STK_CREATE, FAC_CREATE |
| TECHNICIEN | VEH_VIEW, ORD_VIEW, STK_VIEW |
| RECEPTIONNISTE | VEH_VIEW, VEH_CREATE, ORD_VIEW, ORD_CREATE |
| CAISSIER | VEH_VIEW, ORD_VIEW, FAC_CREATE, STK_VIEW |

## Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@atelier.cm | Atelier2026! | ADMIN |
| chef@atelier.cm | Atelier2026! | CHEF_ATELIER |
| tech1@atelier.cm | Atelier2026! | TECHNICIEN |
| reception@atelier.cm | Atelier2026! | RECEPTIONNISTE |
| caisse@atelier.cm | Atelier2026! | CAISSIER |

---

## CI/CD & Versioning (ajouté 2026-06-01)

### Pipeline GitHub Actions

```
git push main → CI (tests + type-check + semantic-release) → Deploy (build GHCR + pull serveur)
```

- **CI** (`.github/workflows/ci.yml`) : type-check back + front, tests, puis `semantic-release` sur main
- **Deploy** (`.github/workflows/deploy.yml`) : build images Docker sur runner GitHub → push GHCR → serveur fait `docker pull + up` (30 sec, pas de build sur le serveur)
- **Cache Docker** (GitHub Actions Cache) : seules les layers modifiées sont reconstruites

### Secrets GitHub Actions requis

| Secret | Usage |
|--------|-------|
| `SSH_PRIVATE_KEY` | Clé Ed25519 sans passphrase (dédiée CI) |
| `ENV_PROD` | Contenu de `deploy/.env.prod` |
| `GHCR_TOKEN` | PAT `read:packages` pour `docker pull` sur le serveur |

### Versioning automatique (semantic-release)

Config : `.releaserc.json` — déclenché sur push `main` uniquement.

| Commit | Bump semver |
|--------|-------------|
| `fix:` | PATCH `1.2.3 → 1.2.4` |
| `feat:` | MINOR `1.2.3 → 1.3.0` |
| `feat!:` ou `BREAKING CHANGE:` | MAJOR `1.2.3 → 2.0.0` |
| `docs:`, `chore:`, `refactor:` | aucun bump |

La version est injectée dans Next.js via `NEXT_PUBLIC_APP_VERSION` (build arg Docker) et affichée en bas à droite de la page `/login`.

---

## État du projet (2026-06-01)

### Backend — audit complet et corrigé
- ✅ Bloquants B1-B3 (schema Prisma, $extends soft delete, filtre lowStock)
- ✅ Critiques C1-C3 (seed, RBAC, triggers SQL)
- ✅ Incohérences I1-I4 (modules, guard catch, types)
- ✅ DTOs customers + vehicles avec validation
- ✅ `AllExceptionsFilter` — P2002/P2003/P2025/PrismaValidationError/InitializationError
- ✅ CORS configurable via `ALLOWED_ORIGINS`
- ✅ Script dev avec type-check et affichage URL réseau WiFi

### Frontend — plomberie auth en place
- ✅ `lib/api.ts` — client API complet pour tous les modules
- ✅ `contexts/auth-context.tsx` — AuthProvider
- ✅ `app/login/page.tsx` — page de connexion
- ✅ `AppLayout.tsx` — protection des routes

### Backend — tous les endpoints présents ✅
Workshop, Stock, Billing, Vehicles, Counter-Sales, Dashboard stats réelles.

### À faire — Frontend (Prochaine étape)
- [x] Brancher les 18 pages frontend sur les vraies APIs (remplacer `lib/mock-data.ts`)
- [x] Page `/customers` — liste + création client
- [x] Page `/vehicles` — liste + dropdowns marques/modèles
- [x] Page `/workshop` — tableau des OT + machine à états
- [x] Page `/stock` — catalogue pièces + alertes
- [x] Page `/billing` — devis + factures + paiements
- [x] Page `/planning` — calendrier des rendez-vous
- [x] Page `/reports` — CA + performance techniciens
- [x] Dashboard — brancher sur `/api/dashboard/stats`

---

## Règles de travail importantes

1. **Toujours lire le fichier avant de conclure** — le Glob peut être tronqué, un module peut exister sans apparaître
2. **Croiser les DTOs avec `prisma/schema.prisma`** — les noms de champs doivent correspondre exactement
3. **Ne pas confondre variable d'env et config Prisma** — `DATABASE_URL` dans `.env` ne suffit pas, il faut `url = env("DATABASE_URL")` dans le schema
4. **Ne jamais wrapper une page avec `<AppLayout>` si le shell parent le fournit déjà** — cela double le layout (sidebar + header en double). Vérifier comment les autres pages sont structurées avant d'ajouter un layout.
5. **jsPDF + `toLocaleString('fr-FR')` = bug** — `toLocaleString('fr-FR')` produit ` ` (espace fine insécable) comme séparateur de milliers, que jsPDF rend comme `/`. Utiliser à la place : `String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')`.
6. **`pdfText()` supprime les `\n`** — le filtre ASCII `/[^\x20-\x7E]/g` transforme les sauts de ligne en `?`. Toujours ajouter `.replace(/\r?\n/g, ' ')` avant le filtre ASCII dans `pdfText()`.
7. **pgbouncer + `set_config` → CTE atomique** — pgbouncer en mode transaction coupe les transactions multi-requêtes. Pour passer une variable de session à un trigger PostgreSQL, tout mettre dans un seul statement : `WITH set_user AS (SELECT set_config('app.current_user_id', $1, true)) UPDATE ...`.
8. **Prisma `include` superficiel** — `include: { lines: true }` ne charge pas les relations imbriquées. Si on a besoin de `line.part`, il faut `lines: { include: { part: true } }`. Vérifier la profondeur nécessaire avant d'écrire le service.
9. **Chargement async dans les dialogs** — séparer l'ouverture du dialog (`setIsOpen(true)`) du chargement des données (via `useEffect` qui watch `isOpen`). Si le fetch est dans le handler du bouton et échoue silencieusement, le bouton semble ne rien faire.
10. **Le linter/IDE peut modifier les fichiers entre deux éditions** — toujours relire un fichier avant d'éditer si du temps s'est écoulé, pour ne pas écraser des changements automatiques (imports ajoutés, strings corrigées, etc.).
11. **Redirection après création** — client → `/customers/[id]`, véhicule → `/vehicles/[id]`, OT → `/workshop/[id]`. Implémenter dans le `*Form` (pas seulement fermer la modale). Voir `CustomerForm`, `VehicleForm`, `OrderForm`.
12. **Z-index mobile** — BottomNav 100, Dialog 105, barre d'action formulaire 110, Select/Dropdown/Popover portés **120**. Ne jamais laisser un popup à z-50 dans une modale z-105.
13. **Formulaires modale mobile** — bottom sheet + scroll + `MobileFormActionBar` au-dessus de la navbar (`MOBILE_BOTTOM_NAV_OFFSET`). Réf. `mobile-form-action-bar.tsx`, `CUSTOMER_FORM_DIALOG_CLASS`.
14. **Listes mobile** — cartes `md:hidden` + tableau desktop ; profil réception : BottomNav Clients/OT/Nouveau RDV.
15. **`psql` n'accepte pas `?schema=public`** — ce paramètre est Prisma-only. Toujours stripper le query string avant de passer `DIRECT_URL` à psql : `PSQL_URL="${DIRECT_URL%%\?*}"`.
16. **`DEFAULT (col_expr)` interdit dans PostgreSQL** — on ne peut pas référencer d'autres colonnes dans une expression `DEFAULT`. Les champs calculés (`lineTotalXaf`, `balanceXaf`) doivent utiliser `@default(dbgenerated())` dans Prisma + un trigger `BEFORE INSERT` dans `full_schema.sql` qui calcule la valeur si `NULL`.
17. **`full_schema.sql` nécessite une double-passe** — il doit tourner une 1ère fois (sans `ON_ERROR_STOP`) AVANT `prisma db push` pour créer extensions/séquences/fonctions, puis une 2ème fois APRÈS pour créer triggers/vues/audit_logs. Voir `deploy/docker/api-entrypoint.sh`.
18. **`audit_logs` partitionné bloque `prisma db push`** — si `audit_logs` existe déjà comme table partitionnée (`relkind = 'p'`), Prisma génère un `ALTER TABLE ... RENAME CONSTRAINT + ALTER COLUMN TYPE` invalide. L'entrypoint le droppe automatiquement si partitionné. Ne jamais laisser `audit_logs` en état partitionné avant un `prisma db push`.
19. **`@db.Inet` obligatoire pour `ip_address` dans AuditLog** — sans ce type hint, Prisma voit `String?` (TEXT) alors que la DB a `INET` → AlterColumn bloquant sur re-déploiement.
20. **Seed prod : `npx --yes tsx prisma/seed.ts`** — le container prod n'a pas `ts-node` (`--omit=dev`). Utiliser `docker exec atelier2026-api-1 npx --yes tsx prisma/seed.ts`. Ne jamais tenter de seeder depuis la machine locale vers l'IP publique (port 5432 non exposé).

---

## Skills et Pratiques pour un Code Propre (Anti-Bugs Silencieux)

Pour écrire un code d'une propreté clinique, qui "chute avec fracas" plutôt que de produire des bugs silencieux (ex: détruire la base de données lentement sans déclencher d'erreur), voici les compétences et principes cruciaux :

### 1. Le principe du "Fail-Fast" (Échouer vite et fort)
Lancer une Exception explicite **immédiatement** si une condition anormale est détectée au lieu de retourner `null` ou de masquer l'erreur.
* **L'outil** : Le gestionnaire centralisé d'erreurs (Global Exception Filter) qui intercepte l'Exception pour un formatage propre (ex: P2002 devient 409 Conflict).

### 2. Le Typage Strict (Static Typing)
* **Skill** : Maîtrise de **TypeScript** (Generics, `Partial<>`, `Omit<>`). 
* **Pratique** : Mode `strict: true` dans `tsconfig.json`. Le code non-sûr ne doit pas compiler.

### 3. La Validation Rigide aux Frontières
Ne **jamais** faire confiance aux données injectées par l'extérieur (ex: Requêtes API).
* **Skill** : Modélisation forte avec des **DTOs** et Pipping.
* **Outils** : `class-validator` (NestJS) / `Zod`. Rejet automatique des valeurs inattendues.

### 4. L'Obsession de l'Intégrité de Base de Données
La base de données doit être infranchissable.
* **En pratique** : Exiger des `Foreign Keys` dures (pas de soft relations), utiliser des `Enums` SQL.
* **Transactions Atomiques** : Utiliser `prisma.$transaction` pour garantir que soit tout l'arbre est inséré, soit rien (ex: Devis + Lignes + Stock).

### 5. Les Tests Automatisés (TDD, Unit & E2E)
* **Principe** : Prouver par le test algorithmique que les cas extrêmes (ex: stock négatif) cassent exactement là où l'on veut.

### 6. L'Observabilité et le Logging Stratégique
Ne jamais utiliser `console.log('erreur')` en production.
* **Pratique** : Tracing log applicatif fort (`Logger` typés comme Winston/Pino) et monitoring en production (**Sentry**, **Datadog**).

### 7. Principes SOLID et Architecture Clean
* **Pratique** : Le SRP (Single Responsibility Principle) évite le code spaghettis (habitat naturel du bug furtif). Une fonction par action simple. Utiliser l'injection de dépendances (DI) propre de NestJS.
