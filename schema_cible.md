-- ============================================================
--  ATELIER-CM · Schéma PostgreSQL 16
--  CDC-ATEL-2026-001 — Gestion d'atelier, contexte Camerounais
--  Fuseau : Africa/Douala (WAT, UTC+1) — stockage UTC, affichage WAT
-- ============================================================
--
--  PRINCIPES APPLIQUÉS
--  ─────────────────────────────────────────────────────────
--  ACID  → mouvements de stock, paiements, changements de statut OT
--           → verrous FOR UPDATE, colonnes version, contraintes CHECK
--           → triggers transactionnels (même connexion, même COMMIT)
--
--  BASE  → audit_logs (partitionné, écriture async tolérée)
--           → sms_notifications (queue BullMQ, at-least-once delivery)
--           → vues matérialisées dashboard (rafraîchissement différé)
--           → alertes stock (consommées par worker, pas en temps réel)
--
--  RÉSILIENCE
--           → soft-delete (deleted_at) sur entités principales
--           → version (optimistic locking) sur OT, stock, factures
--           → token_version sur users (révocation JWT sans BDD sessions)
--           → historique d'états immuable (append-only) pour OT
--           → idempotency_key sur paiements (protection double-POST)
--           → qty_before/qty_after snapshot sur stock_movements
--
--  NORMALISATION (3FN)
--           → clés de référence dans des tables lookup (makes, models)
--           → aucune dépendance transitive dans les tables métier
--           → colonnes calculées (GENERATED ALWAYS … STORED) visibles
--
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID v4
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- recherche sans accents
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- recherche trigramme (LIKE rapide)
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- index GiST sur intervalles dates

-- On s'assure que l'extension est bien là dans le schéma public avant de créer la fonction
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS $$
    SELECT public.unaccent($1);
$$ LANGUAGE sql IMMUTABLE;

SET timezone = 'UTC';

-- ─────────────────────────────────────────────────────────────
-- 1. TYPES ENUM
-- ─────────────────────────────────────────────────────────────

CREATE TYPE user_status_t AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'DELETED'
);

CREATE TYPE vehicle_status_t AS ENUM (
  'IN_WORKSHOP',     -- présent atelier, OT actif
  'WAITING_PICKUP',  -- prêt, attend récupération
  'IMMOBILIZED',     -- garé — motif de vieillissement
  'DELIVERED'        -- rendu au client
);

CREATE TYPE immobilization_reason_t AS ENUM (
  'WAITING_CLIENT_APPROVAL',  -- devis à valider par le client
  'WAITING_PARTS',            -- pièces commandées, pas encore reçues
  'WAITING_PAYMENT',          -- facture impayée
  'WAITING_CLIENT_PICKUP',    -- travaux terminés, client doit récupérer
  'TECHNICAL_HOLD',           -- décision chef atelier / problème technique
  'OTHER'                     -- autre motif (préciser dans reason_detail)
);

CREATE TYPE ot_status_t AS ENUM (
  'DRAFT',           -- brouillon (avant réception formelle)
  'RECEIVED',        -- véhicule réceptionné, OT ouvert
  'DIAGNOSING',      -- diagnostic technicien en cours
  'QUOTE_PENDING',   -- devis émis, attente accord client
  'QUOTE_APPROVED',  -- client a validé le devis
  'IN_PROGRESS',     -- travaux en cours
  'QC_PENDING',      -- contrôle qualité en attente
  'QC_REJECTED',     -- CQ refusé — retour atelier
  'QC_DONE',         -- contrôle qualité validé
  'READY',           -- prêt à être rendu
  'INVOICED',        -- facturé
  'CLOSED',          -- clôturé et livré
  'CANCELLED'        -- annulé (motif obligatoire)
);

CREATE TYPE check_result_t AS ENUM (
  'OK',       -- conforme
  'WARNING',  -- à surveiller / noter
  'CRITICAL', -- problème grave (peut bloquer OT si is_blocking)
  'NA'        -- non applicable (ex : pas de roue de secours voiture de sport)
);

CREATE TYPE quote_status_t AS ENUM (
  'DRAFT',    -- en cours de rédaction
  'SENT',     -- envoyé/présenté au client
  'APPROVED', -- accepté par le client
  'REJECTED', -- refusé par le client
  'REVISED',  -- nouvelle version en cours
  'BILLED'    -- transformé en facture
);

CREATE TYPE invoice_status_t AS ENUM (
  'DRAFT',     -- brouillon
  'ISSUED',    -- émise, non payée
  'PARTIAL',   -- partiellement payée
  'PAID',      -- soldée
  'DISPUTED',  -- contestée
  'CANCELLED'  -- annulée (avoir)
);

CREATE TYPE payment_method_t AS ENUM (
  'CASH',
  'ORANGE_MONEY',
  'MTN_MOBILE_MONEY',
  'BANK_TRANSFER',
  'CHECK'
);

CREATE TYPE stock_movement_type_t AS ENUM (
  'PURCHASE',        -- entrée fournisseur (bon de livraison)
  'OT_CONSUMPTION',  -- sortie sur ordre de travail
  'ASP_PURCHASE',    -- achat sur place (entrée immédiate + sortie OT)
  'COUNTER_SALE',    -- vente comptoir hors OT
  'RETURN',          -- retour fournisseur ou retour client
  'ADJUSTMENT',      -- correction inventaire
  'TRANSFER'         -- transfert inter-emplacements
);

CREATE TYPE part_status_t AS ENUM (
  'PENDING',           -- à commander ou à vérifier
  'ASP_ORDERED',       -- achat sur place demandé
  'STOCK_RESERVED',    -- réservé depuis le stock existant
  'RECEIVED',          -- reçu (ASP livré ou commande reçue)
  'CONSUMED',          -- monté sur le véhicule
  'CANCELLED'          -- annulé
);

CREATE TYPE customer_type_t AS ENUM (
  'INDIVIDUAL',  -- particulier
  'COMPANY'      -- entreprise
);

CREATE TYPE sms_status_t AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED'
);

-- ─────────────────────────────────────────────────────────────
-- 2. SÉQUENCES & FONCTIONS UTILITAIRES
-- ─────────────────────────────────────────────────────────────

-- Séquences annuelles (non réinitialisées — règle TRX-006)
CREATE SEQUENCE IF NOT EXISTS seq_ot      START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_quote   START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_asp     START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_counter START 1 INCREMENT 1;

-- Génère une référence : "OT-2026-00042"
CREATE OR REPLACE FUNCTION fn_next_ref(p_prefix TEXT, p_seq regclass)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_prefix || '-' || to_char(now() AT TIME ZONE 'Africa/Douala', 'YYYY')
    || '-' || lpad(nextval(p_seq)::text, 5, '0');
END;
$$;

-- Trigger updated_at (réutilisable sur toutes les tables)
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. RBAC — Rôles, permissions, utilisateurs
-- ─────────────────────────────────────────────────────────────
-- ACID : toute modification de rôle/permission s'écrit dans un audit
-- RBAC traçable : user_roles inclut assigned_by, revoked_by, horodatages

CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT        NOT NULL UNIQUE,
  -- Valeurs : ADMIN | CHEF_ATELIER | CONSEILLER_SERVICE | TECHNICIEN | QC | CAISSIER
  label       TEXT        NOT NULL,
  description TEXT,
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE, -- rôles systèmes non supprimables
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN roles.is_system IS 'Si TRUE : suppression interdite (rôles prédéfinis CDC)';

CREATE TABLE permissions (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT    NOT NULL UNIQUE,   -- 'ot:create', 'invoice:validate' …
  module      TEXT    NOT NULL,          -- 'workshop','billing','stock','vehicles','admin'
  action      TEXT    NOT NULL,          -- 'create','read','update','delete','validate','export'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by    UUID,                                     -- user_id (NULL = init système)
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code   TEXT          UNIQUE,
  first_name      TEXT          NOT NULL,
  last_name       TEXT          NOT NULL,
  email           TEXT          UNIQUE,
  phone           TEXT,                     -- +237 6XX XX XX XX
  password_hash   TEXT          NOT NULL,
  status          user_status_t NOT NULL DEFAULT 'ACTIVE',
  -- JWT invalidation sans table de sessions (résilience)
  token_version   INT           NOT NULL DEFAULT 0,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ   -- soft-delete
);

-- Affectation de rôles — historique complet (RBAC traçable)
CREATE TABLE user_roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID        REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ,               -- NULL = actif
  revoked_by  UUID        REFERENCES users(id),
  revoke_reason TEXT,
  CONSTRAINT uq_user_role_active UNIQUE NULLS NOT DISTINCT (user_id, role_id, revoked_at)
  -- Garantit qu'un utilisateur n'a pas le même rôle actif deux fois
);

