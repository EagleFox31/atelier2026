# Déploiement — Atelier 2026

Stack : **Caddy** (80/443) + **Next.js** + **NestJS** + **Redis** + **PostgreSQL** (conteneur local ou Supabase).

---

## Architecture CI/CD

```
git push main
  └── CI (GitHub Actions)
        ├── type-check + tests
        └── semantic-release → tag vX.Y.Z + GitHub Release
              └── Deploy (GitHub Actions)
                    ├── build API image → ghcr.io/eaglefox31/atelier2026-api:latest
                    ├── build Web image → ghcr.io/eaglefox31/atelier2026-web:latest  (NEXT_PUBLIC_APP_VERSION injecté)
                    └── SSH → serveur : docker pull + up + prune
```

**Convention de versioning automatique** (Conventional Commits) :

| Commit | Bump |
|--------|------|
| `fix:` | PATCH — `1.2.3 → 1.2.4` |
| `feat:` | MINOR — `1.2.3 → 1.3.0` |
| `feat!:` / `BREAKING CHANGE:` | MAJOR — `1.2.3 → 2.0.0` |
| `docs:`, `chore:`, `refactor:` | aucun bump |

---

## Secrets GitHub requis

| Secret | Valeur |
|--------|--------|
| `SSH_PRIVATE_KEY` | Clé privée Ed25519 sans passphrase (pour GitHub Actions) |
| `ENV_PROD` | Contenu complet de `deploy/.env.prod` |
| `GHCR_TOKEN` | PAT GitHub avec scope `read:packages` (pour `docker pull` sur le serveur) |

### Créer la clé SSH dédiée CI (sans passphrase)

```powershell
ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$env:USERPROFILE\.ssh\id_ed25519_gh_deploy"
# Ajouter la clé publique sur le serveur :
$pub = Get-Content "$env:USERPROFILE\.ssh\id_ed25519_gh_deploy.pub"
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_upcloud" root@VOTRE_IP "echo '$pub' >> ~/.ssh/authorized_keys"
# Copier la clé privée dans GitHub Secrets → SSH_PRIVATE_KEY
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_gh_deploy" | clip
```

---

## Premier déploiement (manuel)

### 1. Préparer `deploy/.env.prod`

```bash
cp deploy/.env.prod.example deploy/.env.prod
```

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Mot de passe Postgres local |
| `DATABASE_URL` | `postgresql://atelier:PASSWORD@postgres:5432/atelier` |
| `DIRECT_URL` | Même URL (connexion directe — migrations) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ALLOWED_ORIGINS` | URL publique du browser (`http://VOTRE_IP`) |

> **Encoder le `!` dans le mot de passe** : utiliser `%21` dans les URL (`AtelierSecurePG2026!` → `AtelierSecurePG2026%21`).

### 2. Déployer depuis Windows (PowerShell)

```powershell
.\deploy\scripts\remote-deploy.ps1
```

La passphrase SSH est demandée plusieurs fois (normal sous Windows sans ssh-agent).

### 3. Initialiser la base de données

```bash
# Sur le serveur (une seule fois) :
docker exec atelier2026-api-1 npx --yes tsx prisma/seed.ts
```

Crée les rôles, permissions et comptes de test (`admin@atelier.cm / Atelier2026!`).

---

## Re-déploiement (CI/CD automatique)

```
git add . && git commit -m "feat: ma nouvelle fonctionnalité"
git push origin main
```

→ CI lance les tests → semantic-release crée le tag → Deploy build les images et redémarre le serveur.

---

## Commandes utiles sur le serveur

```bash
ssh root@VOTRE_IP
cd /opt/atelier2026

# Alias compose
./deploy/scripts/compose-prod.sh ps
./deploy/scripts/compose-prod.sh logs api --tail 50
./deploy/scripts/compose-prod.sh restart api

# Nettoyage disque (automatique après chaque deploy CI)
docker system prune -f
```

---

## Init DB (entrypoint API au démarrage)

L'entrypoint `/entrypoint.sh` fait automatiquement à chaque démarrage du conteneur `api` :

1. Attente PostgreSQL (`wait-for-postgres.mjs`)
2. Drop `audit_logs` si partitionné (évite conflit Prisma)
3. **Pré-init** `full_schema.sql` sans `ON_ERROR_STOP` → crée extensions + séquences + fonctions
4. `prisma db push --accept-data-loss` → crée les tables
5. **Post-init** `full_schema.sql` avec `ON_ERROR_STOP=1` → crée triggers, vues, `audit_logs` partitionné
6. `migrate-missing.mjs` → migrations complémentaires

---

## Pièges connus

| Problème | Solution |
|----------|----------|
| `psql: invalid URI query parameter: "schema"` | Stripper `?schema=public` avant psql : `${DIRECT_URL%%\?*}` |
| `prisma db push` échoue sur `uuid_generate_v4()` | `full_schema.sql` pré-init crée l'extension avant Prisma |
| `audit_logs` bloque `prisma db push` | L'entrypoint le droppe s'il est partitionné |
| `DEFAULT (col_expr)` invalide PostgreSQL | Triggers `BEFORE INSERT` dans `full_schema.sql` (`fn_compute_line_total`, `fn_compute_invoice_balance`) |
| Disque plein sur le serveur | `docker system prune -f` (automatique en CI) |
| Seed sans `ts-node` en prod | `docker exec atelier2026-api-1 npx --yes tsx prisma/seed.ts` |

---

## Architecture Docker

```
Internet :80/:443
    └── Caddy
          ├── /api/*  → api:3001 (NestJS)
          └── /*      → web:3000 (Next.js standalone)

api → postgres:5432
api → redis:6379 (BullMQ)
```

Images GHCR :
- `ghcr.io/eaglefox31/atelier2026-api:latest`
- `ghcr.io/eaglefox31/atelier2026-web:latest`

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `deploy/docker/docker-compose.prod.yml` | Stack complète (images GHCR + build fallback) |
| `deploy/docker/Dockerfile.api` | NestJS — builder + runner, prisma generate |
| `deploy/docker/Dockerfile.web` | Next.js standalone, `NEXT_PUBLIC_APP_VERSION` injecté |
| `deploy/docker/api-entrypoint.sh` | Init DB au démarrage (double-passe full_schema.sql) |
| `deploy/docker/Caddyfile` | Reverse proxy HTTP/HTTPS |
| `deploy/scripts/compose-prod.sh` | Wrapper `docker compose` avec les bons flags |
| `deploy/scripts/remote-deploy.ps1` | Deploy manuel Windows (tar + scp + ssh) |
| `prisma/full_schema.sql` | Triggers, audit_logs partitionné, vues, fonctions calculées |
| `prisma/custom_schema.sql` | DEPRECATED — utiliser `full_schema.sql` |
| `.github/workflows/ci.yml` | Tests + semantic-release |
| `.github/workflows/deploy.yml` | Build GHCR + deploy SSH |
| `.releaserc.json` | Config semantic-release |
