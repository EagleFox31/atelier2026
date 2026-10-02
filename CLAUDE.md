# Atelier Maître — Contexte projet pour Claude

Application de gestion d'atelier automobile pour le marché camerounais (XAF, TVA 19.25%, SMS Orange/MTN CM).

---

## Stack

- **Frontend** : Next.js 15 (App Router) + React 19 + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend** : NestJS 11 — API REST préfixée `/api`, port **3001**
- **Base de données** : PostgreSQL sur **Supabase** (Prisma 7.7.0)
- **Queue** : Redis + BullMQ (SMS, alertes stock) + `@nestjs/schedule` (crons)
- **Temps réel** : SSE `/api/events` (`EventsService`, clients gardés **en mémoire** du process)
- **Auth** : JWT (1 jour) + `tokenVersion` pour révocation — le payload porte `tenantId` + `garageId`
- **SaaS multi-tenant** : `Tenant` (abonnement) → `Garage` (données métier scopées par `garageId`)
- **Prod** : https://atelier.trigenys.com — AWS EC2 `eu-west-3`

---

## Ports & Proxy

- NestJS → **3001** (`PORT` ou `API_PORT` — défaut code `3001`)
- Next.js → **3000** (`scripts/dev.mjs`, `npm run dev:next`)
- `next.config.ts` rewrite `/api/*` → `BACKEND_URL/api/*` (défaut `http://localhost:3001`)
- Le browser n'accède jamais directement au port NestJS
- Swagger : `http://localhost:3001/api/docs`

## Commandes