CREATE INDEX idx_user_roles_active ON user_roles (user_id, role_id)
  WHERE revoked_at IS NULL;

-- Vue runtime : rôles et permissions actifs d'un utilisateur
CREATE VIEW v_user_permissions AS
SELECT
  u.id          AS user_id,
  u.employee_code,
  u.first_name || ' ' || u.last_name AS full_name,
  r.code        AS role_code,
  r.label       AS role_label,
  p.code        AS permission_code,
  p.module,
  p.action
FROM users u
JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
JOIN roles r       ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE';

-- ─────────────────────────────────────────────────────────────
-- 4. AUDIT LOG GLOBAL
-- BASE : écriture async tolérée (worker insère via queue)
-- ACID : les snapshots before/after sont écrits en même transaction
-- Partitionné par mois pour performance sur tables volumineuses
-- ─────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            UUID        NOT NULL DEFAULT uuid_generate_v4(),
  entity_type   TEXT        NOT NULL,   -- 'service_order','invoice','stock_movement'…
  entity_id     UUID        NOT NULL,
  action        TEXT        NOT NULL,   -- 'CREATE','UPDATE','DELETE','STATUS_CHANGE','STOCK_ALERT'
  field_changes JSONB,
  -- Ex : { "status": {"from":"DRAFT","to":"RECEIVED"}, "mileage_in": {"from":null,"to":45231} }
  performed_by  UUID        REFERENCES users(id),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB        -- contexte additionnel libre
) PARTITION BY RANGE (performed_at);

-- Partitions 2026 — à étendre via worker scheduler chaque mois
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_2026_08 PARTITION OF audit_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_logs_2026_11 PARTITION OF audit_logs FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_logs_2026_12 PARTITION OF audit_logs FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
-- Partition attrape-tout (pour les insertions hors plage)
CREATE TABLE audit_logs_overflow PARTITION OF audit_logs DEFAULT;

CREATE INDEX idx_audit_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor      ON audit_logs (performed_by, performed_at DESC);
CREATE INDEX idx_audit_date       ON audit_logs (performed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. CLIENTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_type    customer_type_t  NOT NULL DEFAULT 'INDIVIDUAL',
  -- Individu
  first_name       TEXT,
  last_name        TEXT,
  -- Entreprise
  company_name     TEXT,
  rccm             TEXT,   -- Registre du Commerce et du Crédit Mobilier
  niu              TEXT,   -- Numéro Identifiant Unique (fiscal camerounais)
  -- Contact
  phone_primary    TEXT    NOT NULL,   -- +237 6XX XX XX XX
  phone_secondary  TEXT,
  email            TEXT,
  address          TEXT,
  city             TEXT    NOT NULL DEFAULT 'Douala',
  lang             TEXT    NOT NULL DEFAULT 'fr'    -- 'fr' | 'en'
    CHECK (lang IN ('fr','en')),
  -- Relation commerciale
  is_vip           BOOLEAN NOT NULL DEFAULT FALSE,
  credit_limit_xaf NUMERIC(15,2)    DEFAULT 0,
  notes            TEXT,
  -- Intégrité
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT chk_customer_identity CHECK (
    (customer_type = 'INDIVIDUAL' AND first_name IS NOT NULL AND last_name IS NOT NULL)
    OR
    (customer_type = 'COMPANY'    AND company_name IS NOT NULL)
  )
);

COMMENT ON COLUMN customers.niu IS 'Numéro Identifiant Unique fiscal camerounais — obligatoire sur factures entreprises';

CREATE INDEX idx_customers_phone   ON customers (phone_primary);
CREATE INDEX idx_customers_name_fr ON customers USING GIN (
  to_tsvector('simple', immutable_unaccent(coalesce(last_name,'') || ' ' || coalesce(first_name,'') || ' ' || coalesce(company_name,'')))
);

-- ─────────────────────────────────────────────────────────────
-- 6. RÉFÉRENTIELS VÉHICULES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE vehicle_makes (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE   -- Toyota, Nissan, Mercedes-Benz …
);

CREATE TABLE vehicle_models (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make_id UUID NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (make_id, name)
);

-- ─────────────────────────────────────────────────────────────
-- 7. VÉHICULES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID              NOT NULL REFERENCES customers(id),
  -- Identification
  plate_number    TEXT              NOT NULL,
  -- Format actuel : XX-AAAA-Z (ex: LT-1234-A) ; ancienne série : YA 1234 B
  plate_format    TEXT              NOT NULL DEFAULT 'NEW'
    CHECK (plate_format IN ('NEW','OLD','FOREIGN')),
  vin             TEXT              UNIQUE,      -- numéro de châssis
  make_id         UUID              REFERENCES vehicle_makes(id),
  model_id        UUID              REFERENCES vehicle_models(id),
  year            SMALLINT          CHECK (year BETWEEN 1960 AND 2030),
  color           TEXT,
  fuel_type       TEXT              CHECK (fuel_type IN ('PETROL','DIESEL','HYBRID','ELECTRIC','LPG','OTHER')),
  engine_code     TEXT,
  engine_cc       INT,              -- cylindrée cm³
  transmission    TEXT              CHECK (transmission IN ('MANUAL','AUTO','CVT','OTHER')),
  -- État courant
  status          vehicle_status_t  NOT NULL DEFAULT 'DELIVERED',
  current_mileage INT               CHECK (current_mileage >= 0),
  last_service_at DATE,
  -- Métadonnées
  notes           TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_plate_not_empty CHECK (trim(plate_number) <> '')
);

-- Unicité plaque (insensible à la casse, hors suppressions)
CREATE UNIQUE INDEX uq_vehicles_plate_active
  ON vehicles (lower(regexp_replace(plate_number, '\s+', '', 'g')))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_vehicles_customer ON vehicles (customer_id);
CREATE INDEX idx_vehicles_status   ON vehicles (status);

-- ─────────────────────────────────────────────────────────────
-- 8. IMMOBILISATION VÉHICULE — MOTIF DE VIEILLISSEMENT
-- Trace pourquoi et depuis quand un véhicule est garé dans l'atelier
-- Alertes automatiques à 24h, 72h, 7 jours (worker scheduler)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE vehicle_immobilizations (
  id                UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id        UUID                  NOT NULL REFERENCES vehicles(id),
  service_order_id  UUID,                 -- FK ajoutée après création service_orders
  reason            immobilization_reason_t NOT NULL,
  reason_detail     TEXT,                 -- précision libre obligatoire si reason='OTHER'
  -- Durée
  immobilized_at    TIMESTAMPTZ           NOT NULL DEFAULT now(),
  immobilized_by    UUID                  NOT NULL REFERENCES users(id),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID                  REFERENCES users(id),
  resolution_note   TEXT,
  -- Alertes déjà envoyées (évite les doublons, BASE)
  alert_sent_24h    BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sent_72h    BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sent_7d     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_other_reason CHECK (
    reason <> 'OTHER' OR (reason_detail IS NOT NULL AND trim(reason_detail) <> '')
  ),
  CONSTRAINT chk_resolved_after_immob CHECK (
    resolved_at IS NULL OR resolved_at >= immobilized_at
  )
);

COMMENT ON TABLE vehicle_immobilizations IS
  'Motif de vieillissement : trace chaque période d''immobilisation avec son motif. '
  'Résoudre = mettre resolved_at + mettre vehicles.status à DELIVERED ou IN_WORKSHOP.';

CREATE INDEX idx_immob_open      ON vehicle_immobilizations (vehicle_id)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_immob_alerts    ON vehicle_immobilizations (immobilized_at)
  WHERE resolved_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 9. CATALOGUE 27 POINTS DE CONTRÔLE À LA RÉCEPTION
