# Atelier Maître

Application de gestion d'atelier automobile pour le marché camerounais (XAF, TVA 19,25 %, SMS Orange/MTN CM).

**Stack :** Next.js 15 · NestJS 11 · PostgreSQL (Supabase) · Prisma · Redis/BullMQ

---

## Démarrage rapide

**Prérequis :** Node.js 20+, compte Supabase, Redis (optionnel en dev pour les queues SMS)

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL, DIRECT_URL, JWT_SECRET
npm run migrate        # créer / mettre à jour les tables (voir ci-dessous)
npx prisma db seed     # rôles, permissions, comptes de test
npm run dev            # API :3001 + front :3005
```

Ouvrir [http://localhost:3005](http://localhost:3005) — login test : `admin@atelier.cm` / `Atelier2026!`

> **Après le seed :** aller dans **Paramètres → Atelier** pour renseigner le vrai nom, adresse, téléphone et NIU de l'atelier. Ces informations apparaissent sur tous les devis et factures générés en PDF.

---

## Migrations Supabase

> **`npx prisma migrate deploy` tend à rester bloqué** sur le pooler Supabase (port 6543). C'est normal avec PgBouncer.

**Utiliser plutôt :**

```bash
npm run migrate
```

Ce script (`scripts/migrate-missing.mjs`) se connecte via **`DIRECT_URL`** (port 5432), vérifie l'existence des tables et est idempotent.

| Variable | Port | Usage |
|----------|------|--------|
| `DATABASE_URL` | 6543 | Runtime NestJS (PgBouncer) |
| `DIRECT_URL` | 5432 | Migrations et scripts DDL |

**Workflow schéma :**

1. `prisma/schema.prisma` + fichier dans `prisma/migrations/…`
2. Ajouter la logique dans `scripts/migrate-missing.mjs`
3. `npm run migrate` → `npx prisma generate`

---

## Documentation projet

| Fichier | Contenu |
|---------|---------|
| [CLAUDE.md](CLAUDE.md) | Contexte complet pour les agents IA (modules, RBAC, ports, conventions) |
| [docs/comprendre-l-app-101.md](docs/comprendre-l-app-101.md) | **Guide 101** — leçons apprises et astuces au fil du projet |
| [deploy/README.md](deploy/README.md) | **Déploiement MVP** — Oracle Always Free + Docker Compose |

---

## Déploiement MVP (Oracle Cloud, $0)

Une VM ARM (4 vCPU / 24 Go) héberge **Caddy + Next.js + NestJS + Redis**. PostgreSQL reste sur **Supabase**.

```bash
# 1. Infra (Terraform — voir deploy/README.md)
cd deploy/oci/terraform && cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply

# 2. Secrets
cp deploy/.env.prod.example deploy/.env.prod
# Remplir DATABASE_URL, DIRECT_URL, JWT_SECRET, ALLOWED_ORIGINS=http://IP

# 3. Seed (une fois, depuis votre PC)
npx prisma db seed

# 4. Deploy (Git Bash / WSL sur Windows)
./deploy/scripts/remote-deploy.sh ubuntu@VOTRE_IP
```

Pièges évités : migrations via `npm run migrate` / entrypoint, `/api/*` routé par Caddy (pas le rewrite Next), CORS = URL publique du browser.

---

## Commandes utiles

```bash
npm run dev            # type-check + API + front
npm run dev:api        # NestJS seul (port 3001)
npm run dev:next       # Next.js seul (port 3005)
npm run type:check     # TypeScript back + front
npm run migrate        # migrations Supabase (recommandé)
npx prisma db seed     # données de test
npm run test           # Jest (unit)
npm run test:e2e       # Newman / Postman
npm run test:pw        # Playwright
```

---

## Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@atelier.cm | Atelier2026! | ADMIN |
| chef@atelier.cm | Atelier2026! | CHEF_ATELIER |
| tech1@atelier.cm | Atelier2026! | TECHNICIEN |
| reception@atelier.cm | Atelier2026! | RECEPTIONNISTE |
| caisse@atelier.cm | Atelier2026! | CAISSIER |