```bash
npm run dev            # type-check back + front → lance les deux serveurs
npm run dev:api        # NestJS seul
npm run dev:next       # Next.js seul (port 3000)
npm run type:check     # vérification TypeScript seule
npm run migrate        # migrations Supabase (préférer à prisma migrate deploy — voir ci-dessous)
npx prisma db seed     # seed (rôles, permissions, users de test)
npx prisma generate    # regénérer le client Prisma après changement de schema

npm test               # Jest (unit + contract + integration, dans src/)
npm run test:pw        # Playwright E2E (e2e/)
npm run test:qa        # Playwright UX/UI/CX (e2e-qa/) — contre la prod par défaut (PLAYWRIGHT_BASE_URL)
npm run test:ux        # Garde-fous UX avant merge (e2e-ux/) — API simulée, port 3100 ; CI : ux-guardrails.yml
npm run test:e2e       # Newman (collections postman/)
npm run test:mutation  # Stryker
npm run reset:demo     # remet les données de démo à zéro
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

## Déploiement production (AWS — actuel)

Guide complet → **[infra/aws/README.md](infra/aws/README.md)**

| Composant | Rôle |
|-----------|------|
| `infra/aws/bootstrap-github-oidc.yml` | Pile CloudFormation lancée **une fois à la main** : rôles IAM OIDC pour GitHub |
| `infra/aws/atelier-maitre.yml` | Pile `atelier-maitre-prod` : EC2 `t3.micro` Ubuntu 24.04, IP fixe, SSM (pas de SSH) |
| `deploy/docker/docker-compose.aws.yml` | Caddy + Next + NestJS + Redis sur l'EC2 |
| `deploy/scripts/aws-ssm-deploy.sh` | Exécuté via SSM : pull GHCR du commit exact + `up`, check `/api/health` |

Règles prod :
- **`/api/*` routé par Caddy** vers NestJS (pas le rewrite Next / `BACKEND_URL` au build)
- **`ALLOWED_ORIGINS`** = URL publique du browser (`http://IP` ou `https://domaine`) ; `APP_DOMAIN` + `ACME_EMAIL` pour le HTTPS Caddy
- Secrets applicatifs dans **SSM Parameter Store** (`/atelier-maitre/prod/env`, `/atelier-maitre/prod/ghcr-token`) — jamais dans GitHub
- En prod AWS, `DATABASE_URL` utilise le **Session pooler Supabase (port 5432)**, pas pgbouncer 6543
- Migrations au boot API : **`migrate-missing.mjs`** + `DIRECT_URL`
- Seed : voir règle 20 (`docker exec … npx --yes tsx prisma/seed.ts`)
- **Coupure au déploiement** (30 à 60 s, un seul serveur) : Caddy sert `deploy/docker/maintenance/index.html` (pages) et un JSON 503 `MAINTENANCE` (`/api/*`). `lib/api.ts` réessaie les GET, jamais les écritures, et affiche `ServiceStatusBanner`. La page de maintenance doit rester **autonome** (aucune ressource externe)

> Legacy : anciennes cibles (Oracle, Fly, Railway) archivées dans **`deploy/legacy/`** — ne plus s'en servir comme référence. Ne rien y ajouter.

## Variables d'environnement (.env)

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Pooler Supabase (pgbouncer=true, port 6543 en local) |
| `DIRECT_URL` | Connexion directe Supabase (migrations, port 5432) |
| `JWT_SECRET` | Secret JWT (`npm run rotate:jwt` pour rotation) |
| `API_PORT` / `PORT` | Port NestJS (défaut 3001) |
| `BACKEND_URL` | URL interne NestJS pour le proxy (défaut http://localhost:3001) |
| `ALLOWED_ORIGINS` | CORS — vide = tout autoriser en dev |
| `REDIS_HOST` / `REDIS_PORT` | Redis pour BullMQ |
| `PUBLIC_SIGNUP_ENABLED` | Active `/inscription` (création de tenant en libre-service) |
| `SIGNUP_ALLOW_IF_ADMIN_EXISTS` | `true` = autoriser l'inscription même si un ADMIN existe (tests locaux) |
| `APP_DOMAIN` / `ACME_EMAIL` | Prod uniquement — domaine + email Let's Encrypt pour Caddy |
| `RESEND_API_KEY` | Clé Resend « Sending access » (domaine `trigenys.com`) — e-mail de bienvenue ; absente = aucun envoi |
| `SMS_PROVIDER` / `WHATSAPP_PROVIDER` | Fournisseur de messagerie (`simulator` par défaut, seule valeur actuelle) ; valeur inconnue = l'API refuse de démarrer |
| `SIGNUP_EMAIL_FROM` / `SIGNUP_EMAIL_REPLY_TO` | Expéditeur (`Atelier Maître <ateliermaitre@trigenys.com>`) / réponse facultative |
| `APP_PUBLIC_URL` | URL publique pour les liens et le logo des e-mails (sinon `https://APP_DOMAIN`) |

---

## Modules NestJS

| Module | Routes | Notes |
|--------|--------|-------|
| AuthModule | `/auth/login`, `/auth/logout`, `/auth/profile` | JWT + tokenVersion |
| WorkshopModule | `/workshop/*` | Machine à états OT (`OT_TRANSITIONS` + `TRANSITION_ROLES`), optimistic locking |
| CustomersModule | `/customers/*` | CRUD + soft delete |
| VehiclesModule | `/vehicles/*` | CRUD + soft delete + `/makes` + `/models` |
| StockModule | `/stock/*` | BullMQ alertes stock |
| BillingModule | `/billing/*` | TVA 19.25%, timbre, idempotence paiements |
| TeamModule | `/team/*` | Utilisateurs/techniciens |
| PlanningModule | `/planning/appointments/*` | Hard delete (pas de deletedAt) |
| NotificationsModule | `/notifications/sms/*` | Mise en file SMS (`sms-notifications`) — envoi par `SmsProcessor` |
| MessagingModule | — | Jetons `SMS_PROVIDER` / `WHATSAPP_PROVIDER` choisis par env ; erreurs définitives vs temporaires ; E.164 +237. Aucun module métier n'importe un fournisseur |
| ReportsModule | `/reports/*` | Revenus + performance + `/reports/dashboard-stats` (dashboard) |
| CounterSalesModule | `/counter-sales` | Vente comptoir (pièces sans OT) |
| SettingsModule | `/settings/workshop`, `/settings/workshop/logo` | Paramètres atelier par garage — GET tous, PATCH/logo ADMIN |
| EventsModule | `/events` (SSE) | Push temps réel ciblé user/garage/rôle |
| MarketingModule | `/public/demo-booking`, `/demo-requests/*` | Leads démo (avec forfait demandé) → notif SUPER_ADMIN |
| SignupModule | `/public/signup` | Inscription libre-service : crée Tenant + Garage + ADMIN, démarre le pilote |
| SubscriptionModule | `/subscription/status` | Cycle pilote (voir ci-dessous) + cron horaire de réconciliation |
| AdminModule | `/admin/tenants/*` | Console plateforme SUPER_ADMIN |
| SharedModule (@Global) | `/audit/*` | PrismaService + AuditService globaux |

Guards globaux (ordre) : `JwtAuthGuard` → `SubscriptionGuard` → `PermissionsGuard`. Routes publiques via `@Public()`.

## Multi-tenant & abonnement

- **Isolation** : toute donnée métier est filtrée par `garageId` du JWT. Utiliser les helpers de `src/shared/garage/garage-scope.ts` (`garageWhere`, `assert*InGarage`) — ils renvoient **404** (pas 403) pour masquer les IDOR. Jamais de `findUnique({ id })` nu sur une entité métier.
- **Cycle pilote** (`Tenant.subscriptionStatus`) : signup → `TRIAL` 30 j (plan `pro`) → `GRACE_PERIOD` 7 j (**lecture seule** : seuls GET/HEAD/OPTIONS passent) → `EXPIRED`. `ACTIVE` / `SUSPENDED` sont posés manuellement. Rétention données : fin d'essai + 90 j.
- Le statut est recalculé **à la demande** (`SubscriptionService.getSummary`, appelé par le guard à chaque requête) et par `TrialSchedulerService` (cron horaire).
- Un tenant sans `trialEndsAt` (antérieur au pilote) est toujours considéré `ACTIVE`.
- Codes d'erreur front : `TRIAL_READ_ONLY`, `TRIAL_EXPIRED`, `SUBSCRIPTION_SUSPENDED` → `SubscriptionBlockedScreen` / `TrialStatusBanner`.
- `PASSWORD_CHANGE_REQUIRED` (403, `JwtAuthGuard`) → redirection `/change-password` (`lib/api.ts` + `AppLayout`).

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
| `lib/role-routing.ts` | Profils (technicien/réception/caisse « purs ») + route d'accueil post-login |
| `hooks/use-realtime-events.ts` | Abonnement SSE `/api/events` |
| `hooks/use-trial-status.ts` | Statut pilote pour bannière / écran bloquant |
| `infra/aws/README.md` | Déploiement production AWS |
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
| SUPER_ADMIN | Plateforme (tous tenants) — bypass `PermissionsGuard` **et** `SubscriptionGuard` |
| ADMIN | Tout dans son garage (bypass `PermissionsGuard`) |
| CHEF_ATELIER | VEH_VIEW, VEH_CREATE, ORD_VIEW, ORD_CREATE, STK_VIEW, STK_CREATE, FAC_CREATE, FAC_VIEW |
| TECHNICIEN | VEH_VIEW, ORD_VIEW, STK_VIEW |
| RECEPTIONNISTE | VEH_VIEW, VEH_CREATE, ORD_VIEW, ORD_CREATE, FAC_VIEW |
| CAISSIER | VEH_VIEW, ORD_VIEW, STK_VIEW, FAC_VIEW, FAC_PAY |
| SYSTEM | Transitions automatiques (billing, jobs) |

Source de vérité : `ROLE_PERMISSIONS` dans `prisma/seed.ts` + `src/shared/rbac/permissions.ts`. Les transitions d'OT ont en plus leur propre table de rôles (`TRANSITION_ROLES`).

## Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| superadmin@atelier.cm | Atelier2026! | SUPER_ADMIN |
| admin@atelier.cm | Atelier2026! | ADMIN |
| chef@atelier.cm | Atelier2026! | CHEF_ATELIER |
| tech1@atelier.cm | Atelier2026! | TECHNICIEN |
| reception@atelier.cm | Atelier2026! | RECEPTIONNISTE |
| caisse@atelier.cm | Atelier2026! | CAISSIER |

---

## CI/CD & Versioning (mis à jour 2026-10-01)

### Pipeline GitHub Actions

```
git push main → CI (type-check + Jest) → Deploy AWS (CloudFormation → build GHCR → SSM pull + up → /api/health)
             → Release (AppFactory / Release Please : met à jour la PR de release)
```

- **CI** (`.github/workflows/ci.yml`) : type-check back + front, Jest (droits en lecture seule)
- **Release** (`.github/workflows/release.yml`) : appelle le workflow partagé AppFactory `reusable-release.yml@v1` (voir Versioning)
- **Deploy** (`.github/workflows/deploy.yml`) : déclenché par la réussite de la CI sur `main` (ou manuellement). Détecte les fichiers modifiés → met à jour la pile CloudFormation seulement si l'infra change → build/push seulement les images API/Web modifiées → déploiement via **SSM** (pas de SSH)
- **QA UX** (`.github/workflows/qa-ux.yml`) : `npm run test:qa` contre la prod, du lundi au vendredi à 5 h UTC, ou lancé à la main (`base_url`, `allow_mutations`). Secrets `QA_EMAIL` / `QA_PASSWORD` (compte QA dédié)
- **Cache Docker** (GitHub Actions Cache) : seules les layers modifiées sont reconstruites

### Configuration GitHub Actions requise

Authentification AWS par **OIDC** : aucune clé AWS ni SSH stockée dans GitHub.

| Variable (Actions → Variables) | Usage |
|--------|-------|
| `AWS_DEPLOY_ROLE_ARN` | Rôle assumé par le workflow (sortie de la pile bootstrap) |
| `AWS_CLOUDFORMATION_ROLE_ARN` | Rôle d'exécution CloudFormation |

Push GHCR avec `GITHUB_TOKEN`. Le token de pull GHCR et le `.env` de prod vivent dans SSM Parameter Store (voir Déploiement).

### Versioning (AppFactory Release Please)

Workflow partagé : [EagleFox31/appfactory-project-automation](https://github.com/EagleFox31/appfactory-project-automation), `.github/workflows/reusable-release.yml@v1` — même mécanique que les autres produits AppFactory.

1. Chaque push sur `main` met à jour une **PR de release** « chore(main): release X.Y.Z » (`version.txt` + `CHANGELOG.md`, calculés depuis les Conventional Commits).
2. **Merger cette PR publie la version** : tag `vX.Y.Z` + GitHub Release. On publie donc quand on veut, pas à chaque merge.
3. Le merge déclenche CI → Deploy ; `version.txt` faisant partie des fichiers « web », le site est reconstruit avec la nouvelle version.

| Commit | Bump semver |
|--------|-------------|
| `fix:` | PATCH `1.2.3 → 1.2.4` |
| `feat:` | MINOR `1.2.3 → 1.3.0` |
| `feat!:` ou `BREAKING CHANGE:` | MAJOR `1.2.3 → 2.0.0` |
| `docs:`, `chore:`, `refactor:`, `ci:` | aucun bump |

- **Source de vérité de la version** : `version.txt` (lu par `deploy.yml` → `NEXT_PUBLIC_APP_VERSION`, build arg Docker, affichée en bas à droite de `/login`). Ne jamais l'éditer à la main : c'est la PR de release qui le fait.
- **Version forcée** (rare) : Actions → Release → Run workflow → `release_as` (ex. `2.0.0`).
- **Pas de token requis** : `GITHUB_TOKEN` suffit, avec le réglage dépôt *Settings → Actions → General → « Allow GitHub Actions to create and approve pull requests »*. Secret optionnel `APPFACTORY_RELEASE_TOKEN` : sans lui, la CI ne tourne pas sur la PR de release (elle ne contient que `version.txt` + `CHANGELOG.md`).
- Les tags `v1.7.x`/`v1.8.0` d'avant septembre pointent vers un historique réécrit (branches `codex/*`) ; `v1.8.1` a été replacé sur son commit équivalent de `main` (`e02d3a9`) pour servir de point de départ.

---

## État du projet (2026-09-23)

### En production
- Application complète en ligne (atelier.trigenys.com) : toutes les pages branchées sur l'API, parcours mobile par rôle, PWA, onboarding guidé
- SaaS : landing + tarifs (3 forfaits + pilote gratuit), inscription libre-service, pilote 30 j + grâce 7 j, console SUPER_ADMIN, leads démo
- Déploiement AWS GitOps (CloudFormation + OIDC + SSM)

### Travail en cours
- `fix/trial-onboarding-ux-qa` **mergée** dans main (`a61fb06`, squash) : sélecteur de ville, logo payant vérifié côté API, suite Playwright `test:qa` + workflow planifié `qa-ux.yml`
- `fix/ux-onboarding-and-qa` **non mergée**, et maintenant en conflit avec main (même périmètre). À y reprendre : blocage SMS côté serveur (`assertSmsEntitled`, worker), e-mail d'inscription, onboarding obligatoire sur mobile
- Plan de correction → [docs/PLAN-CORRECTIONS-2026-09.md](docs/PLAN-CORRECTIONS-2026-09.md)

### Règles produit décidées (2026-09-23)
- **Logo personnalisé** : seulement avec un forfait payant `ACTIVE`. Sinon (pilote, grâce, expiré) : logo Atelier Maître partout (app, devis, factures, PDF). Un logo déjà enregistré est masqué, pas supprimé
- **SMS** : Pro et Business `ACTIVE` uniquement (conforme à la page tarifs) — ni Essentiel, ni pilote
- **Suspension** : suspendre un tenant ne touche pas au statut des utilisateurs. Un utilisateur suspendu par son ADMIN le reste quand le tenant est réactivé

### Historique — audit backend (2026-06-01)
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

### Frontend — branchement API terminé
Les 18 pages sont branchées sur l'API réelle. Le dashboard utilise `/api/reports/dashboard-stats` (`app/api/dashboard/stats/route.ts` n'est qu'un stub legacy). `lib/mock-data.ts` n'est plus importé nulle part.

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
21. **RAIDER — mémoire des incidents** — avant un travail risqué ressemblant à un incident connu, lire [docs/engineering/lessons-learned.md](docs/engineering/lessons-learned.md) ; après un incident ou near miss significatif, y ajouter une entrée (cause racine + prévention).
22. **Jamais de `<form>` imbriqué** — un mini-formulaire (création inline client/véhicule…) inséré dans un autre formulaire soumet le parent (bug « Nouvel OT » fermé, LESSON-2026-007). Utiliser un conteneur `role="group"`, un bouton `type="button"` et `submitOnEnter` de `lib/inline-form.ts`.
23. **Jamais de mot de passe en clair** — ni en base (`User.tempPassword` est déprécié, ne plus jamais l'écrire), ni dans un log, un e-mail ou une réponse de liste. Mot de passe temporaire = `generateTempPassword()` (`src/shared/security/temp-password.ts`, côté serveur), renvoyé une seule fois, `mustChangePassword: true`. Routes accessibles pendant le changement imposé : `@AllowPendingPasswordChange()` (LESSON-2026-008).

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