-- Paramétrable par l'admin (ajout/désactivation de points)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE reception_check_catalog (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT    NOT NULL UNIQUE,   -- 'EXT_01', 'ENG_03', 'INT_06', 'DOC_02'
  category    TEXT    NOT NULL           -- 'EXTERIEUR','SOUS_CAPOT','INTERIEUR','DOCUMENTS'
    CHECK (category IN ('EXTERIEUR','SOUS_CAPOT','INTERIEUR','DOCUMENTS')),
  sort_order  SMALLINT NOT NULL,         -- 1..27 (ordre d'affichage)
  label_fr    TEXT    NOT NULL,
  label_en    TEXT    NOT NULL,
  help_text   TEXT,                      -- consigne pour le Conseiller Service
  -- Si result=CRITICAL et is_blocking=TRUE → bloque ouverture OT
  is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 10. ORDRES DE TRAVAIL (OT)
-- Machine d'état tracée via ot_status_history (append-only)
-- Version optimiste pour éviter les conflits d'édition simultanée
-- ─────────────────────────────────────────────────────────────

CREATE TABLE service_orders (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference           TEXT         NOT NULL UNIQUE
                                   DEFAULT fn_next_ref('OT', 'seq_ot'),
  vehicle_id          UUID         NOT NULL REFERENCES vehicles(id),
  customer_id         UUID         NOT NULL REFERENCES customers(id),
  -- Équipe
  opened_by           UUID         NOT NULL REFERENCES users(id),   -- Conseiller Service
  assigned_chef       UUID         REFERENCES users(id),             -- Chef Atelier
  -- Machine d'état
  status              ot_status_t  NOT NULL DEFAULT 'DRAFT',
  -- Motif client (déclaré à la réception)
  client_complaint    TEXT         NOT NULL,
  priority            TEXT         NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('URGENT','HIGH','NORMAL','LOW')),
  -- Kilométrage
  mileage_in          INT          CHECK (mileage_in >= 0),
  mileage_out         INT          CHECK (mileage_out >= 0),
  -- Dates clés
  opened_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  promised_at         TIMESTAMPTZ,                                    -- livraison promise au client
  estimated_ready_at  TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,                                    -- calculé auto (trigger)
  -- Annulation
  cancellation_reason TEXT,
  -- Notes internes
  internal_notes      TEXT,
  -- Optimistic locking (ACID — détection conflits d'édition)
  version             INT          NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_ot_closed_after_open CHECK (
    closed_at IS NULL OR closed_at >= opened_at
  ),
  CONSTRAINT chk_ot_cancel_reason CHECK (
    status <> 'CANCELLED' OR (cancellation_reason IS NOT NULL AND trim(cancellation_reason) <> '')
  ),
  CONSTRAINT chk_ot_mileage_out CHECK (
    mileage_out IS NULL OR mileage_in IS NULL OR mileage_out >= mileage_in
  )
);

COMMENT ON COLUMN service_orders.version IS
  'Optimistic locking : incrémenter à chaque UPDATE, rejeter si version ≠ valeur lue.';

CREATE INDEX idx_ot_vehicle   ON service_orders (vehicle_id, status);
CREATE INDEX idx_ot_customer  ON service_orders (customer_id);
CREATE INDEX idx_ot_status    ON service_orders (status, opened_at DESC);
CREATE INDEX idx_ot_chef      ON service_orders (assigned_chef)
  WHERE status NOT IN ('CLOSED','CANCELLED');
CREATE INDEX idx_ot_open_by   ON service_orders (opened_by);

-- Historique immuable des transitions de statut (append-only, BASE)
CREATE TABLE ot_status_history (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID        NOT NULL REFERENCES service_orders(id),
  from_status      ot_status_t,                    -- NULL pour la création
  to_status        ot_status_t NOT NULL,
  changed_by       UUID        NOT NULL REFERENCES users(id),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason           TEXT,
  metadata         JSONB
);

CREATE INDEX idx_ot_hist_ot   ON ot_status_history (service_order_id, changed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 11. FICHE RÉCEPTION (27 POINTS)
-- Créée par le Conseiller Service lors de l'ouverture de l'OT
-- Signature client = flag + horodatage + méthode (physique/digital)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE reception_checks (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id      UUID        NOT NULL REFERENCES service_orders(id),
  -- Qui a fait la réception
  checked_by            UUID        NOT NULL REFERENCES users(id),
  checked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Signature client (ACID : flag + horodatage dans même transaction)
  client_approved       BOOLEAN     NOT NULL DEFAULT FALSE,
  client_approved_at    TIMESTAMPTZ,
  client_approval_method TEXT                -- 'PHYSICAL','DIGITAL','VERBAL_NOTED'
    CHECK (client_approval_method IN ('PHYSICAL','DIGITAL','VERBAL_NOTED')),
  client_signature_ref  TEXT,               -- UUID upload (signature numérique ou scan)
  -- État véhicule à l'entrée
  mileage_at_reception  INT         NOT NULL CHECK (mileage_at_reception >= 0),
  fuel_level            SMALLINT    CHECK (fuel_level BETWEEN 0 AND 8),
  -- 0=vide  2=1/4  4=1/2  6=3/4  8=plein
  inventory_items       TEXT[],             -- ['manteau gris','chargeur iPhone','carte grise']
  global_notes          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sig_method CHECK (
    NOT client_approved OR client_approval_method IS NOT NULL
  ),
  CONSTRAINT chk_sig_date CHECK (
    NOT client_approved OR client_approved_at IS NOT NULL
  )
);

COMMENT ON COLUMN reception_checks.client_approved IS
  'TRUE = le client a vu et approuvé le PV réception. '
  'Obligation réglementaire avant début des travaux (CDC ORD-001).';

-- Résultats point par point
CREATE TABLE reception_check_items (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  reception_check_id  UUID            NOT NULL REFERENCES reception_checks(id) ON DELETE CASCADE,
  catalog_id          UUID            NOT NULL REFERENCES reception_check_catalog(id),
  result              check_result_t  NOT NULL DEFAULT 'NA',
  note                TEXT,           -- observation libre du Conseiller Service
  photo_refs          TEXT[],         -- UUIDs des photos uploadées (dégâts constatés)
  checked_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (reception_check_id, catalog_id)
);

CREATE INDEX idx_rci_check    ON reception_check_items (reception_check_id);
CREATE INDEX idx_rci_critical ON reception_check_items (reception_check_id, result)
  WHERE result = 'CRITICAL';

-- ─────────────────────────────────────────────────────────────
-- 12. OBSERVATIONS TECHNICIEN
-- Problèmes détectés par le technicien APRÈS réception
-- → include_in_quote=TRUE : remonteront automatiquement dans le devis
-- → quoted_at : horodatage de l'intégration dans le devis
-- ─────────────────────────────────────────────────────────────

CREATE TABLE technician_observations (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID    NOT NULL REFERENCES service_orders(id),
  observed_by      UUID    NOT NULL REFERENCES users(id),
  observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Classification
  category         TEXT    NOT NULL DEFAULT 'AUTRE'
    CHECK (category IN ('MECANIQUE','CARROSSERIE','ELECTRIQUE','PNEUMATIQUE',
                        'CLIMATISATION','TRANSMISSION','SUSPENSION','AUTRE')),
  description      TEXT    NOT NULL,
  severity         TEXT    NOT NULL DEFAULT 'INFO'
    CHECK (severity IN ('INFO','WARNING','URGENT')),
  -- Intégration automatique dans le devis
  include_in_quote BOOLEAN NOT NULL DEFAULT TRUE,
  quoted_at        TIMESTAMPTZ,        -- NULL = pas encore intégré au devis
  -- Preuve photo
  photo_refs       TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE technician_observations IS
  'Observations supplémentaires ajoutées par le technicien pendant le diagnostic. '
  'Si include_in_quote=TRUE, elles apparaissent automatiquement dans le prochain devis de cet OT.';

CREATE INDEX idx_obs_ot         ON technician_observations (service_order_id);
CREATE INDEX idx_obs_unquoted   ON technician_observations (service_order_id)
  WHERE include_in_quote = TRUE AND quoted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 13. CATALOGUE MAIN D'ŒUVRE
-- ─────────────────────────────────────────────────────────────

CREATE TABLE labor_catalog (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             TEXT    NOT NULL UNIQUE,
  category         TEXT    NOT NULL,   -- 'VIDANGE','FREINAGE','SUSPENSION','ELECTRICITE'…
  description_fr   TEXT    NOT NULL,
  description_en   TEXT,
  standard_hours   NUMERIC(5,2),       -- temps standard (barème constructeur)
  unit_price_xaf   NUMERIC(15,2) NOT NULL CHECK (unit_price_xaf >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 14. TRAVAUX (lignes de l'OT)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE ot_work_items (
  id                    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id      UUID    NOT NULL REFERENCES service_orders(id),
  labor_catalog_id      UUID    REFERENCES labor_catalog(id),
  custom_description    TEXT,           -- si travail hors catalogue
  -- Affectation
  assigned_technician   UUID    REFERENCES users(id),
  -- Temps
  estimated_hours       NUMERIC(5,2),
  actual_hours          NUMERIC(5,2),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  -- Prix
  unit_price_xaf        NUMERIC(15,2) NOT NULL CHECK (unit_price_xaf >= 0),
  quantity              NUMERIC(8,2)  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  discount_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0
    CHECK (discount_pct BETWEEN 0 AND 100),
  -- Statut
  status                TEXT          NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','IN_PROGRESS','DONE','CANCELLED')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_work_has_desc CHECK (
    labor_catalog_id IS NOT NULL OR (custom_description IS NOT NULL AND trim(custom_description) <> '')
  ),
  CONSTRAINT chk_work_completed CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  )
);

CREATE INDEX idx_work_ot   ON ot_work_items (service_order_id, status);
CREATE INDEX idx_work_tech ON ot_work_items (assigned_technician)
  WHERE status = 'IN_PROGRESS';

-- ─────────────────────────────────────────────────────────────
-- 15. CONTRÔLE QUALITÉ
-- Effectué par le Contrôleur Qualité avant READY
-- Si rejeté : OT repasse IN_PROGRESS + note de retour
-- ─────────────────────────────────────────────────────────────

CREATE TABLE quality_controls (
  id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id            UUID            NOT NULL UNIQUE REFERENCES service_orders(id),
  performed_by                UUID            NOT NULL REFERENCES users(id),
  performed_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),
  -- Résultat global
  overall_result              check_result_t  NOT NULL,
  -- Points de contrôle CQ (liste libre, configurable)
  checklist                   JSONB           NOT NULL DEFAULT '[]',
  -- Ex : [{"point":"Niveaux revérifiés","result":"OK"},{"point":"Propreté véhicule","result":"OK"}]
  -- Décision
  is_approved                 BOOLEAN,        -- NULL=en attente
  approved_at                 TIMESTAMPTZ,
  rejection_reason            TEXT,
  -- Retour atelier si rejeté
  returned_to_workshop_at     TIMESTAMPTZ,
  return_notes                TEXT,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT chk_qc_rejected_reason CHECK (
    is_approved IS NULL OR is_approved = TRUE OR
    (is_approved = FALSE AND rejection_reason IS NOT NULL AND trim(rejection_reason) <> '')
  )
);

COMMENT ON COLUMN quality_controls.checklist IS
  'Points de contrôle qualité au format JSONB. '
  'Configurable par le Chef Atelier sans migration de schéma.';

-- ─────────────────────────────────────────────────────────────
-- 16. FOURNISSEURS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  city          TEXT    DEFAULT 'Douala',
  payment_terms TEXT    DEFAULT 'CASH'
    CHECK (payment_terms IN ('CASH','15D','30D','60D','90D')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 17. CATALOGUE PIÈCES & STOCK
-- Quantités protégées par trigger ACID (verrou FOR UPDATE)
-- Colonne qty_available = GENERATED : visible sans jointure
-- ─────────────────────────────────────────────────────────────

CREATE TABLE parts_catalog (
  id                    UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference             TEXT    NOT NULL UNIQUE,   -- référence interne
  oem_reference         TEXT,                       -- référence constructeur
  barcode               TEXT    UNIQUE,
  name_fr               TEXT    NOT NULL,
  name_en               TEXT,
  category              TEXT    NOT NULL,
  -- Unité : PCS, L, KG, M
  unit                  TEXT    NOT NULL DEFAULT 'PCS',
  -- Prix
  purchase_price_xaf    NUMERIC(15,2),
  sale_price_xaf        NUMERIC(15,2) NOT NULL CHECK (sale_price_xaf >= 0),
  -- Stock (ACID via trigger fn_apply_stock_movement)
  qty_in_stock          NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (qty_in_stock >= 0),
  qty_reserved          NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  qty_available         NUMERIC(10,3) GENERATED ALWAYS AS (qty_in_stock - qty_reserved) STORED,
  min_threshold         NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (min_threshold >= 0),
  max_threshold         NUMERIC(10,3),
  -- Localisation
  storage_location      TEXT,   -- 'RAYON-A1', 'ETAGERE-B3'
  preferred_supplier_id UUID    REFERENCES suppliers(id),
  -- Compatibilité
  compatible_makes      TEXT[], -- ['TOYOTA','NISSAN','RENAULT']
  -- État
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_consumable         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Optimistic locking (ACID)
  version               INT     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_max_threshold CHECK (
    max_threshold IS NULL OR max_threshold >= min_threshold
  ),
  CONSTRAINT chk_qty_reserved CHECK (qty_reserved <= qty_in_stock)
);

CREATE INDEX idx_parts_ref_lower   ON parts_catalog (lower(reference));
CREATE INDEX idx_parts_oem_lower   ON parts_catalog (lower(oem_reference)) WHERE oem_reference IS NOT NULL;
CREATE INDEX idx_parts_name_trgm   ON parts_catalog USING GIN (name_fr gin_trgm_ops);
CREATE INDEX idx_parts_category    ON parts_catalog (category) WHERE is_active = TRUE;
CREATE INDEX idx_parts_low_stock   ON parts_catalog (qty_available, min_threshold)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 18. MOUVEMENTS DE STOCK (append-only — jamais UPDATE ni DELETE)
-- ACID : trigger fn_apply_stock_movement avec FOR UPDATE
-- Snapshot qty_before/qty_after dans chaque ligne
-- ─────────────────────────────────────────────────────────────

CREATE TABLE stock_movements (
  id               UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id          UUID                    NOT NULL REFERENCES parts_catalog(id),
  movement_type    stock_movement_type_t   NOT NULL,
  -- positif = entrée, négatif = sortie
  quantity         NUMERIC(10,3)           NOT NULL CHECK (quantity <> 0),
  unit_price_xaf   NUMERIC(15,2),
  -- Contextes (FK partielles — une seule active selon le type)
  service_order_id UUID,                   -- FK ajoutée après
  quote_line_id    UUID,                   -- FK ajoutée après
  asp_id           UUID,                   -- FK ajoutée après
  counter_sale_id  UUID,                   -- FK ajoutée après
  supplier_id      UUID                    REFERENCES suppliers(id),
  -- Traçabilité
  performed_by     UUID                    NOT NULL REFERENCES users(id),
  performed_at     TIMESTAMPTZ             NOT NULL DEFAULT now(),
  -- Snapshot ACID (rempli par trigger, non modifiable après)
  qty_before       NUMERIC(10,3)           NOT NULL,
  qty_after        NUMERIC(10,3)           NOT NULL CHECK (qty_after >= 0),
  -- Document source
  reference_doc    TEXT,
  notes            TEXT
);

COMMENT ON TABLE stock_movements IS
  'Table append-only. Jamais d''UPDATE ni de DELETE. '
  'Corriger via une ligne d''ADJUSTMENT avec justification. '
  'qty_before/qty_after sont snapshots ACID écrits par trigger.';

CREATE INDEX idx_sm_part      ON stock_movements (part_id, performed_at DESC);
CREATE INDEX idx_sm_ot        ON stock_movements (service_order_id) WHERE service_order_id IS NOT NULL;
CREATE INDEX idx_sm_date      ON stock_movements (performed_at DESC);
CREATE INDEX idx_sm_type      ON stock_movements (movement_type, performed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 19. DEVIS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE quotes (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference        TEXT           NOT NULL UNIQUE
                                  DEFAULT fn_next_ref('DEV', 'seq_quote'),
  service_order_id UUID           NOT NULL REFERENCES service_orders(id),
  customer_id      UUID           NOT NULL REFERENCES customers(id),
  status           quote_status_t NOT NULL DEFAULT 'DRAFT',
  -- Montants (calcul dans l'application, cohérence assurée par contrainte)
  subtotal_xaf     NUMERIC(15,2)  NOT NULL DEFAULT 0 CHECK (subtotal_xaf >= 0),
  tax_rate         NUMERIC(5,4)   NOT NULL DEFAULT 0.1925,  -- TVA 19,25%
  tax_amount_xaf   NUMERIC(15,2)  NOT NULL DEFAULT 0,
  -- Timbre fiscal : 1 000 XAF si total > 20 000 XAF (FAC-006 CDC)
  stamp_duty_xaf   NUMERIC(15,2)  NOT NULL DEFAULT 0,
  total_xaf        NUMERIC(15,2)  NOT NULL DEFAULT 0,
  -- Validité
  valid_until      DATE,
  -- Approbation client (ACID)
  approved_by_client_at TIMESTAMPTZ,
  client_signature_ref  TEXT,
  client_approval_method TEXT
    CHECK (client_approval_method IN ('PHYSICAL','DIGITAL','VERBAL_NOTED')),
  -- Workflow
  created_by       UUID           NOT NULL REFERENCES users(id),
  sent_at          TIMESTAMPTZ,
  revised_count    SMALLINT       NOT NULL DEFAULT 0,
  -- Optimistic lock
  version          INT            NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_ot     ON quotes (service_order_id, status);
CREATE INDEX idx_quotes_status ON quotes (status, created_at DESC);

CREATE TABLE quote_lines (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id         UUID          NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_type        TEXT          NOT NULL
    CHECK (line_type IN ('LABOR','PART','ASP','OTHER')),
  -- Références
  labor_catalog_id UUID          REFERENCES labor_catalog(id),
  part_id          UUID          REFERENCES parts_catalog(id),
  description      TEXT,                 -- si ni labor ni part
  -- Chiffrage
  quantity         NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_xaf   NUMERIC(15,2) NOT NULL CHECK (unit_price_xaf >= 0),
  discount_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0
    CHECK (discount_pct BETWEEN 0 AND 100),
  line_total_xaf   NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price_xaf * (1 - discount_pct / 100.0)
  ) STORED,
  -- Origine : observation technicien qui a déclenché cette ligne
  observation_id   UUID          REFERENCES technician_observations(id),
  -- Statut de la pièce
  part_status      part_status_t,
  sort_order       SMALLINT      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_quote_line_ref CHECK (
    labor_catalog_id IS NOT NULL
    OR part_id IS NOT NULL
    OR (description IS NOT NULL AND trim(description) <> '')
  )
);

CREATE INDEX idx_quote_lines_quote ON quote_lines (quote_id);

-- ─────────────────────────────────────────────────────────────
-- 20. ACHAT SUR PLACE (ASP)
-- Pièce nécessaire à l'OT, non en stock, achetée en boutique externe
-- Autorisé par Admin ou Chef Atelier (asp:authorize)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE asp_purchases (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference           TEXT    NOT NULL UNIQUE
                              DEFAULT fn_next_ref('ASP', 'seq_asp'),
  service_order_id    UUID    NOT NULL,   -- FK ajoutée après
  quote_line_id       UUID,               -- ligne devis associée
  -- Pièce (peut être hors catalogue si référence inconnue)
  part_id             UUID    REFERENCES parts_catalog(id),
  part_description    TEXT    NOT NULL,
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- Fournisseur externe (boutique locale)
  supplier_name       TEXT    NOT NULL,
  supplier_address    TEXT,
  -- Coûts
  purchase_price_xaf  NUMERIC(15,2) NOT NULL CHECK (purchase_price_xaf >= 0),
  sale_price_xaf      NUMERIC(15,2) NOT NULL CHECK (sale_price_xaf >= 0),
  -- Statut
  status              TEXT    NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','AUTHORIZED','ORDERED','RECEIVED','BILLED','CANCELLED')),
  -- Pièces justificatives
  ordered_at          TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  receipt_ref         TEXT,   -- numéro reçu boutique
  receipt_photo_ref   TEXT,   -- UUID upload de la photo du reçu
  -- Autorisation (ACID : double contrôle)
  authorized_by       UUID    REFERENCES users(id),
  authorized_at       TIMESTAMPTZ,
  -- Passage en écriture comptable
  accounted_by        UUID    REFERENCES users(id),
  accounted_at        TIMESTAMPTZ,
  notes               TEXT,
  created_by          UUID    NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_asp_authorized CHECK (
    status NOT IN ('AUTHORIZED','ORDERED','RECEIVED','BILLED')
    OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL)
  )
);

COMMENT ON TABLE asp_purchases IS
  'Achat Sur Place : pièce achetée dans une boutique externe pour un OT urgent. '
  'Nécessite autorisation Admin ou Chef Atelier. '
  'Passage en écriture comptable (accounted_by) obligatoire avant facturation.';

CREATE INDEX idx_asp_ot     ON asp_purchases (service_order_id);
CREATE INDEX idx_asp_status ON asp_purchases (status) WHERE status NOT IN ('BILLED','CANCELLED');

-- ─────────────────────────────────────────────────────────────
-- 21. FACTURES & PAIEMENTS
-- ACID : trigger fn_invoice_auto_paid met à jour statut + paid_at
-- Idempotency key sur payments (protection double-POST)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference        TEXT             NOT NULL UNIQUE
                                    DEFAULT fn_next_ref('FAC', 'seq_invoice'),
  service_order_id UUID             REFERENCES service_orders(id),
  quote_id         UUID             REFERENCES quotes(id),
  customer_id      UUID             NOT NULL REFERENCES customers(id),
  status           invoice_status_t NOT NULL DEFAULT 'DRAFT',
  -- Montants (structure identique devis pour cohérence)
  subtotal_xaf     NUMERIC(15,2)    NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,4)     NOT NULL DEFAULT 0.1925,
  tax_amount_xaf   NUMERIC(15,2)    NOT NULL DEFAULT 0,
  stamp_duty_xaf   NUMERIC(15,2)    NOT NULL DEFAULT 0,
  total_xaf        NUMERIC(15,2)    NOT NULL DEFAULT 0,
  amount_paid_xaf  NUMERIC(15,2)    NOT NULL DEFAULT 0,
  balance_xaf      NUMERIC(15,2)    GENERATED ALWAYS AS (total_xaf - amount_paid_xaf) STORED,
  -- Dates
  issued_at        TIMESTAMPTZ,
  due_date         DATE,
  paid_at          TIMESTAMPTZ,          -- calculé auto par trigger
  -- Relances impayées (BASE : cron scheduler)
  reminder_1_sent_at TIMESTAMPTZ,        -- J+7
  reminder_2_sent_at TIMESTAMPTZ,        -- J+15
  -- Infos fiscales Cameroun
  niu_client       TEXT,                 -- NIU client si entreprise
  rccm_client      TEXT,                 -- RCCM client si entreprise
  -- Avoir / note de crédit
  credit_note_for  UUID             REFERENCES invoices(id),  -- facture d'origine
  credit_note_reason TEXT,
  -- Workflow
  created_by       UUID             NOT NULL REFERENCES users(id),
  validated_by     UUID             REFERENCES users(id),   -- Chef Atelier ou Admin
  -- Optimistic lock
  version          INT              NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT chk_invoice_credit_reason CHECK (
    credit_note_for IS NULL OR
    (credit_note_reason IS NOT NULL AND trim(credit_note_reason) <> '')
  )
);

CREATE INDEX idx_invoices_ot       ON invoices (service_order_id);
CREATE INDEX idx_invoices_customer ON invoices (customer_id, status);
-- Index pour le cron de relances impayées
CREATE INDEX idx_invoices_unpaid   ON invoices (due_date, status)
  WHERE status IN ('ISSUED','PARTIAL');

CREATE TABLE invoice_lines (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID    NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_type      TEXT    NOT NULL
    CHECK (line_type IN ('LABOR','PART','ASP','COUNTER','OTHER')),
  description    TEXT    NOT NULL,
  quantity       NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_xaf NUMERIC(15,2) NOT NULL CHECK (unit_price_xaf >= 0),
  discount_pct   NUMERIC(5,2)  NOT NULL DEFAULT 0
    CHECK (discount_pct BETWEEN 0 AND 100),
  line_total_xaf NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price_xaf * (1 - discount_pct / 100.0)
  ) STORED,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_lines ON invoice_lines (invoice_id);

CREATE TABLE payments (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id       UUID              NOT NULL REFERENCES invoices(id),
  method           payment_method_t  NOT NULL,
  amount_xaf       NUMERIC(15,2)     NOT NULL CHECK (amount_xaf > 0),
  -- Référence opérateur (Mobile Money)
  transaction_ref  TEXT,
  operator         TEXT,             -- 'ORANGE_CM', 'MTN_CM', 'CAMTEL'
  -- Idempotence (ACID — protection double-POST)
  idempotency_key  TEXT              UNIQUE,
  -- Statut
  status           TEXT              NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('PENDING','CONFIRMED','FAILED','REFUNDED')),
  paid_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
  recorded_by      UUID              NOT NULL REFERENCES users(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON COLUMN payments.idempotency_key IS
  'Clé unique générée côté client. Empêche l''enregistrement double en cas de retry réseau.';

CREATE INDEX idx_payments_invoice ON payments (invoice_id, status);

-- ─────────────────────────────────────────────────────────────
-- 22. VENTE COMPTOIR (hors OT)
-- Achat de pièces par un particulier ou une entreprise directement au comptoir
-- ─────────────────────────────────────────────────────────────

CREATE TABLE counter_sales (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference       TEXT              NOT NULL UNIQUE
                                    DEFAULT fn_next_ref('VCC', 'seq_counter'),
  -- Client enregistré ou client de passage
  customer_id     UUID              REFERENCES customers(id),
  walk_in_name    TEXT,
  walk_in_phone   TEXT,
  -- Montants
  subtotal_xaf    NUMERIC(15,2)     NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4)      NOT NULL DEFAULT 0.1925,
  tax_amount_xaf  NUMERIC(15,2)     NOT NULL DEFAULT 0,
  stamp_duty_xaf  NUMERIC(15,2)     NOT NULL DEFAULT 0,
  total_xaf       NUMERIC(15,2)     NOT NULL DEFAULT 0,
  -- Paiement (immédiat à la vente)
  payment_method  payment_method_t  NOT NULL DEFAULT 'CASH',
  payment_ref     TEXT,
  paid_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  -- Workflow
  sold_by         UUID              NOT NULL REFERENCES users(id),
  validated_by    UUID              REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  CONSTRAINT chk_counter_customer CHECK (
    customer_id IS NOT NULL OR (walk_in_name IS NOT NULL AND trim(walk_in_name) <> '')
  )
);

CREATE TABLE counter_sale_lines (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  counter_sale_id UUID    NOT NULL REFERENCES counter_sales(id) ON DELETE CASCADE,
  part_id         UUID    NOT NULL REFERENCES parts_catalog(id),
  quantity        NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit_price_xaf  NUMERIC(15,2) NOT NULL CHECK (unit_price_xaf >= 0),
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0
    CHECK (discount_pct BETWEEN 0 AND 100),
  line_total_xaf  NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price_xaf * (1 - discount_pct / 100.0)
  ) STORED,
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_counter_sales_date ON counter_sales (created_at DESC);
CREATE INDEX idx_counter_lines      ON counter_sale_lines (counter_sale_id);

-- ─────────────────────────────────────────────────────────────
-- 23. SMS & NOTIFICATIONS (BASE)
-- Queue BullMQ lit cette table (at-least-once delivery)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE sms_notifications (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID        REFERENCES service_orders(id),
  customer_id      UUID        REFERENCES customers(id),
  phone_to         TEXT        NOT NULL,
  operator         TEXT,       -- 'ORANGE_CM','MTN_CM','CAMTEL'
  template_code    TEXT        NOT NULL,
  -- Ex : 'OT_RECEIVED','OT_READY','OT_INVOICED','REMINDER_7D','REMINDER_15D'
  message_body     TEXT        NOT NULL,
  lang             TEXT        NOT NULL DEFAULT 'fr',
  status           sms_status_t NOT NULL DEFAULT 'PENDING',
  gateway_ref      TEXT,       -- référence retour API opérateur
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  error_message    TEXT,
  retry_count      SMALLINT    NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_pending ON sms_notifications (created_at)
  WHERE status = 'PENDING';

-- ─────────────────────────────────────────────────────────────
-- 24. FK CIRCULAIRES (ajoutées en fin de fichier)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE vehicle_immobilizations
  ADD CONSTRAINT fk_immob_ot
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id);

ALTER TABLE asp_purchases
  ADD CONSTRAINT fk_asp_ot
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id);

ALTER TABLE asp_purchases
  ADD CONSTRAINT fk_asp_quote_line
  FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id);

