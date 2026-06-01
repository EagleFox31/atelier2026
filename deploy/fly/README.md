# Déploiement Fly.io — Atelier Maître

Deux apps Fly.io : `atelier-api` (NestJS 3001) + `atelier-web` (Next.js 3000).
La BDD reste sur **Supabase**. Redis via **Upstash** (extension Fly.io gratuite).

```
Internet HTTPS
  └── atelier-web.fly.dev   (Next.js)
        └── /api/*  →  atelier-api.internal:3001  (réseau privé Fly)
              └── Supabase PostgreSQL
              └── Upstash Redis (BullMQ)
```

---

## Pré-requis

```bash
# Installer flyctl
# Windows : winget install Fly.io.flyctl
# Mac/Linux : curl -L https://fly.io/install.sh | sh

fly auth login          # créer un compte sur fly.io si besoin
```

---

## Étape 1 — Créer les apps

```bash
# Choisir un slug unique (visible dans l'URL : https://atelier-api-TON-SLUG.fly.dev)
fly apps create atelier-api-TON-SLUG
fly apps create atelier-web-TON-SLUG
```

Mettre à jour `fly.api.toml` et `fly.web.toml` avec ton slug :
```toml
app = 'atelier-api-TON-SLUG'
```

---

## Étape 2 — Redis Upstash (BullMQ)

```bash
# Créer une instance Redis gratuite liée à l'app API
fly ext upstash redis create --app atelier-api-TON-SLUG --name atelier-redis
```

Fly.io injecte automatiquement `REDIS_URL` dans les secrets de l'app API.

Ensuite extraire HOST et PORT pour l'app :
```bash
fly secrets list --app atelier-api-TON-SLUG
# Récupérer REDIS_URL=redis://:password@host:port
# puis :
fly secrets set REDIS_HOST=<host> REDIS_PORT=<port> REDIS_PASSWORD=<password> --app atelier-api-TON-SLUG
```

> **Alternative simple** : laisser Redis de côté pour le MVP. L'app démarre
> sans Redis (BullMQ loggue des WARNs mais ne crashe pas).

---

## Étape 3 — Secrets API

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres.[ref]:[pwd]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require" \
  DIRECT_URL="postgresql://postgres.[ref]:[pwd]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" \
  ALLOWED_ORIGINS="https://atelier-web-TON-SLUG.fly.dev" \
  NODE_ENV="production" \
  --app atelier-api-TON-SLUG
```

---

## Étape 4 — Déployer l'API

```bash
fly deploy --config fly.api.toml --app atelier-api-TON-SLUG
```

Premier build : 5–10 min (téléchargement layers Docker).

Vérifier que l'API démarre bien :
```bash
fly logs --app atelier-api-TON-SLUG
# Chercher : [Nest] Application is running on: http://[::1]:3001
```

---

## Étape 5 — Mettre à jour l'URL interne dans fly.web.toml

Si ton API s'appelle `atelier-api-TON-SLUG`, mettre à jour `fly.web.toml` :
```toml
[env]
  BACKEND_URL = 'http://atelier-api-TON-SLUG.internal:3001'
```

---

## Étape 6 — Déployer le frontend

```bash
fly deploy --config fly.web.toml --app atelier-web-TON-SLUG
```

---

## Étape 7 — Vérifier

```bash
# Santé API
curl https://atelier-api-TON-SLUG.fly.dev/api/health

# Ouvrir le frontend
open https://atelier-web-TON-SLUG.fly.dev
```

Login : `admin@atelier.cm` / `Atelier2026!` (si le seed a été joué : `npx prisma db seed`).

---

## Commandes utiles

```bash
# Logs en direct
fly logs --app atelier-api-TON-SLUG
fly logs --app atelier-web-TON-SLUG

# Redémarrer
fly machine restart --app atelier-api-TON-SLUG

# Console Rails-like (shell dans le conteneur)
fly ssh console --app atelier-api-TON-SLUG

# Mettre à jour un secret sans redéployer
fly secrets set JWT_SECRET="nouveau_secret" --app atelier-api-TON-SLUG
fly deploy --config fly.api.toml --app atelier-api-TON-SLUG   # redéployer
```

---

## Domaine personnalisé (optionnel)

```bash
fly certs create atelier.mondomaine.cm --app atelier-web-TON-SLUG
# Fly affiche les DNS records à créer chez ton registrar
```

---

## Coût estimé (Fly.io free tier)

| Ressource | Coût |
|-----------|------|
| 2 shared-cpu-1x (256 MB) | Gratuit (3 VMs incluses) |
| API 512 MB | ~$1.50/mois (256 MB facturés) |
| Upstash Redis gratuit | 10 000 cmd/jour max |
| Egress réseau | 160 GB/mois gratuit |

**Total MVP** : < $2/mois avec une carte de crédit enregistrée.

---

## Architecture réseau Fly.io

```
Browser
  │  HTTPS  atelier-web-TON-SLUG.fly.dev
  └─► Next.js (machine Fly, région cdg)
        │  HTTP  atelier-api-TON-SLUG.internal:3001
        └─► NestJS (machine Fly, réseau privé 6PN)
                 ├─► Supabase PostgreSQL (internet, sslmode=require)
                 └─► Upstash Redis (internet, TLS)
```

Le réseau `.internal` est le VPN privé Fly.io (6PN) — gratuit, < 1ms de latence entre les machines de la même région.
