-- Migration: qc-multi-round-enums — idempotent, safe to re-run

-- 0. Drop dependent views
DROP VIEW IF EXISTS v_active_ot_dashboard;

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE "work_item_status_t" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "asp_status_t" AS ENUM ('PENDING', 'AUTHORIZED', 'RECEIVED', 'ACCOUNTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ot_work_items.status : TEXT → enum
--    CASE WHEN évite tout cast implicite text→enum (source des erreurs précédentes).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ot_work_items'
      AND column_name = 'status' AND data_type = 'text'
  ) THEN
    EXECUTE $sql$
      UPDATE ot_work_items SET status = 'COMPLETED' WHERE status = 'DONE';
      ALTER TABLE ot_work_items ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE ot_work_items ALTER COLUMN status TYPE work_item_status_t
        USING CASE status
          WHEN 'PENDING'     THEN 'PENDING'::work_item_status_t
          WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::work_item_status_t
          WHEN 'COMPLETED'   THEN 'COMPLETED'::work_item_status_t
          WHEN 'CANCELLED'   THEN 'CANCELLED'::work_item_status_t
          ELSE                    'PENDING'::work_item_status_t
        END;
      ALTER TABLE ot_work_items ALTER COLUMN status
        SET DEFAULT 'PENDING'::work_item_status_t;
    $sql$;
  END IF;
END $$;

-- 3. asp_purchases.status : TEXT → enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'asp_purchases'
      AND column_name = 'status' AND data_type = 'text'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE asp_purchases ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE asp_purchases ALTER COLUMN status TYPE asp_status_t
        USING CASE status
          WHEN 'PENDING'    THEN 'PENDING'::asp_status_t
          WHEN 'AUTHORIZED' THEN 'AUTHORIZED'::asp_status_t
          WHEN 'RECEIVED'   THEN 'RECEIVED'::asp_status_t
          WHEN 'ACCOUNTED'  THEN 'ACCOUNTED'::asp_status_t
          WHEN 'CANCELLED'  THEN 'CANCELLED'::asp_status_t
          ELSE                   'PENDING'::asp_status_t
        END;
      ALTER TABLE asp_purchases ALTER COLUMN status
        SET DEFAULT 'PENDING'::asp_status_t;
    $sql$;
  END IF;
END $$;

-- 4. Colonne round
ALTER TABLE quality_controls
  ADD COLUMN IF NOT EXISTS "round" SMALLINT NOT NULL DEFAULT 1;

-- 5. Drop ancienne contrainte unique
ALTER TABLE quality_controls
  DROP CONSTRAINT IF EXISTS "quality_controls_service_order_id_key";

-- 6. Contrainte composite unique
DO $$ BEGIN
  ALTER TABLE quality_controls
    ADD CONSTRAINT "quality_controls_service_order_id_round_key"
    UNIQUE (service_order_id, round);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Index
CREATE INDEX IF NOT EXISTS "quality_controls_service_order_id_idx"
  ON quality_controls (service_order_id);

-- 8. Vue
CREATE OR REPLACE VIEW v_active_ot_dashboard AS
SELECT
    so.id, so.reference, so.status, so.priority,
    v.plate_number,
    vm.name  AS make,
    vmo.name AS model,
    COALESCE((c.first_name || ' ') || c.last_name, c.company_name) AS customer_name,
    c.phone_primary AS customer_phone,
    so.client_complaint, so.opened_at, so.promised_at, so.estimated_ready_at,
    ROUND(EXTRACT(EPOCH FROM now() - so.opened_at) / 3600, 1) AS hours_open,
    (u1.first_name || ' ') || u1.last_name AS conseiller_name,
    (u2.first_name || ' ') || u2.last_name AS chef_name,
    (SELECT COUNT(*)::INTEGER FROM ot_work_items w
     WHERE w.service_order_id = so.id
       AND w.status = 'COMPLETED'::work_item_status_t) AS works_done,
    (SELECT COUNT(*)::INTEGER FROM ot_work_items w
     WHERE w.service_order_id = so.id) AS works_total,
    vi.reason AS immob_reason, vi.immobilized_at AS immob_since,
    ROUND(EXTRACT(EPOCH FROM now() - vi.immobilized_at) / 3600, 1) AS immob_hours
FROM service_orders so
JOIN  vehicles v   ON v.id  = so.vehicle_id
JOIN  customers c  ON c.id  = so.customer_id
LEFT JOIN vehicle_makes  vm  ON vm.id  = v.make_id
LEFT JOIN vehicle_models vmo ON vmo.id = v.model_id
LEFT JOIN users u1 ON u1.id = so.opened_by
LEFT JOIN users u2 ON u2.id = so.assigned_chef
LEFT JOIN vehicle_immobilizations vi
       ON vi.service_order_id = so.id AND vi.resolved_at IS NULL
WHERE so.status <> ALL (ARRAY['CLOSED'::ot_status_t, 'CANCELLED'::ot_status_t]);
