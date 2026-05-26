import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const log = [];
const step = (name) => log.push({ step: name, at: new Date().toISOString() });

async function run(client, sql, label) {
  step(label);
  await client.query(sql);
}

const viewBodies = {
  v_active_ot_dashboard: `
SELECT
    so.id, so.reference, so.status, so.priority,
    v.plate_number,
    vm.name AS make,
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
JOIN vehicles v ON v.id = so.vehicle_id
JOIN customers c ON c.id = so.customer_id
LEFT JOIN vehicle_makes vm ON vm.id = v.make_id
LEFT JOIN vehicle_models vmo ON vmo.id = v.model_id
LEFT JOIN users u1 ON u1.id = so.opened_by
LEFT JOIN users u2 ON u2.id = so.assigned_chef
LEFT JOIN vehicle_immobilizations vi
       ON vi.service_order_id = so.id AND vi.resolved_at IS NULL
WHERE so.status <> ALL (ARRAY['CLOSED'::ot_status_t, 'CANCELLED'::ot_status_t])`,

  v_pending_invoices: `
SELECT i.id,
    i.reference,
    i.customer_id,
    COALESCE((c.first_name || ' ') || c.last_name, c.company_name) AS customer_name,
    c.phone_primary,
    i.total_xaf,
    i.amount_paid_xaf,
    i.balance_xaf,
    i.status,
    i.issued_at,
    i.due_date,
    date_part('day', now() - i.issued_at) AS days_overdue,
    i.reminder_1_sent_at,
    i.reminder_2_sent_at
FROM invoices i
JOIN customers c ON c.id = i.customer_id
WHERE i.status = ANY (ARRAY['ISSUED'::invoice_status_t, 'PARTIAL'::invoice_status_t])
ORDER BY i.due_date`,

  v_stock_status: `
SELECT p.id,
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
        WHEN p.qty_available <= 0 THEN 'OUT_OF_STOCK'
        WHEN p.qty_available <= p.min_threshold THEN 'LOW'
        WHEN p.max_threshold IS NOT NULL AND p.qty_available >= p.max_threshold THEN 'OVERSTOCK'
        ELSE 'OK'
    END AS stock_status,
    s.name AS preferred_supplier
FROM parts_catalog p
LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id
WHERE p.is_active = true`,

  v_user_permissions: `
SELECT u.id AS user_id,
    u.employee_code,
    (u.first_name || ' ') || u.last_name AS full_name,
    r.code AS role_code,
    r.label AS role_label,
    p.code AS permission_code,
    p.module,
    p.action
FROM users u
JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE'::user_status_t`,
};

const client = await pool.connect();