ALTER TABLE stock_movements
  ADD CONSTRAINT fk_sm_service_order
  FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
  ADD CONSTRAINT fk_sm_quote_line
  FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id),
  ADD CONSTRAINT fk_sm_asp
  FOREIGN KEY (asp_id) REFERENCES asp_purchases(id),
  ADD CONSTRAINT fk_sm_counter
  FOREIGN KEY (counter_sale_id) REFERENCES counter_sales(id);

-- ─────────────────────────────────────────────────────────────
-- 25. TRIGGERS ACID
-- ─────────────────────────────────────────────────────────────

-- updated_at sur toutes les tables principales
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','customers','vehicles',
    'service_orders','technician_observations','ot_work_items',
    'quality_controls','parts_catalog','labor_catalog',
    'quotes','invoices','asp_purchases','counter_sales','suppliers'
  ] LOOP
    EXECUTE format(
      $fmt$ CREATE TRIGGER trg_%I_updated_at
              BEFORE UPDATE ON %I
              FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at(); $fmt$,
      t, t
    );
  END LOOP;
END;
$$;

-- ───── TRIGGER : mouvement de stock (ACID — verrou ligne) ─────
CREATE OR REPLACE FUNCTION fn_apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_new_qty NUMERIC;
BEGIN
  -- Verrou exclusif sur la ligne pièce (ACID — sérialisabilité)
  SELECT qty_in_stock INTO v_current
  FROM parts_catalog
  WHERE id = NEW.part_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pièce % introuvable.', NEW.part_id;
  END IF;

  v_new_qty := v_current + NEW.quantity;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION
      'Stock insuffisant pour la pièce %. Stock actuel : %, sortie demandée : %',
      NEW.part_id, v_current, -NEW.quantity;
  END IF;

  -- Snapshot ACID (immuable après INSERT)
  NEW.qty_before := v_current;
  NEW.qty_after  := v_new_qty;

  -- Mise à jour atomique
  UPDATE parts_catalog
  SET
    qty_in_stock = v_new_qty,
    version      = version + 1,
    updated_at   = now()
  WHERE id = NEW.part_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movement
