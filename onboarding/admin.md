# Onboarding — Administrateur

Vous avez accès à tout. Votre rôle : configurer le système, gérer l'équipe, surveiller la santé de l'application, et intervenir en cas de problème.

---

## Connexion

Compte : `admin@atelier.cm` / `Atelier2026!` (à changer immédiatement en production)

---

## Mise en service initiale (première fois)

### 1. Seed de la base de données

```bash
npx prisma db seed
```

Crée les rôles, permissions et les 5 comptes de test. À faire une seule fois sur un environnement vierge.

### 2. Vérifier le schéma SQL Supabase

Le fichier `prisma/custom_schema.sql` contient les triggers et séquences de numérotation (OT-XXXX, DEV-XXXX, FAC-XXXX). Il doit être exécuté manuellement dans l'éditeur SQL Supabase **avant** le premier OT.

### 3. Variables d'environnement

| Variable | Obligatoire | Valeur en production |
|----------|-------------|----------------------|
| `DATABASE_URL` | Oui | URL pooler Supabase (port 6543) |
| `DIRECT_URL` | Oui | URL directe Supabase (port 5432, migrations) |
| `JWT_SECRET` | Oui | Chaîne aléatoire longue (≥ 32 chars) |
| `API_PORT` | Non | 3006 par défaut |
| `REDIS_HOST` / `REDIS_PORT` | Non | localhost/6379 — requis pour SMS et alertes stock |
| `ALLOWED_ORIGINS` | Non | Vide = tout autoriser (dev uniquement) |

---

## Gestion de l'équipe

**Équipe** (`/team`) → **Nouveau membre** :
- Remplissez prénom, nom, email, téléphone
- Assignez un rôle (RECEPTIONNISTE, TECHNICIEN, CHEF_ATELIER, CAISSIER)
- Le membre reçoit un code employé automatique
- Définissez son mot de passe initial → il doit le changer à la première connexion

**Suspendre un compte** : fiche membre → **Suspendre**
→ Le token JWT actif est invalidé via `tokenVersion` (révocation immédiate, pas d'attente d'expiration)

---

## Surveillance quotidienne

### Journal d'audit (`/audit`)
Toutes les actions sont tracées : qui a fait quoi, sur quelle entité, quand, depuis quelle IP.
Utilisez les filtres `entityType` + `action` pour investiguer un incident.

### Stock bas
**Stock & Pièces** → les pièces en rouge sont sous leur seuil minimum.
Les alertes automatiques partent via BullMQ (queue `stock-alerts`) si Redis est actif.

### Notifications SMS (`/notifications`)
Historique de tous les SMS envoyés (simulation Orange/MTN CM). Vérifiez les statuts **FAILED** pour détecter des problèmes de livraison.

---

## Lancer l'application

```bash
# Dev (type-check + les deux serveurs)
npm run dev

# Prod
npm run build && npm start
```

Les deux serveurs démarrent ensemble :
- NestJS API → port **3006**
- Next.js → port **3005**

Le proxy Next.js redirige `/api/*` → `http://localhost:3006/api/*`.

---

## Pages accessibles uniquement par l'admin

| Page | Usage |
|------|-------|
| `/team` | Gestion complète de l'équipe |
| `/audit` | Journal d'audit complet |
| `/reports` | CA, performance techniciens |
| `/notifications` | Historique SMS |
| `/settings` | Paramètres système |
| `/history` | Historique global des actions |

---

## Points clés

- **Ne jamais supprimer** un utilisateur en base de données — utilisez le soft delete (champ `deletedAt`). L'historique doit rester intact.
- Le champ `tokenVersion` sur chaque utilisateur permet la révocation immédiate des tokens sans blacklist Redis.
- En cas de doublon unique (P2002), le système retourne automatiquement un **409 Conflict** — pas besoin d'intervention manuelle.
- Les séquences de numérotation (OT, FAC, DEV, VCC, ASP) sont dans Supabase. Si elles se désynchronisent, réinitialisez-les depuis l'éditeur SQL Supabase avec `SELECT setval('seq_ot', MAX(…))`.