try {
  await client.query('BEGIN');
  step('BEGIN');

  // 1. Drop obsolete CHECK constraints blocking enum conversion
  await run(client, `
    ALTER TABLE ot_work_items DROP CONSTRAINT IF EXISTS ot_work_items_status_check;
    ALTER TABLE asp_purchases DROP CONSTRAINT IF EXISTS asp_purchases_status_check;
    ALTER TABLE asp_purchases DROP CONSTRAINT IF EXISTS chk_asp_authorized;
  `, 'drop-stale-checks');

  // 2. Ensure enum types exist
  await run(client, `
    DO $$ BEGIN
      CREATE TYPE work_item_status_t AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE asp_status_t AS ENUM ('PENDING', 'AUTHORIZED', 'RECEIVED', 'ACCOUNTED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `, 'ensure-enums');

  // 3. Drop views and status-dependent indexes before column type changes
  await run(client, `
    DROP VIEW IF EXISTS v_active_ot_dashboard;
    DROP VIEW IF EXISTS v_pending_invoices;
    DROP VIEW IF EXISTS v_stock_status;
    DROP VIEW IF EXISTS v_user_permissions;
    DROP INDEX IF EXISTS idx_work_tech;
    DROP INDEX IF EXISTS idx_work_ot;
    DROP INDEX IF EXISTS idx_asp_status;
  `, 'drop-views-and-status-indexes');

  // 4. ot_work_items.status TEXT → enum
  await run(client, `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ot_work_items'
          AND column_name = 'status' AND data_type = 'text'
      ) THEN
        UPDATE ot_work_items SET status = 'COMPLETED' WHERE status = 'DONE';
        ALTER TABLE ot_work_items ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE ot_work_items ALTER COLUMN status TYPE work_item_status_t
          USING CASE status::text
            WHEN 'PENDING'     THEN 'PENDING'::work_item_status_t
            WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::work_item_status_t
            WHEN 'COMPLETED'   THEN 'COMPLETED'::work_item_status_t
            WHEN 'DONE'        THEN 'COMPLETED'::work_item_status_t
            WHEN 'CANCELLED'   THEN 'CANCELLED'::work_item_status_t
            ELSE 'PENDING'::work_item_status_t
          END;
        ALTER TABLE ot_work_items ALTER COLUMN status
          SET DEFAULT 'PENDING'::work_item_status_t;
      END IF;
    END $$;
  `, 'convert-ot_work_items-status');

  // 5. asp_purchases.status TEXT → enum
  await run(client, `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'asp_purchases'
          AND column_name = 'status' AND data_type = 'text'
      ) THEN
        ALTER TABLE asp_purchases ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE asp_purchases ALTER COLUMN status TYPE asp_status_t
          USING CASE status::text
            WHEN 'PENDING'    THEN 'PENDING'::asp_status_t
            WHEN 'AUTHORIZED' THEN 'AUTHORIZED'::asp_status_t
            WHEN 'ORDERED'    THEN 'AUTHORIZED'::asp_status_t
            WHEN 'RECEIVED'   THEN 'RECEIVED'::asp_status_t
            WHEN 'BILLED'     THEN 'ACCOUNTED'::asp_status_t
            WHEN 'ACCOUNTED'  THEN 'ACCOUNTED'::asp_status_t
            WHEN 'CANCELLED'  THEN 'CANCELLED'::asp_status_t
            ELSE 'PENDING'::asp_status_t
          END;
        ALTER TABLE asp_purchases ALTER COLUMN status
          SET DEFAULT 'PENDING'::asp_status_t;
      END IF;
    END $$;
  `, 'convert-asp_purchases-status');

  // 5b. Restore asp authorization CHECK with enum types
  await run(client, `
    DO $$ BEGIN
      ALTER TABLE asp_purchases ADD CONSTRAINT chk_asp_authorized CHECK (
        status NOT IN (
          'AUTHORIZED'::asp_status_t,
          'RECEIVED'::asp_status_t,
          'ACCOUNTED'::asp_status_t
        )
        OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL)
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `, 'restore-chk-asp-authorized');

  // 5c. Recreate indexes that referenced status as text
  await run(client, `
    CREATE INDEX IF NOT EXISTS idx_work_ot ON ot_work_items (service_order_id, status);
    CREATE INDEX IF NOT EXISTS idx_work_tech ON ot_work_items (assigned_technician)
      WHERE status = 'IN_PROGRESS'::work_item_status_t;
    CREATE INDEX IF NOT EXISTS idx_asp_status ON asp_purchases (status)
      WHERE status <> ALL (ARRAY['ACCOUNTED'::asp_status_t, 'CANCELLED'::asp_status_t]);
  `, 'recreate-status-indexes');

  // 6. quality_controls round (idempotent)
  await run(client, `
    ALTER TABLE quality_controls ADD COLUMN IF NOT EXISTS round SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE quality_controls DROP CONSTRAINT IF EXISTS quality_controls_service_order_id_key;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'quality_controls_service_order_id_round_key'
      ) THEN
        ALTER TABLE quality_controls
          ADD CONSTRAINT quality_controls_service_order_id_round_key
          UNIQUE (service_order_id, round);
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS quality_controls_service_order_id_idx
      ON quality_controls (service_order_id);
  `, 'quality-controls-round');

  // 7. Recreate views with security_invoker = true
  for (const [name, body] of Object.entries(viewBodies)) {
    await run(
      client,
      `CREATE OR REPLACE VIEW ${name} WITH (security_invoker = true) AS ${body}`,
      `recreate-view-${name}`,
    );
  }

  // 8. Revoke public Data API access (NestJS uses postgres/service role)
  await run(client, `
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
  `, 'revoke-anon-authenticated');

  // 9. Record migration in Prisma history if table exists and row missing
  await run(client, `
    INSERT INTO _prisma_migrations (
      id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
    )
    SELECT
      gen_random_uuid()::text,
      'manual-audit-fix-20260523',
      NOW(),
      '20260523_qc_multi_round_enums',
      NULL,
      NULL,
      NOW(),
      1
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    )
    AND NOT EXISTS (
      SELECT 1 FROM _prisma_migrations
      WHERE migration_name = '20260523_qc_multi_round_enums'
    );
  `, 'record-prisma-migration');

  await client.query('COMMIT');
  step('COMMIT');

  const result = { success: true, steps: log };
  const outPath = path.join(process.cwd(), 'scripts', 'db-apply-fixes-log.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('FIXES_APPLIED:', outPath);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  await client.query('ROLLBACK');
  console.error('FIXES_FAILED:', e.message);
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
