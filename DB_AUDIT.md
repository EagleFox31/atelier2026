# Audit Base de Données Supabase — Atelier 2026

**Date** : 2026-05-23  
**Instance** : PostgreSQL 17.6 (Supabase, eu-west-1)  
**Méthode** : connexion directe `DIRECT_URL` (port 5432), requêtes lecture seule  
**Scripts** : `scripts/db-audit-full.mjs`, `scripts/db-audit-supplement.mjs`  
**Données brutes** : `scripts/db-audit-report.json`

---

## Résumé exécutif

| Sévérité | Count | Synthèse |
|----------|-------|----------|
| 🔴 Critique | 4 | Drift enum/CHECK, vues sans `security_invoker`, GRANTs Data API larges |
| 🟡 Important | 5 | Pas d'historique Prisma Migrate, enums dupliqués, double `fn_next_ref` |
| 🟢 OK | — | Intégrité FK, soft delete, triggers métier, partitionnement audit |

**Verdict global** : base **fonnelle en dev** (550 lignes, seed cohérent), mais **non alignée** avec `prisma/schema.prisma` sur 2 colonnes status critiques, et **exposition Supabase Data API mal durcie** si jamais utilisée.

---

## 1. Inventaire

| Métrique | Valeur |
|----------|--------|
| Tables Prisma attendues | 33 |
| Tables réelles `public` | 46 (+ 13 partitions `audit_logs_*`) |
| Enums PostgreSQL | 27 (13 paires dupliquées PascalCase + `_t`) |
| Index | 140 |
| Contraintes CHECK | 64 |
| Triggers actifs | 23 |
| Fonctions métier `public` | 12+ |
| Vues | 4 |
| Lignes totales (hors `_prisma_*`) | ~550 |

### Volumétrie métier

| Table | Lignes |
|-------|--------|
| `reception_check_items` | 135 |
| `role_permissions` | 131 |
| `reception_check_catalog` | 27 |
| `vehicle_makes` | 20 |
| `customers` | 11 |
| `service_orders` | 6 |
| `vehicles` | 6 |
| `users` | 7 |
| `ot_status_history` | 42 |
| `audit_logs` (partition mai) | 42 |

---

## 2. Schéma — Drift Prisma vs base live

### 🔴 C1 — `ot_work_items.status` reste `TEXT` (attendu : enum `work_item_status_t`)

**Preuve** :
```sql
-- information_schema : data_type = 'text', udt_name = 'text'
-- CHECK obsolète :
CHECK (status = ANY (ARRAY['PENDING','IN_PROGRESS','DONE','CANCELLED']))
```

**Prisma attend** : enum `WorkItemStatus` → `COMPLETED` (pas `DONE`).

**Impact** : la migration `prisma/migrations/20260523_qc_multi_round_enums/migration.sql` **n'a pas été appliquée** sur Supabase. Risque d'insertion de valeurs invalides (`DONE`) et incohérence avec la vue `v_active_ot_dashboard` qui filtre sur `'COMPLETED'::work_item_status_t`.

**Correctif** :
```sql
-- Exécuter le contenu de prisma/migrations/20260523_qc_multi_round_enums/migration.sql
-- sur Supabase SQL Editor (sections 2 et 8 minimum)
```

---

### 🔴 C2 — `asp_purchases.status` reste `TEXT` (attendu : enum `asp_status_t`)

**Preuve** :
```sql
CHECK (status = ANY (ARRAY['PENDING','AUTHORIZED','ORDERED','RECEIVED','BILLED','CANCELLED']))
```

**Prisma attend** : `PENDING | AUTHORIZED | RECEIVED | ACCOUNTED | CANCELLED` (pas `ORDERED`, pas `BILLED`).

**Impact** : statuts métier divergents entre app et contraintes SQL. Insertion de `ACCOUNTED` **échouera** tant que le CHECK n'est pas mis à jour.

**Correctif** : même migration que C1, section 3 + drop du CHECK obsolète :
```sql
ALTER TABLE asp_purchases DROP CONSTRAINT IF EXISTS asp_purchases_status_check;
-- puis migration enum asp_status_t
```

---

### 🟡 I1 — Enums dupliqués (dette technique)

13 paires coexistent : `OTStatus` + `ot_status_t`, `UserStatus` + `user_status_t`, etc.  
Les labels correspondent ✅ sauf `AppointmentStatus` (PascalCase seul, pas de `_t`).