BEFORE INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_apply_stock_movement();

-- ───── TRIGGER : closed_at automatique à la clôture OT ─────
CREATE OR REPLACE FUNCTION fn_ot_auto_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-incrément version à chaque UPDATE
  NEW.version := OLD.version + 1;

  -- Fermeture : calculer closed_at une seule fois
  IF NEW.status = 'CLOSED' AND OLD.status <> 'CLOSED' THEN
    NEW.closed_at := now();
  END IF;

  -- Réouverture : effacer closed_at si retour en arrière (QC rejeté)
  IF NEW.status NOT IN ('CLOSED','CANCELLED') AND OLD.status = 'CLOSED' THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ot_auto_fields
BEFORE UPDATE ON service_orders
FOR EACH ROW EXECUTE FUNCTION fn_ot_auto_fields();

-- ───── TRIGGER : historique statut OT automatique ─────
CREATE OR REPLACE FUNCTION fn_ot_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO ot_status_history (service_order_id, from_status, to_status, changed_by, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.opened_by, now());
    -- Note : changed_by idéal = utilisateur courant passé via SET LOCAL app.current_user_id
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ot_status_history
AFTER UPDATE OF status ON service_orders
FOR EACH ROW EXECUTE FUNCTION fn_ot_status_history();

-- ───── TRIGGER : paid_at et status facture automatiques (ACID) ─────
CREATE OR REPLACE FUNCTION fn_invoice_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total     NUMERIC;
  v_paid      NUMERIC;
  v_new_status invoice_status_t;
