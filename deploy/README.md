# Deploiement MVP — Oracle Cloud (1 plateforme, $0 Always Free)

Stack sur **une VM ARM** : Caddy (80/443) + Next.js + NestJS + Redis. PostgreSQL reste sur **Supabase**.

Concu pour eviter les pieges connus du projet :
- migrations via `migrate-missing.mjs` + `DIRECT_URL` (pas `prisma migrate deploy`)
- `/api/*` route par **Caddy** (pas de rewrite Next au build)
- `ALLOWED_ORIGINS` = URL publique du browser
- images **linux/arm64** (Oracle Ampere A1)

---

## Prerequis locaux

- Compte [Oracle Cloud](https://cloud.oracle.com) (Always Free)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- Cle SSH (`ssh-keygen -t ed25519`)
- Supabase : `DATABASE_URL` (6543) + `DIRECT_URL` (5432)
- Git Bash ou WSL sur Windows pour `remote-deploy.sh`

Configurer l'auth OCI pour Terraform :

```bash
# ~/.oci/config — genere par l'installateur OCI CLI
# ou variables :
export TF_VAR_compartment_id="ocid1.tenancy.oc1..xxx"
export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_ed25519.pub)"
export TF_VAR_admin_cidr="$(curl -s ifconfig.me)/32"
export TF_VAR_region="eu-paris-1"
```

---

## Etape 1 — Infrastructure (Terraform)

```bash
cd deploy/oci/terraform
cp terraform.tfvars.example terraform.tfvars
# Editer terraform.tfvars (compartment, cle SSH, admin_cidr)

terraform init
terraform plan
terraform apply
```

Noter la **IP publique** affichee.

### Erreur « Out of host capacity »

Classique sur Ampere A1. Essayer dans `terraform.tfvars` :

```hcl
availability_domain = "xxxxx:EU-PARIS-1-AD-2"
```

Ou une autre region home (`af-johannesburg-1`, `eu-marseille-1`, etc.).

---

## Etape 2 — Secrets applicatifs + seed BDD

```bash
cp deploy/.env.prod.example deploy/.env.prod
```

Remplir au minimum :

| Variable | Exemple |
|----------|---------|
| `DATABASE_URL` | Supabase pooler `:6543?pgbouncer=true&sslmode=require` |
| `DIRECT_URL` | Supabase session `:5432?sslmode=require` |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ALLOWED_ORIGINS` | `http://VOTRE_IP` (sans slash final) |

**Avant le premier login**, créer les comptes test depuis votre machine (`.env` local avec les mêmes URLs Supabase) :

```bash
npm run migrate          # si pas encore fait
npx prisma db seed
```

---

## Etape 3 — Deploy applicatif

Attendre ~2 min apres `terraform apply` (cloud-init installe Docker).

```bash
chmod +x deploy/scripts/remote-deploy.sh
./deploy/scripts/remote-deploy.sh ubuntu@VOTRE_IP
```

Premier build sur la VM : **10–20 min** (ARM).

Ouvrir **http://VOTRE_IP** — login : `admin@atelier.cm` / `Atelier2026!`

---

## Etape 4 — HTTPS (optionnel)

1. Pointer un domaine (A record) vers l'IP
2. Dans `deploy/.env.prod` : `APP_DOMAIN=atelier.example.cm`
3. Decommenter le bloc `{$APP_DOMAIN}` dans `deploy/docker/Caddyfile`
4. Relancer `remote-deploy.sh`

---

## Architecture

```
Internet :80/:443
    └── Caddy
          ├── /api/*  → api:3001 (NestJS)
          └── /*      → web:3000 (Next.js standalone)
    api → Redis (BullMQ)
    api → Supabase PostgreSQL (externe)
```

---

## Commandes utiles (sur la VM)

```bash
ssh ubuntu@IP
cd /opt/atelier2026

docker compose -f deploy/docker/docker-compose.prod.yml ps
docker compose -f deploy/docker/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker/docker-compose.prod.yml restart api
```

---

## Test local avant Oracle (Docker Desktop)

```bash
cp deploy/.env.prod.example deploy/.env.prod
# ALLOWED_ORIGINS=http://localhost

docker compose -f deploy/docker/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
# http://localhost
```

---

## Fichiers

| Fichier | Role |
|---------|------|
| `deploy/oci/terraform/` | IaC VM + reseau OCI |
| `deploy/docker/docker-compose.prod.yml` | Stack prod |
| `deploy/docker/Dockerfile.api` | Build NestJS + migrations au start |
| `deploy/docker/Dockerfile.web` | Next.js standalone |
| `deploy/docker/Caddyfile` | Reverse proxy |
| `deploy/scripts/remote-deploy.sh` | Sync + build distant |

---

## Seed BDD (premiere fois)

Les migrations creent les tables. Pour les comptes de test (`admin@atelier.cm`, etc.), lancer le seed **depuis votre machine** (pas dans le conteneur prod) :

```bash
# .env local avec DIRECT_URL + DATABASE_URL Supabase
npx prisma db seed
```

A reserver aux environnements demo / staging.