**Impact** : confusion migrations, casts explicites requis dans les vues SQL.

**Recommandation** : à terme, supprimer les enums PascalCase orphelins après vérification qu'aucune colonne ne les référence.

---

### 🟡 I2 — Aucune entrée dans `_prisma_migrations`

**Preuve** : `SELECT COUNT(*) FROM _prisma_migrations` → 0.

**Impact** : le schéma a été appliqué manuellement (`custom_schema.sql` + SQL Supabase). Impossible de savoir quelle version est déployée via `prisma migrate status`.

**Recommandation** :
```bash
# Après alignement du schéma :
npx prisma migrate resolve --applied 20260523_qc_multi_round_enums
# ou baseline initiale si première migration officielle
```

---

### 🟡 I3 — Double surcharge `fn_next_ref`

| Signature | Comportement |
|-----------|--------------|
| `(prefix text, seq_name text)` | `custom_schema.sql` — timezone serveur |
| `(p_prefix text, p_seq regclass)` | Production — timezone `Africa/Douala` |

**Impact** : deux chemins de génération de références selon quelle surcharge Postgres résout. Risque de comportement ambigu.

**Recommandation** : garder une seule version (celle avec `Africa/Douala` si c'est la règle métier CM), supprimer l'autre.

---

### 🟢 OK — Tables manquantes / soft delete

- Toutes les tables Prisma existent ✅
- `deleted_at` présent sur `users`, `customers`, `vehicles` uniquement ✅
- Partitionnement `audit_logs` (mensuel + overflow) — non modélisé Prisma mais fonctionnel ✅

---

## 3. Sécurité

### 🔴 S1 — RLS activé partout, **0 policy**, GRANTs larges sur Data API

| Élément | État |
|---------|------|
| RLS activé | 45/45 tables |
| Policies RLS | **0** |
| GRANT `SELECT` anon | **50 tables** |
| GRANT `SELECT` authenticated | **50 tables** |

**Comportement actuel** : avec RLS sans policy → **aucune ligne visible** via rôles `anon`/`authenticated` (deny by default). ✅ Accidentellement sûr pour PostgREST.

**Risque** : si une policy permissive est ajoutée par erreur (`USING (true)`), **toute la base** devient accessible via la clé `anon` publique. Les GRANTs complets (DELETE, TRUNCATE…) sont déjà en place.

**Correctif recommandé** (si NestJS seul accède à la DB) :
```sql
-- Option A : désactiver Data API dans Supabase Dashboard
-- Option B : révoquer l'accès public
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- Garder l'accès via rôle postgres / service_role pour NestJS uniquement
```

---

### 🔴 S2 — 4 vues sans `security_invoker = true`

| Vue | RLS bypass |
|-----|------------|
| `v_active_ot_dashboard` | Oui |
| `v_user_permissions` | Oui |
| `v_stock_status` | Oui |
| `v_pending_invoices` | Oui |

**Impact** : en Postgres 15+, les vues s'exécutent avec les droits du **créateur** (postgres), pas de l'appelant. Si exposées via Data API, elles **contournent RLS** et peuvent fuiter des données.

**Correctif** :
```sql
CREATE OR REPLACE VIEW v_active_ot_dashboard
WITH (security_invoker = true) AS
-- ... définition existante ...
;
-- Répéter pour les 3 autres vues
```

---

### 🟡 S3 — Fonction `rls_auto_enable` (SECURITY DEFINER)

Fonction Supabase interne — acceptable. Aucune autre fonction métier en `SECURITY DEFINER` ✅.

---

### 🟢 OK — Fonctions métier

Toutes les fonctions `fn_*` auditées sont `SECURITY INVOKER` ✅  
Pas de fuite `service_role` côté schéma SQL.

---

## 4. Intégrité des données

| Contrôle | Résultat |
|----------|----------|
| Véhicules → client supprimé | 0 orphelin ✅ |
| OT → client/véhicule supprimé | 0 ✅ |
| Stock `qty_available` négatif | 0 ✅ |
| Stock `qty_available ≠ in_stock - reserved` | 0 ✅ |
| Users supprimés encore ACTIVE | 0 ✅ |
| Paiements > total facture | 0 ✅ |
| Historique OT sans commande | 0 ✅ |
| Téléphones clients dupliqués (actifs) | **1 groupe (6 lignes seed)** 🟡 |

**Note seed** : 6 clients partagent `+237 699 123 456` — normal pour données de test, pas de contrainte UNIQUE sur `phone_primary`.

### Contraintes CHECK métier (échantillon positif)

- `chk_customer_identity` — INDIVIDUAL vs COMPANY ✅
- `chk_qty_reserved` — réservé ≤ stock ✅
- `payments_amount_xaf > 0` ✅
- `chk_work_completed` — dates cohérentes ✅

---

## 5. Performance

**Contexte** : base tiny (< 1 Mo), perf non critique aujourd'hui.

| Requête test | Plan | Coût |
|--------------|------|------|
| OT par status | Index Scan | 1.09 |
| Clients par téléphone | Index Scan | 12.12 |
| Pièces stock bas | Seq Scan | 12 (1 ligne — OK) |
| RBAC join | Nested Loop | 8.6 |

### 🟡 P1 — Index sur colonnes FK (45 FK sans index dédié détectés)

Non bloquant à 550 lignes. À planifier avant montée en charge :
```sql
-- Exemples prioritaires
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_make_id ON vehicles(make_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_model_id ON vehicles(model_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reception_checks_service_order_id ON reception_checks(service_order_id);
```

### 🟢 OK — Index métier existants

- `service_orders(status, opened_at)` ✅
- `parts_catalog(qty_available, min_threshold)` — alertes stock ✅
- Partition `audit_logs` indexés par mois ✅

---

## 6. Triggers & logique métier

23 triggers actifs, dont :

| Trigger | Rôle |
|---------|------|
| `trg_ot_status_history` | Historique transitions OT |
| `trg_stock_movement` | Mouvements stock atomiques |
| `trg_payment_invoice` | Recalcul facture après paiement |
| `trg_stock_alert` | Alerte stock bas |
| `trg_vehicle_immob` | Sync statut véhicule |
| `trg_*_updated_at` | Horodatage auto (16 tables) |

**Note** : `fn_trg_stock_consumption` sur `quote_lines` existe en SQL mais le trigger `trg_stock_consumption` de `custom_schema.sql` peut diverger de `fn_apply_stock_movement` en production — vérifier qu'un seul chemin est actif.

---

## 7. Configuration Prisma / Supabase

### 🟡 Config — Pooler vs direct

| URL | Port | Usage |
|-----|------|-------|
| `DATABASE_URL` | 6543 | Runtime app ✅ |
| `DIRECT_URL` | 5432 | Migrations / audit ✅ |

**Problème détecté** : `prisma migrate status` échoue sur le pooler 6543 (P1001 intermittent). Toujours utiliser `DIRECT_URL` pour migrate/introspect.

**Attention** : `src/.env` a `DIRECT_URL` avec `pgbouncer=true` sur port 6543 — **incorrect** si ce fichier est utilisé. Le `.env` racine est correct (5432).

---

## 8. Plan d'action priorisé

### Immédiat (avant prod)

1. **Appliquer** `prisma/migrations/20260523_qc_multi_round_enums/migration.sql` sur Supabase
2. **Dropper** les CHECK obsolètes `asp_purchases_status_check` et `ot_work_items_status_check`
3. **Recréer les 4 vues** avec `security_invoker = true`
4. **Révoquer** GRANTs `anon`/`authenticated` si Data API non utilisée

### Court terme

5. Baseline Prisma Migrate (`migrate resolve` ou `db pull` + baseline)
6. Unifier `fn_next_ref` (une seule surcharge, timezone Douala)
7. Documenter partitionnement `audit_logs` dans Prisma (commentaire ou `@ignore` sur partitions)

### Moyen terme

8. Index FK manquants (script généré depuis audit)
9. Nettoyage enums PascalCase dupliqués
10. Contrainte UNIQUE partielle sur `customers(phone_primary) WHERE deleted_at IS NULL` (si règle métier)

---

## 9. Commandes de re-audit

```bash
node scripts/db-audit.mjs          # audit rapide
node scripts/db-audit-full.mjs     # audit complet → db-audit-report.json
node scripts/db-audit-supplement.mjs  # drift status/vues
```

---

*Audit généré automatiquement — aucune modification n'a été apportée à la base de production.*
