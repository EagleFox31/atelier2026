# Comprendre l'app 101

Guide vivant du projet **Atelier Maître** : leçons apprises, pièges évités, astuces qui marchent vraiment sur ce stack (Next.js + NestJS + Supabase).

> Ce fichier s'enrichit au fur et à mesure qu'on avance. Une leçon = un problème rencontré + la solution retenue.

---

## Sommaire

1. [Migrations Supabase — ne pas utiliser `prisma migrate deploy` seul](#1-migrations-supabase--ne-pas-utiliser-prisma-migrate-deploy-seul)
2. [Deux URLs de connexion : pooler vs direct](#2-deux-urls-de-connexion--pooler-vs-direct)
3. [Paramètres atelier en base (devis / factures)](#3-paramètres-atelier-en-base-devis--factures)
4. [PDF devis — pas de html2canvas avec Tailwind v4](#4-pdf-devis--pas-de-html2canvas-avec-tailwind-v4)
5. [jsPDF + toLocaleString('fr-FR') = slash dans les montants](#5-jspdf--tolocalestring-fr-fr--slash-dans-les-montants)
6. [pdfText() supprime les sauts de ligne → affiche ?](#6-pdftext-supprime-les-sauts-de-ligne--affiche-)
7. [pgbouncer + set_config PostgreSQL → CTE atomique obligatoire](#7-pgbouncer--set_config-postgresql--cte-atomique-obligatoire)
8. [Prisma include superficiel — relations imbriquées absentes](#8-prisma-include-superficiel--relations-imbriquées-absentes)
9. [Dialog React — séparer ouverture et chargement async](#9-dialog-react--séparer-ouverture-et-chargement-async)
10. [AppLayout — ne jamais wrapper deux fois](#10-applayout--ne-jamais-wrapper-deux-fois)
11. [Déploiement MVP Oracle — Caddy route `/api`, pas le rewrite Next](#11-déploiement-mvp-oracle--caddy-route-api-pas-le-rewrite-next)
12. [Statuts OT hors pipeline (`QC_REJECTED`) — roadmap et badge Actuel](#12-statuts-ot-hors-pipeline-qc_rejected--roadmap-et-badge-actuel)
13. [Barre mobile technicien — une config, toutes les actions](#13-barre-mobile-technicien--une-config-toutes-les-actions)
14. [TypeScript — `.includes()` sur enum `OTStatus`](#14-typescript--includes-sur-enum-otstatus)
15. [Sync devis implicite — respecter `quotes_client_approval_method_check`](#15-sync-devis-implicite--respecter-quotes_client_approval_method_check)
16. [Roadmap OT — ne pas confondre le trait vertical et la coche](#16-roadmap-ot--ne-pas-confondre-le-trait-vertical-et-la-coche)
17. [Démarrage dev — `ECONNREFUSED` sur `/api/*` avant que NestJS écoute](#17-démarrage-dev--econnrefused-sur-api-avant-que-nestjs-écoute)
18. [Ports locaux — Next **3000**, Nest **3001** (source de vérité)](#18-ports-locaux--next-3000-nest-3001-source-de-vérité)
19. [Transition OT idempotente — double-clic et UI stale](#19-transition-ot-idempotente--double-clic-et-ui-stale)
20. [Notifications in-app — qui reçoit quoi sur le flux CQ](#20-notifications-in-app--qui-reçoit-quoi-sur-le-flux-cq)
21. [Refus CQ — motif obligatoire (ORD-005)](#21-refus-cq--motif-obligatoire-ord-005)
22. [Template pour ajouter une leçon](#22-template-pour-ajouter-une-leçon)

---

## 1. Migrations Supabase — ne pas utiliser `prisma migrate deploy` seul

### Symptôme

```bash
npx prisma migrate deploy
```

Affiche la connexion sur le **pooler port 6543** puis **reste bloqué** indéfiniment (pas d'erreur, pas de fin).

### Cause

Sur Supabase, `DATABASE_URL` pointe vers **PgBouncer** (port 6543). Prisma Migrate a besoin de verrous advisory et de DDL — ça ne passe pas bien via le pooler transactionnel.

### Solution retenue sur ce projet

**Préférer le script maison** qui utilise `DIRECT_URL` (port 5432) via `pg` :

```bash
node scripts/migrate-missing.mjs
# ou
npm run migrate
```

Le script :
- se connecte en **direct** (pas pgbouncer) ;
- vérifie si la table existe déjà (`IF NOT EXISTS` / `SELECT FROM pg_tables`) ;
- est **idempotent** — relancer ne casse rien.

### Quand ajouter une migration

1. Modifier `prisma/schema.prisma`.
2. Ajouter le SQL dans `prisma/migrations/YYYYMMDD_nom/migration.sql` (historique).
3. **Ajouter la même logique** dans `scripts/migrate-missing.mjs` (exécution réelle).
4. Lancer `npm run migrate`.
5. `npx prisma generate` si le client Prisma a changé.

### Alternatives acceptables

| Méthode | Quand |
|---------|--------|
| `npm run migrate` | **Défaut local + CI** |
| Supabase → SQL Editor | Coller le `.sql` à la main |
| `prisma migrate deploy` | Seulement si `DIRECT_URL` est bien pris en charge et que ça ne bloque pas — **pas notre défaut aujourd'hui** |

---

## 2. Deux URLs de connexion : pooler vs direct

| Variable | Port | Usage |
|----------|------|--------|
| `DATABASE_URL` | 6543 | Runtime NestJS / requêtes app (PgBouncer) |
| `DIRECT_URL` | 5432 | Migrations, DDL, scripts `migrate-missing.mjs` |

Les deux doivent avoir `?sslmode=require` sur Supabase.

**Règle mnémotechnique :** l'app tourne sur 6543, le schéma évolue sur 5432.

---

## 3. Paramètres atelier en base (devis / factures)

### Avant

Nom, adresse, tel, email de l'atelier étaient **en dur** dans `lib/generate-billing-pdf.ts` et `BillingDocument.tsx`.

### Maintenant

- Table `workshop_settings` (ligne unique `id = 'default'`).
- API : `GET/PATCH /api/settings/workshop`.
- Page **Paramètres → Atelier** branchée.
- PDF devis + impression facture lisent ces données.

**Qui peut modifier ?** ADMIN et SUPER_ADMIN uniquement (PATCH).

---

## 4. PDF devis — pas de html2canvas avec Tailwind v4

### Symptôme

Toast « Erreur lors de la génération du PDF » ou onglet vide.

### Cause

`html2canvas` ne parse pas les couleurs CSS **`oklch()`** de Tailwind v4.

### Solution

Génération PDF **native** avec `jspdf` + `jspdf-autotable` depuis les données (`BillingDocumentData`), sans capture DOM.

Page d'impression : `/billing/quotes/[id]/print` — aperçu iframe + téléchargement.

---

## 5. jsPDF + toLocaleString('fr-FR') = slash dans les montants

### Symptôme

Les montants dans le PDF affichent `25/000 XAF` au lieu de `25 000 XAF`.

### Cause

`toLocaleString('fr-FR')` utilise l'espace fine insécable (` `) comme séparateur de milliers. La police Helvetica de jsPDF ne connaît pas ce caractère et le remplace par `/`.

### Solution retenue

Formater manuellement avec une regex ASCII :

```typescript
function fmtXaf(n: number) {
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} XAF`;
}
```

### À ne pas faire

Ne jamais appeler `toLocaleString()` dans du code qui produit du texte pour jsPDF. S'applique aussi aux km, quantités, tout nombre affiché dans un PDF.

---

## 6. pdfText() supprime les sauts de ligne → affiche ?

### Symptôme

Les notes multi-lignes s'affichent avec des `?` à la place des retours à la ligne : `Forfait diagnostic?Plainte client?Tests...`

### Cause

Le filtre ASCII `/[^\x20-\x7E]/g` dans `pdfText()` remplace tout caractère hors plage imprimable, y compris `\n` (0x0A).

### Solution retenue

Ajouter `.replace(/\r?\n/g, ' ')` avant le filtre ASCII :

```typescript
function pdfText(value: string | undefined | null, fallback = '-'): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[—·œŒ]/g, ...)
    .replace(/\r?\n/g, ' ')      // ← avant le filtre ASCII
    .replace(/[^\x20-\x7E]/g, '?');
}
```

jsPDF gère le retour à la ligne visuel lui-même via `splitTextToSize`.

---

## 7. pgbouncer + set_config PostgreSQL → CTE atomique obligatoire

### Symptôme

L'historique des statuts OT affiche toujours le même utilisateur (celui qui a créé l'OT), même quand c'est quelqu'un d'autre qui a fait la transition.

### Cause

Le trigger `fn_trg_ot_status_history` lit `current_setting('app.current_user_id')`. NestJS ne le définissait jamais. Quand on essaie de le définir dans une requête séparée, pgbouncer (mode transaction) peut servir la connexion suivante à un autre client — la variable disparaît.

### Solution retenue

Grouper `set_config` et l'`UPDATE` dans un seul statement via CTE :

```typescript
await this.prisma.$executeRaw`
  WITH set_user AS (
    SELECT set_config('app.current_user_id', ${userId}, true)
  )
  UPDATE service_orders
  SET status = ${status}::"ot_status_t", version = version + 1
  WHERE id = ${id}::uuid AND version = ${version}
`;
```

Un seul aller-retour = pgbouncer-safe. Le `true` (3e argument de `set_config`) scinde la variable à la transaction.

### À ne pas faire

Ne pas appeler `$executeRaw` pour `set_config` puis une deuxième requête `update` séparée — pgbouncer peut intercaler une autre connexion entre les deux.

---

## 8. Prisma include superficiel — relations imbriquées absentes

### Symptôme

`line.part` est `undefined` dans le frontend alors que la pièce existe en base.

### Cause

`include: { lines: true }` charge les lignes mais pas leurs sous-relations. Prisma n'infère pas la profondeur souhaitée.

### Solution retenue

Toujours spécifier la profondeur explicitement :

```typescript
// ❌ ne charge pas la pièce
quotes: { include: { lines: true } }

// ✅ charge la pièce de chaque ligne
quotes: { include: { lines: { include: { part: true } } } }
```

### À ne pas faire

Supposer que `include: true` est récursif. Ce n'est jamais le cas dans Prisma.

---

## 9. Dialog React — séparer ouverture et chargement async

### Symptôme

Un bouton "Assigner" cliqué ne déclenche rien — le dialog ne s'ouvre pas, pas d'erreur visible.

### Cause

Le handler du bouton faisait un appel API avant d'ouvrir le dialog. Si l'appel échouait silencieusement (ou que `order` n'était pas encore chargé), la fonction retournait sans rien faire.

### Solution retenue

```typescript
// Le bouton ouvre simplement le dialog
function openAssignDialog() { setIsAssignOpen(true); }

// Un useEffect gère le chargement des données
useEffect(() => {
  if (!isAssignOpen || teamMembers.length > 0) return;
  teamApi.list({})
    .then((data: any) => setTeamMembers(Array.isArray(data) ? data : []))
    .catch(() => {});
}, [isAssignOpen]);
```

Le dialog s'ouvre immédiatement ; les données arrivent en asynchrone et l'UI se met à jour.

---

## 10. AppLayout — ne jamais wrapper deux fois

### Symptôme

La sidebar et le header apparaissent en double à l'intérieur du contenu principal.

### Cause

Une page wrappait son contenu avec `<AppLayout>` alors que le shell Next.js (`app/layout.tsx`) l'injecte déjà pour toutes les routes protégées.

### Solution retenue

Les pages retournent directement leur contenu sans wrapper de layout :

```tsx
// ❌ double layout
export default function SettingsPage() {
  return <AppLayout><div>...</div></AppLayout>;
}

// ✅ layout fourni par le shell
export default function SettingsPage() {
  return <div>...</div>;
}
```

### À ne pas faire

Ajouter `<AppLayout>` dans une page sans vérifier comment les pages voisines sont structurées.

---

## 11. Déploiement MVP Oracle — Caddy route `/api`, pas le rewrite Next

### Symptôme

En prod Docker, le front charge mais les appels `/api/*` échouent (502, CORS, ou connexion refusée sur `localhost:3001`).

### Cause

En dev, Next.js rewrite `/api/*` → `BACKEND_URL` (port 3001). En prod conteneurisée, **`BACKEND_URL` n'est pas défini au build** : le rewrite pointe vers `localhost:3001` *dans le conteneur web*, inaccessible.

De plus, `ALLOWED_ORIGINS` doit être l'URL **vue par le browser** (IP ou domaine), pas une URL interne Docker.

### Solution retenue

Stack documentée dans **`deploy/README.md`** :

1. **Caddy** devant tout (`:80` / `:443`) :
   - `/api/*` → conteneur `api:3001` (NestJS)
   - le reste → conteneur `web:3000` (Next standalone)
2. Le browser appelle `/api/...` sur **la même origine** — pas besoin de `BACKEND_URL` au build Next.
3. Migrations au démarrage API via **`migrate-missing.mjs` + `DIRECT_URL`** (jamais `prisma migrate deploy` seul).
4. Seed des comptes test **depuis la machine locale** : `npx prisma db seed` (pas dans l'image prod).

```bash
cd deploy/oci/terraform && terraform apply
cp deploy/.env.prod.example deploy/.env.prod   # ALLOWED_ORIGINS=http://IP
npx prisma db seed                             # une fois, avant le 1er login
./deploy/scripts/remote-deploy.sh ubuntu@IP
```

### À ne pas faire

- Mettre `BACKEND_URL=http://api:3001` dans le conteneur web en espérant que le rewrite Next suffise — le client browser ne résout pas `api`.
- Oublier le seed : les migrations créent les tables, pas les users.
- `ALLOWED_ORIGINS` avec un slash final ou en `https://` alors que Caddy sert encore du HTTP nu.

---

## 12. Statuts OT hors pipeline (`QC_REJECTED`) — roadmap et badge Actuel

### Symptôme

Après un refus CQ, la roadmap n'affiche aucun badge **Actuel**, ou deux badges **Actuel** en même temps (Travaux en cours + QC refusé). Les premières étapes (Brouillon, Reçu) perdent leur coche.

### Cause

`QC_REJECTED` n'est **pas** une étape du pipeline linéaire (`PIPELINE[]`). `findIndex('QC_REJECTED')` retourne `-1`, ce qui casse toute la logique `isDone` / `isCurrent`.

De plus, un refus CQ n'est pas une fin de parcours : le technicien doit **reprendre** les travaux — deux états métier coexistent (refus enregistré + reprise en attente), mais un seul badge **Actuel** à la fois.

### Solution retenue

1. **`computeProgressIdx()`** — index avancé dérivé de l'historique + fiche réception (pas seulement le statut courant).
2. **Sous-étape « QC refusé »** injectée après « Contrôle qualité » (motif, chef, compteur `#1`, `#2`…).
3. Quand `status === QC_REJECTED` :
   - **QC refusé** → badge **Actuel** ;
   - **Travaux en cours** → badge **Reprise en attente** (orange), sans **Actuel** ;
4. Refus CQ obligatoire côté API (**ORD-005**) + dialog frontend avec `reason` persisté dans `ot_status_history`.

Fichiers clés : `components/workshop/OTTimeline.tsx`, `app/workshop/[id]/page.tsx`, `workshop.service.ts`.

### À ne pas faire

- Marquer **Actuel** sur deux étapes simultanément.
- Supposer qu'un statut absent de `PIPELINE[]` se comporte comme les autres sans logique dédiée.

---

## 13. Barre mobile technicien — une config, toutes les actions

### Symptôme

Sur mobile, le technicien ne trouve pas le bouton d'action (ex. « Reprendre les travaux » après refus CQ), alors que l'action existe dans le header desktop.

### Cause

Les boutons du header scrollent hors écran ; seule la **barre fixe** (`TechMobileBar`) reste accessible. Chaque nouvelle action technicien oubliée dans cette barre = UX cassée sur mobile.

### Solution retenue

Config centralisée dans **`lib/workshop-tech-mobile.ts`** :

| Statut OT | Bouton mobile |
|-----------|---------------|
| `RECEIVED` | Commencer (diagnostic) |
| `DIAGNOSING` | Constat |
| `QUOTE_APPROVED` | Lancer les travaux |
| `IN_PROGRESS` | Contrôle qualité |
| `QC_REJECTED` | Reprendre les travaux |

**Règle :** à chaque statut où le technicien assigné doit agir → ajouter une entrée dans `TECH_MOBILE_PRIMARY_BY_STATUS`. Le header masque le bouton équivalent sur mobile (`hidden md:inline-flex`) quand la barre le gère.

Bandeau contextuel complémentaire : `TechReworkBanner` (refus CQ), `TechDiagnosticBanner` (diagnostic).

### À ne pas faire

- Ajouter un bouton d'action technicien uniquement dans le header sans vérifier `TechMobileBar`.
- Oublier le RBAC backend (`TRANSITION_ROLES`) — ex. `QC_REJECTED → IN_PROGRESS` doit inclure `TECHNICIEN`.

---

## 14. TypeScript — `.includes()` sur enum `OTStatus`

### Symptôme

Erreur de compilation :

```
Argument of type 'OTStatus' is not assignable to parameter of type '"IN_PROGRESS" | "QC_PENDING" | ...'
Type '"DRAFT"' is not assignable to type ...
```

### Cause

Sur un tableau de littéraux `[OTStatus.IN_PROGRESS, ...]`, TypeScript infère un type union étroit. `.includes(targetStatus)` exige que l'argument soit **déjà** dans cette union — incompatible avec un `OTStatus` complet.

### Solution retenue

Utiliser un **`Set<OTStatus>`** :

```typescript
const postApprovalStatuses = new Set<OTStatus>([
  OTStatus.IN_PROGRESS, OTStatus.QC_PENDING, /* ... */
]);
const isPostApproval = postApprovalStatuses.has(targetStatus);
```

### À ne pas faire

Caster aveuglément `targetStatus as OTStatus` dans `.includes()` — ça masque l'erreur sans la résoudre proprement.

---

## 15. Devis — approbation manuelle uniquement (plus de sync OT)

### Symptôme

Logs `Échec sync devis APPROVED` + erreur PostgreSQL :

```
violates check constraint "quotes_client_approval_method_check"
```

Même avec `SIGNATURE` dans le code — la contrainte **réelle en base** n'accepte pas cette valeur.

### Cause

1. **Sync automatique supprimée** — l'ancien `sync-quote-with-ot.ts` tentait de passer un devis `SENT` → `APPROVED` quand l'OT avançait, avec une méthode inventée (`SIGNATURE`).
2. **Contrainte SQL Supabase** (vérifier avec `node scripts/audit-quote-ot-status.mjs`) :

```sql
CHECK (client_approval_method = ANY (ARRAY['PHYSICAL','DIGITAL','VERBAL_NOTED']))
```

3. **Double chemin incohérent** — l'OT pouvait passer `QUOTE_PENDING → QUOTE_APPROVED` depuis l'atelier **sans** approuver le devis en Facturation.

### Solution retenue

| Action | Où |
|--------|-----|
| Approuver le devis | **Facturation** → `billing.approveQuote()` (`VERBAL_NOTED` par défaut) |
| OT → `QUOTE_APPROVED` | Uniquement via `approveQuote` (plus depuis l'atelier) |
| Démarrer les travaux | Atelier `QUOTE_APPROVED → IN_PROGRESS` si devis `APPROVED` (ORD-006) |

Constantes : `src/shared/billing/quote-approval.constants.ts` — alignées sur la contrainte SQL.

Audit incohérences : `node scripts/audit-quote-ot-status.mjs`

### À ne pas faire

- Réintroduire une sync silencieuse OT → devis.
- Utiliser `SIGNATURE`, `SMS`, `PHONE`, `VERBAL` sans lire la contrainte SQL réelle.
- Avancer l'OT en « devis approuvé » sans passer par Facturation.

---

## 16. Roadmap OT — ne pas confondre le trait vertical et la coche

### Symptôme

La ligne verticale entre les étapes traverse le centre de l'icône ✓ — visuellement confus (trait = coche ?).

### Cause

Le connecteur partait au milieu de l'icône (`top-6`, `CheckCircle2` outline 24px).

### Solution retenue

1. Trait vertical **sous** l'icône (`top-7`, `w-px`).
2. Icône « fait » = pastille pleine colorée + `Check` blanc, sur fond `bg-card ring-2` qui masque le trait.
3. États distincts : fait (bleu/orange), actuel (horloge), reprise en attente (orange `RotateCcw`), futur (cercle vide).

Fichier : `components/workshop/OTTimeline.tsx` (`TimelineConnector`, `DoneIcon`, `TimelineIcon`).

### À ne pas faire

- Utiliser `CheckCircle2` outline aligné sur le trait sans fond de masquage.

---

## 17. Démarrage dev — `ECONNREFUSED` sur `/api/*` avant que NestJS écoute

### Symptôme

Au lancement de `npm run dev`, le terminal Next affiche :

```
Failed to proxy http://localhost:3001/api/notifications/inbox { code: 'ECONNREFUSED' }
```

Parfois suivi de `Compiling /_error`. La cloche notifications semble « cassée » alors que l'app vient juste de démarrer.

### Cause

1. **`scripts/dev.mjs`** lançait Next.js après un délai fixe (4 s) — NestJS peut mettre **plus longtemps** (Prisma, Redis, modules…).
2. **`NotificationBell`** poll `/api/notifications/inbox` dès le montage → Next rewrite vers `:3001` alors que l'API n'écoute pas encore.

Ce n'est **pas** un bug métier notifications : c'est une course au démarrage.

### Solution retenue

1. **`scripts/dev.mjs`** — attendre que `GET http://localhost:3001/api/health` réponde **200** avant de lancer Next (poll 500 ms, max ~30 s).
2. **`NotificationBell.tsx`** — retry silencieux au premier chargement (2 s → 4 s → 8 s) sur erreur réseau (`TypeError`), sans spammer la console.

Endpoint health : `src/app.controller.ts` → `@Public() @Get('health')`, préfixe global `/api`.

### À ne pas faire

- Interpréter `ECONNREFUSED` au boot comme « l'API notifications est down en prod ».
- Démarrer Next sur un délire fixe sans vérifier que NestJS écoute vraiment.

---

## 18. Ports locaux — Next **3000**, Nest **3001** (source de vérité)

### Symptôme

Confusion : README / `CLAUDE.md` / Playwright mentionnent parfois **3005**, alors que `npm run dev` ouvre **3000**.

### Cause

Documentation et scripts divergents (`dev.mjs` vs `dev:next` vs `playwright.config.ts`).

### Solution retenue

| Service | Port | Référence |
|---------|------|-----------|
| Next.js (dev) | **3000** | `scripts/dev.mjs` → `NEXT_PORT` |
| NestJS (API) | **3001** | `API_PORT` / variable `API_PORT` |
| Proxy Next | — | rewrite `/api/*` → `BACKEND_URL` (défaut `http://localhost:3001`) |

**Règle :** `scripts/dev.mjs` fait foi pour `npm run dev`. Aligner `package.json` (`dev:next`) et `.env.example` (`ALLOWED_ORIGINS=http://localhost:3000`) en conséquence.

### À ne pas faire

- Changer le port Next « parce que la doc dit 3005 » sans vérifier ce que l'utilisateur lance réellement.

---

## 19. Transition OT idempotente — double-clic et UI stale

### Symptôme

Clic « Reprendre les travaux » → **400** avec message du type `IN_PROGRESS → IN_PROGRESS` interdit.

### Cause

1. La transition a **réussi** côté API, mais le frontend n'a pas encore rafraîchi le statut (`refetch()` non await).
2. L'utilisateur reclique (mobile surtout) → deuxième appel avec le **même** statut cible alors que l'OT est déjà `IN_PROGRESS`.

### Solution retenue

**Backend** (`workshop.service.ts`) — retour anticipé idempotent :

```typescript
if (targetStatus === ot.status) {
  return this.getOTById(otId, user);
}
```

**Frontend** (`changeStatus`) — `await refetch()` après succès + garde si `statusLoading` ou statut déjà égal.

### À ne pas faire

- Laisser une transition « no-op » remonter une erreur 400 — ça pénalise le double-tap mobile.
- Appeler `refetch()` en fire-and-forget avant de réactiver les boutons.

---

## 20. Notifications in-app — qui reçoit quoi sur le flux CQ

### Symptôme

Le chef ou l'admin ne voit pas de notification après refus CQ, reprise travaux, ou soumission QC — alors que le technicien si.

### Cause

Les notifications sont créées **dans `workshop.service.ts`** au moment des transitions, avec des règles de destinataires par paire `(fromStatus → toStatus)`. Oublier un bloc = silence côté rôle concerné.

**Piège de nommage :** le champ Prisma `assignedChef` désigne en pratique le **technicien assigné** à l'OT (filtre RBAC technicien), pas le chef d'atelier.

### Solution retenue — tableau des événements CQ

| Transition | Destinataires | Notes |
|------------|---------------|-------|
| `QUOTE_APPROVED → IN_PROGRESS` | CHEF_ATELIER, ADMIN, SUPER_ADMIN | Exclut l'auteur de l'action |
| `IN_PROGRESS → QC_PENDING` | CHEF_ATELIER, ADMIN, SUPER_ADMIN | « OT soumis au contrôle qualité » |
| `QC_PENDING → QC_REJECTED` | `assignedChef` (technicien) + ADMIN, SUPER_ADMIN | Motif dans le body ; titre `#2`, `#3`… à partir du 2ᵉ refus ; chef qui refuse exclu |
| `QC_REJECTED → IN_PROGRESS` | CHEF_ATELIER, ADMIN, SUPER_ADMIN | « Travaux repris après refus CQ » |

Création via `notifications.createInApp()` en `setImmediate` (non bloquant). Cloche frontend : poll 30 s + toasts sur nouvelles notifs.

### À ne pas faire

- Chercher la cause d'une notif manquante dans le proxy Next si `ECONNREFUSED` au boot (voir leçon 17).
- Confondre `assignedChef` (technicien sur l'OT) et le rôle `CHEF_ATELIER`.

---

## 21. Refus CQ — motif obligatoire (ORD-005)

### Symptôme

Le chef peut refuser le CQ sans explication → le technicien ne sait pas quoi corriger.

### Cause

Transition `QC_PENDING → QC_REJECTED` acceptée sans `reason` côté API et sans dialog frontend.

### Solution retenue

1. **Backend** — règle **ORD-005** : `reason` non vide requis sur cette transition ; persisté dans `ot_status_history.reason`.
2. **Frontend** — dialog dédié avant l'appel API ; le motif est repris dans la notification technicien (`Motif : …`).
3. **Roadmap** — sous-étape « QC refusé » avec motif affiché (voir leçon 12).

### À ne pas faire

- Refuser le CQ depuis un simple bouton sans saisie — même si l'API semblait accepter avant ORD-005.

---

## 22. Template pour ajouter une leçon

Copier-coller ce bloc en bas du fichier quand une nouvelle astuce mérite d'être conservée :

```markdown
## N. Titre court du sujet

### Symptôme
Ce qu'on voit (erreur, lenteur, comportement bizarre).

### Cause
Pourquoi ça arrive sur CE projet.

### Solution retenue
Commandes, fichiers, convention à suivre.

### À ne pas faire
Piège classique à éviter.
```

---

*Dernière mise à jour : 2026-05-26 — leçons 17–21 démarrage dev, ports, idempotence OT, notifications CQ*