BEGIN
  -- Verrou sur la facture
  SELECT total_xaf, amount_paid_xaf
  INTO v_total, v_paid
  FROM invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  v_paid := (
    SELECT COALESCE(SUM(amount_xaf), 0)
    FROM payments
    WHERE invoice_id = NEW.invoice_id
      AND status = 'CONFIRMED'
  );

  IF v_paid = 0 THEN
    v_new_status := 'ISSUED';
  ELSIF v_paid >= v_total THEN
    v_new_status := 'PAID';
  ELSE
    v_new_status := 'PARTIAL';
  END IF;

  UPDATE invoices
  SET
    amount_paid_xaf = v_paid,
    status          = v_new_status,
    paid_at         = CASE WHEN v_new_status = 'PAID' THEN now() ELSE NULL END,
    version         = version + 1,
    updated_at      = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_invoice
AFTER INSERT OR UPDATE OF status ON payments
FOR EACH ROW EXECUTE FUNCTION fn_invoice_recalc();

-- ───── TRIGGER : alerte stock bas (BASE — entrée audit_log) ─────
CREATE OR REPLACE FUNCTION fn_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.qty_in_stock <= NEW.min_threshold
    AND (OLD.qty_in_stock IS NULL OR OLD.qty_in_stock > OLD.min_threshold) THEN

    -- Écriture dans audit_log (lue par worker stock-alerts, async)
    INSERT INTO audit_logs (entity_type, entity_id, action, field_changes, performed_at)
    VALUES (
      'parts_catalog',
      NEW.id,
      'STOCK_ALERT',
      jsonb_build_object(
        'qty_in_stock',  NEW.qty_in_stock,
        'min_threshold', NEW.min_threshold,
        'part_ref',      NEW.reference,
        'part_name',     NEW.name_fr
      ),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_alert
AFTER UPDATE OF qty_in_stock ON parts_catalog
FOR EACH ROW EXECUTE FUNCTION fn_stock_alert();

-- ───── TRIGGER : statut véhicule → IMMOBILIZED auto ─────
CREATE OR REPLACE FUNCTION fn_vehicle_immob_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Quand une immobilisation est créée : passer le véhicule en IMMOBILIZED
  IF TG_OP = 'INSERT' THEN
    UPDATE vehicles SET status = 'IMMOBILIZED', updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;

  -- Quand une immobilisation est résolue : repasser en IN_WORKSHOP ou DELIVERED
  IF TG_OP = 'UPDATE' AND NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    UPDATE vehicles
    SET status     = CASE
                       WHEN NEW.reason = 'WAITING_CLIENT_PICKUP' THEN 'WAITING_PICKUP'
                       ELSE 'IN_WORKSHOP'
                     END,
        updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vehicle_immob
AFTER INSERT OR UPDATE OF resolved_at ON vehicle_immobilizations
FOR EACH ROW EXECUTE FUNCTION fn_vehicle_immob_sync();

-- ─────────────────────────────────────────────────────────────
-- 26. VUES MÉTIER
-- ─────────────────────────────────────────────────────────────

-- Tableau de bord OT actifs (Chef Atelier, Conseiller Service)
CREATE OR REPLACE VIEW v_active_ot_dashboard AS
SELECT
  so.id,
  so.reference,
  so.status,
  so.priority,
  v.plate_number,
  vm.name  AS make,
  vmo.name AS model,
  COALESCE(c.first_name || ' ' || c.last_name, c.company_name) AS customer_name,
  c.phone_primary AS customer_phone,
  so.client_complaint,
  so.opened_at,
  so.promised_at,
  so.estimated_ready_at,
  ROUND(EXTRACT(EPOCH FROM (now() - so.opened_at))/3600, 1) AS hours_open,
  u1.first_name || ' ' || u1.last_name AS conseiller_name,
  u2.first_name || ' ' || u2.last_name AS chef_name,
  -- Avancement travaux
  (SELECT COUNT(*) FROM ot_work_items w WHERE w.service_order_id = so.id AND w.status = 'DONE')::INT
    AS works_done,
  (SELECT COUNT(*) FROM ot_work_items w WHERE w.service_order_id = so.id)::INT
    AS works_total,
  -- Immobilisation active
  vi.reason AS immob_reason,
  vi.immobilized_at AS immob_since,
  ROUND(EXTRACT(EPOCH FROM (now() - vi.immobilized_at))/3600, 1) AS immob_hours
FROM service_orders so
JOIN vehicles v       ON v.id = so.vehicle_id
JOIN customers c      ON c.id = so.customer_id
LEFT JOIN vehicle_makes vm        ON vm.id = v.make_id
LEFT JOIN vehicle_models vmo      ON vmo.id = v.model_id
LEFT JOIN users u1                ON u1.id = so.opened_by
LEFT JOIN users u2                ON u2.id = so.assigned_chef
LEFT JOIN vehicle_immobilizations vi ON vi.service_order_id = so.id
  AND vi.resolved_at IS NULL
WHERE so.status NOT IN ('CLOSED','CANCELLED');

-- Vue stock avec indicateur de niveau
CREATE OR REPLACE VIEW v_stock_status AS
SELECT
  p.id,
  p.reference,
  p.name_fr,
  p.category,
  p.unit,
  p.qty_in_stock,
  p.qty_reserved,
  p.qty_available,
  p.min_threshold,
  p.purchase_price_xaf,
  p.sale_price_xaf,
  p.storage_location,
  CASE
    WHEN p.qty_available <= 0                THEN 'OUT_OF_STOCK'
    WHEN p.qty_available <= p.min_threshold  THEN 'LOW'
    WHEN p.max_threshold IS NOT NULL
     AND p.qty_available >= p.max_threshold  THEN 'OVERSTOCK'
    ELSE 'OK'
  END AS stock_status,
  s.name AS preferred_supplier
FROM parts_catalog p
LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id
WHERE p.is_active = TRUE;

-- Vue factures impayées pour les relances cron
CREATE OR REPLACE VIEW v_pending_invoices AS
SELECT
  i.id,
  i.reference,
  i.customer_id,
  COALESCE(c.first_name || ' ' || c.last_name, c.company_name) AS customer_name,
  c.phone_primary,
  i.total_xaf,
  i.amount_paid_xaf,
  i.balance_xaf,
  i.status,
  i.issued_at,
  i.due_date,
  DATE_PART('day', now() - i.issued_at) AS days_overdue,
  i.reminder_1_sent_at,
  i.reminder_2_sent_at
FROM invoices i
JOIN customers c ON c.id = i.customer_id
WHERE i.status IN ('ISSUED','PARTIAL')
ORDER BY i.due_date ASC NULLS LAST;

-- ─────────────────────────────────────────────────────────────
-- 27. DONNÉES INITIALES (SEED)
-- ─────────────────────────────────────────────────────────────

-- Rôles système
INSERT INTO roles (code, label, description, is_system) VALUES
  ('ADMIN',              'Administrateur',       'Accès total + gestion utilisateurs et paramètres',           TRUE),
  ('CHEF_ATELIER',       'Chef Atelier',         'Supervision OT, validation devis/factures, ASP',            TRUE),
  ('CONSEILLER_SERVICE', 'Conseiller Service',   'Réception véhicule, ouverture OT, relation client',         TRUE),
  ('TECHNICIEN',         'Technicien',           'Exécution des travaux, observations, saisie temps',         TRUE),
  ('QC',                 'Contrôleur Qualité',   'Contrôle qualité avant livraison client',                   TRUE),
  ('CAISSIER',           'Caissier',             'Encaissement, vente comptoir, émission reçus',              TRUE);

-- Permissions granulaires
INSERT INTO permissions (code, module, action, description) VALUES
  -- Véhicules
  ('vehicles:create',       'vehicles', 'create',   'Créer une fiche véhicule/client'),
  ('vehicles:read',         'vehicles', 'read',     'Consulter les fiches véhicules'),
  ('vehicles:update',       'vehicles', 'update',   'Modifier une fiche véhicule'),
  ('vehicles:delete',       'vehicles', 'delete',   'Archiver un véhicule (soft-delete)'),
  -- OT
  ('ot:create',             'workshop', 'create',   'Ouvrir un ordre de travail'),
  ('ot:read',               'workshop', 'read',     'Consulter les OT'),
  ('ot:update',             'workshop', 'update',   'Modifier un OT'),
  ('ot:validate',           'workshop', 'validate', 'Changer le statut d''un OT'),
  ('ot:cancel',             'workshop', 'delete',   'Annuler un OT'),
  -- Réception
  ('reception:create',      'workshop', 'create',   'Créer une fiche de réception 27 points'),
  ('reception:sign',        'workshop', 'update',   'Valider la signature client réception'),
  -- Observations
  ('observation:create',    'workshop', 'create',   'Ajouter une observation technicien'),
  ('observation:read',      'workshop', 'read',     'Lire les observations'),
  -- Contrôle qualité
  ('qc:perform',            'workshop', 'create',   'Effectuer un contrôle qualité'),
  ('qc:read',               'workshop', 'read',     'Lire les rapports CQ'),
  -- Stock
  ('stock:read',            'stock',    'read',     'Consulter le stock'),
  ('stock:movement',        'stock',    'create',   'Enregistrer un mouvement de stock'),
  ('stock:adjust',          'stock',    'update',   'Ajustement inventaire'),
  ('stock:catalog',         'stock',    'update',   'Gérer le catalogue pièces'),
  -- Devis
  ('quote:create',          'billing',  'create',   'Créer / modifier un devis'),
  ('quote:send',            'billing',  'update',   'Envoyer un devis au client'),
  ('quote:approve',         'billing',  'validate', 'Approuver un devis (côté atelier)'),
  -- ASP
  ('asp:create',            'billing',  'create',   'Créer un achat sur place'),
  ('asp:authorize',         'billing',  'validate', 'Autoriser un ASP'),
  ('asp:account',           'billing',  'update',   'Passer un ASP en écriture comptable'),
  -- Factures
  ('invoice:create',        'billing',  'create',   'Créer une facture'),
  ('invoice:validate',      'billing',  'validate', 'Valider/émettre une facture'),
  ('invoice:read',          'billing',  'read',     'Consulter les factures'),
  ('invoice:cancel',        'billing',  'delete',   'Annuler/avoir sur facture'),
  -- Paiements
  ('payment:record',        'billing',  'create',   'Enregistrer un paiement'),
  -- Vente comptoir
  ('counter:sale',          'stock',    'create',   'Effectuer une vente comptoir'),
  -- Immobilisation
  ('vehicle:immobilize',    'workshop', 'create',   'Créer/résoudre un motif de vieillissement'),
  -- Administration
  ('admin:users',           'admin',    'create',   'Gérer les utilisateurs'),
  ('admin:roles',           'admin',    'update',   'Gérer les rôles et permissions'),
  ('admin:reports',         'admin',    'read',     'Accéder aux rapports et exports globaux'),
  ('admin:config',          'admin',    'update',   'Paramètres système (TVA, seuils, SMS)');

-- Affectation des permissions par rôle
-- ADMIN : tout
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'ADMIN';

-- CHEF_ATELIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'CHEF_ATELIER'
  AND p.code IN (
    'vehicles:read','vehicles:update',
    'ot:read','ot:validate','ot:cancel','ot:update',
    'reception:create','reception:sign',
    'observation:create','observation:read',
    'qc:read',
    'stock:read','stock:movement','stock:adjust','stock:catalog',
    'quote:create','quote:send','quote:approve',
    'asp:create','asp:authorize','asp:account',
    'invoice:create','invoice:validate','invoice:read','invoice:cancel',
    'payment:record',
    'vehicle:immobilize',
    'admin:reports'
  );

-- CONSEILLER_SERVICE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'CONSEILLER_SERVICE'
  AND p.code IN (
    'vehicles:create','vehicles:read','vehicles:update',
    'ot:create','ot:read','ot:update',
    'reception:create','reception:sign',
    'observation:read',
    'stock:read',
    'quote:read','quote:send',
    'invoice:read',
    'vehicle:immobilize'
  );

-- TECHNICIEN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'TECHNICIEN'
  AND p.code IN (
    'vehicles:read',
    'ot:read',
    'observation:create','observation:read',
    'stock:read'
  );

-- QC (Contrôleur Qualité)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'QC'
  AND p.code IN (
    'vehicles:read',
    'ot:read','ot:validate',
    'observation:create','observation:read',
    'qc:perform','qc:read',
    'stock:read'
  );

-- CAISSIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'CAISSIER'
  AND p.code IN (
    'vehicles:read',
    'ot:read',
    'invoice:read',
    'payment:record',
    'counter:sale',
    'stock:read'
  );

-- ─── 27 POINTS DE CONTRÔLE À LA RÉCEPTION ───
INSERT INTO reception_check_catalog
  (code, category, sort_order, label_fr, label_en, help_text, is_blocking) VALUES
-- EXTÉRIEUR (9 points)
('EXT_01','EXTERIEUR', 1,'État carrosserie (rayures / bosses)','Body condition (scratches / dents)',
 'Photographier tout dégât visible. Cocher WARNING si mineur, CRITICAL si important.',FALSE),
('EXT_02','EXTERIEUR', 2,'Vitres et pare-brise','Windows and windshield',
 'Vérifier fissures, éclats et décollement de joint.',FALSE),
('EXT_03','EXTERIEUR', 3,'Rétroviseurs (état et réglage)','Mirrors (condition and adjustment)',
 'Vérifier intégrité et fonctionnement électrique si applicable.',FALSE),
('EXT_04','EXTERIEUR', 4,'Pneus avant — état et pression','Front tyres — condition and pressure',
 'Usure < 1,6 mm = CRITICAL. Craquelures profondes = WARNING.',TRUE),
('EXT_05','EXTERIEUR', 5,'Pneus arrière — état et pression','Rear tyres — condition and pressure',
 'Même critères que pneus avant.',TRUE),
('EXT_06','EXTERIEUR', 6,'Roue de secours présente et gonflée','Spare tyre present and inflated',
 'Cocher NA si véhicule équipé de kit anti-crevaison.',FALSE),
('EXT_07','EXTERIEUR', 7,'Éclairage avant (phares / feux de jour)','Front lighting (headlights / DRL)',
 'Tester phares codes, pleins phares et feux diurnes.',FALSE),
('EXT_08','EXTERIEUR', 8,'Éclairage arrière (stop / recul / brouillard)','Rear lighting',
 'Tester avec aide d''un collègue.',FALSE),
('EXT_09','EXTERIEUR', 9,'Clignotants avant et arrière','Turn signals front and rear',
 'Tester clignotant gauche, droit et feux de détresse.',FALSE),
-- SOUS CAPOT (7 points)
('ENG_01','SOUS_CAPOT',10,'Niveau huile moteur','Engine oil level',
 'Contrôler sur jauge à froid. CRITICAL si < MIN.',TRUE),
('ENG_02','SOUS_CAPOT',11,'Niveau liquide de refroidissement','Coolant level',
 'Vérifier vasque expansion. CRITICAL si vide.',TRUE),
('ENG_03','SOUS_CAPOT',12,'Niveau liquide de frein','Brake fluid level',
 'CRITICAL si < MIN ou liquide noirci (eau).',TRUE),
('ENG_04','SOUS_CAPOT',13,'Niveau direction assistée','Power steering fluid',
 'NA si direction électrique.',FALSE),
('ENG_05','SOUS_CAPOT',14,'Niveau lave-glace','Windshield washer fluid',
 'Nota informatif, non bloquant.',FALSE),
('ENG_06','SOUS_CAPOT',15,'État courroie(s) accessoires (visuel)','Accessory belt(s) condition',
 'Craquelures ou effilochage = WARNING.',FALSE),
('ENG_07','SOUS_CAPOT',16,'État batterie et bornes','Battery and terminals condition',
 'Vérifier corrosion bornes, tension nominale si testeur disponible.',FALSE),
-- INTÉRIEUR (7 points)
('INT_01','INTERIEUR',17,'Témoins tableau de bord allumés','Dashboard warning lights',
 'CRITICAL si voyant moteur, ABS ou airbag allumé.',TRUE),
('INT_02','INTERIEUR',18,'Fonctionnement climatisation','Air conditioning operation',
 'Test froid et chauffage. WARNING si défaillant.',FALSE),
('INT_03','INTERIEUR',19,'Essuie-glaces avant et arrière','Front and rear wipers',
 'Vérifier caoutchoucs et projection liquide.',FALSE),
('INT_04','INTERIEUR',20,'Klaxon','Horn',
 'Test sonore bref.',FALSE),
('INT_05','INTERIEUR',21,'Ceintures de sécurité','Seat belts',
 'Tirer chaque ceinture. CRITICAL si non déverrouillable.',TRUE),
('INT_06','INTERIEUR',22,'Kilométrage relevé','Mileage reading',
 'Reporter la valeur exacte dans le champ mileage_at_reception. Point toujours OBLIGATOIRE.',TRUE),
('INT_07','INTERIEUR',23,'Niveau carburant','Fuel level',
 'Reporter sur la jauge 0–8. Non bloquant.',FALSE),
-- DOCUMENTS (4 points)
('DOC_01','DOCUMENTS',24,'Carte grise présente','Vehicle registration present',
 'Vérifier que la carte grise correspond au véhicule.',FALSE),
('DOC_02','DOCUMENTS',25,'Assurance valide','Insurance valid',
 'Vérifier date de validité. WARNING si < 30 jours.',FALSE),
('DOC_03','DOCUMENTS',26,'Visite technique valide (si applicable)','Technical inspection valid',
 'WARNING si < 60 jours, CRITICAL si expirée.',FALSE),
('DOC_04','DOCUMENTS',27,'Inventaire habitacle (objets de valeur)','Interior inventory',
 'Lister tout objet de valeur visible. Photo recommandée.',FALSE);

-- Marques courantes au Cameroun
INSERT INTO vehicle_makes (name) VALUES
  ('Toyota'),('Nissan'),('Mercedes-Benz'),('Renault'),('Peugeot'),
  ('Mitsubishi'),('Hyundai'),('Kia'),('Isuzu'),('Ford'),('Mazda'),
  ('BMW'),('Volkswagen'),('Honda'),('Suzuki'),('Land Rover'),
  ('Jeep'),('Citroën'),('Fiat'),('Volvo');

-- ─────────────────────────────────────────────────────────────
-- 28. ROW LEVEL SECURITY (hints — à activer par module)
-- ─────────────────────────────────────────────────────────────
-- Activer via : ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
-- Pattern recommandé :
--   CREATE POLICY p_ot_technicien ON service_orders
--     FOR SELECT USING (
--       EXISTS (
--         SELECT 1 FROM ot_work_items w
--         WHERE w.service_order_id = service_orders.id
--           AND w.assigned_technician = current_setting('app.current_user_id')::uuid
--       )
--       OR current_setting('app.current_role') IN ('ADMIN','CHEF_ATELIER','CONSEILLER_SERVICE')
--     );
-- Passer le contexte via : SET LOCAL app.current_user_id = '...';
--                           SET LOCAL app.current_role = 'TECHNICIEN';

-- ─────────────────────────────────────────────────────────────
-- FIN DU SCHÉMA — CDC-ATEL-2026-001
-- ─────────────────────────────────────────────────────────────