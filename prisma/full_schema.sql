-- =============================================================================
-- ATELIER MAÎTRE — Schéma SQL post-Prisma (parité Supabase prod)
-- Exécuter APRÈS `npx prisma db push` (boot API Docker ou init-prod-database.mjs)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS seq_ot      START 1;
CREATE SEQUENCE IF NOT EXISTS seq_quote   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice START 1;
CREATE SEQUENCE IF NOT EXISTS seq_asp     START 1;
CREATE SEQUENCE IF NOT EXISTS seq_counter START 1;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_next_ref(prefix TEXT, seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN prefix || '-' ||
    to_char(now() AT TIME ZONE 'Africa/Douala', 'YYYY') || '-' ||
    lpad(nextval(seq_name::regclass)::text, 5, '0');
END;
$$;

-- ─── Numérotation par garage (préfixe tenant + compteur annuel) ────────────────

CREATE TABLE IF NOT EXISTS garage_ref_counters (
  garage_id   UUID NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  ref_kind    TEXT NOT NULL,
  ref_year    INT  NOT NULL,
  last_number INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, ref_kind, ref_year)
);

CREATE OR REPLACE FUNCTION fn_garage_ref_prefix(p_garage_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tenant_slug TEXT;
  v_garage_slug TEXT;
BEGIN
  SELECT t.slug, g.slug
  INTO v_tenant_slug, v_garage_slug
  FROM garages g
  JOIN tenants t ON t.id = g.tenant_id
  WHERE g.id = p_garage_id;

  IF v_tenant_slug IS NULL THEN
    RETURN 'GARAGE';
  END IF;

  IF v_tenant_slug = 'default' THEN
    RETURN upper(v_garage_slug);
  END IF;

  RETURN upper(v_tenant_slug);
END;
$$;

CREATE OR REPLACE FUNCTION fn_next_garage_ref(
  p_garage_id UUID,
  p_doc_prefix TEXT,
  p_ref_kind TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix   TEXT;
  v_year     TEXT;
  v_year_int INT;
  v_next     INT;
BEGIN
  IF p_garage_id IS NULL THEN
    RETURN fn_next_ref(p_doc_prefix, CASE p_ref_kind
      WHEN 'OT'  THEN 'seq_ot'
      WHEN 'DEV' THEN 'seq_quote'
      WHEN 'FAC' THEN 'seq_invoice'
      WHEN 'ASP' THEN 'seq_asp'
      WHEN 'VCC' THEN 'seq_counter'
      ELSE 'seq_ot'
    END);
  END IF;

  v_prefix := fn_garage_ref_prefix(p_garage_id);
  v_year := to_char(now() AT TIME ZONE 'Africa/Douala', 'YYYY');
  v_year_int := v_year::INT;

  INSERT INTO garage_ref_counters (garage_id, ref_kind, ref_year, last_number)
  VALUES (p_garage_id, p_ref_kind, v_year_int, 1)
  ON CONFLICT (garage_id, ref_kind, ref_year)
  DO UPDATE SET last_number = garage_ref_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_prefix || '-' || p_doc_prefix || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_service_order_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'OT', 'OT');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_quote_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'DEV', 'DEV');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_invoice_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'FAC', 'FAC');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_asp_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_garage_id UUID;
BEGIN
  SELECT so.garage_id INTO v_garage_id FROM service_orders so WHERE so.id = NEW.service_order_id;
  NEW.reference := fn_next_garage_ref(v_garage_id, 'ASP', 'ASP');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_trg_counter_sale_ref()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_garage_id UUID;
BEGIN
  SELECT COALESCE(c.garage_id, u.garage_id) INTO v_garage_id
  FROM users u
  LEFT JOIN customers c ON c.id = NEW.customer_id
  WHERE u.id = NEW.sold_by;
  NEW.reference := fn_next_garage_ref(v_garage_id, 'VCC', 'VCC');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── Fonctions triggers métier (alignées Supabase prod) ───────────────────────

CREATE OR REPLACE FUNCTION fn_ot_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_changed_by UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  v_changed_by := COALESCE(fn_current_user_id(), NEW.opened_by);

  INSERT INTO ot_status_history (
    id, service_order_id, from_status, to_status, changed_by, changed_at
  ) VALUES (
    uuid_generate_v4(),
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
    NEW.status,
    v_changed_by,
    CURRENT_TIMESTAMP
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_new_qty NUMERIC;
BEGIN
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

  NEW.qty_before := v_current;
  NEW.qty_after  := v_new_qty;

  UPDATE parts_catalog
  SET
    qty_in_stock = v_new_qty,
    version      = version + 1,
    updated_at   = now()
  WHERE id = NEW.part_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_invoice_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total      NUMERIC;
  v_paid       NUMERIC;
  v_new_status invoice_status_t;
BEGIN
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

CREATE OR REPLACE FUNCTION fn_ot_auto_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := OLD.version + 1;

  IF NEW.status = 'CLOSED' AND OLD.status <> 'CLOSED' THEN
    NEW.closed_at := now();
  END IF;

  IF NEW.status NOT IN ('CLOSED', 'CANCELLED') AND OLD.status = 'CLOSED' THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.qty_in_stock <= NEW.min_threshold
    AND (OLD.qty_in_stock IS NULL OR OLD.qty_in_stock > OLD.min_threshold) THEN
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

CREATE OR REPLACE FUNCTION fn_vehicle_immob_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE vehicles
    SET status = 'IMMOBILIZED', updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    UPDATE vehicles
    SET
      status = CASE
        WHEN NEW.reason = 'WAITING_CLIENT_PICKUP' THEN 'WAITING_PICKUP'
        ELSE 'IN_WORKSHOP'
      END,
      updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Audit générique (non attaché par défaut — voir fin de fichier)
CREATE OR REPLACE FUNCTION fn_trg_audit_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO audit_logs (
    entity_type, entity_id, action, performed_by, performed_at
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    fn_current_user_id(),
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

-- ─── audit_logs partitionné (mensuel + overflow) ─────────────────────────────

CREATE OR REPLACE FUNCTION ensure_audit_log_partitions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  y         int;
  m         int;
  part_name text;
  from_d    date;
  to_d      date;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs' AND c.relkind = 'p'
  ) THEN
    RAISE EXCEPTION 'audit_logs n''est pas une table partitionnée';
  END IF;

  FOR y IN (extract(year FROM now())::int - 1) .. (extract(year FROM now())::int + 1) LOOP
    FOR m IN 1..12 LOOP
      part_name := format('audit_logs_%s_%s', y, lpad(m::text, 2, '0'));
      from_d := make_date(y, m, 1);
      to_d := (from_d + INTERVAL '1 month')::date;
      IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
          part_name, from_d, to_d
        );
      END IF;
    END LOOP;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_overflow') THEN
    EXECUTE 'CREATE TABLE audit_logs_overflow PARTITION OF audit_logs DEFAULT';
  END IF;
END;
$$;

DO $audit_migrate$
DECLARE
  v_kind "char";
BEGIN
  SELECT c.relkind
  INTO v_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'audit_logs';

  IF v_kind IS NULL THEN
    RAISE NOTICE 'audit_logs absent — ignorer (db push requis)';
    RETURN;
  END IF;

  IF v_kind = 'p' THEN
    RAISE NOTICE 'audit_logs déjà partitionné';
    PERFORM ensure_audit_log_partitions();
    RETURN;
  END IF;

  ALTER TABLE audit_logs RENAME TO audit_logs__legacy;

  CREATE TABLE audit_logs (
    id            UUID        NOT NULL DEFAULT uuid_generate_v4(),
    entity_type   TEXT        NOT NULL,
    entity_id     UUID        NOT NULL,
    action        TEXT        NOT NULL,
    field_changes JSONB,
    performed_by  UUID        REFERENCES users(id),
    performed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address    INET,
    user_agent    TEXT,
    metadata      JSONB,
    PRIMARY KEY (id, performed_at)
  ) PARTITION BY RANGE (performed_at);

  INSERT INTO audit_logs (
    id, entity_type, entity_id, action, field_changes,
    performed_by, performed_at, ip_address, user_agent, metadata
  )
  SELECT
    id,
    entity_type,
    entity_id,
    action,
    field_changes,
    performed_by,
    performed_at,
    CASE
      WHEN ip_address IS NULL OR ip_address::text = '' THEN NULL
      ELSE ip_address::text::inet
    END,
    user_agent,
    metadata
  FROM audit_logs__legacy;

  DROP TABLE audit_logs__legacy;

  PERFORM ensure_audit_log_partitions();
END $audit_migrate$;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (performed_by, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs (performed_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- line_total_xaf : calculé si absent (INSERT sans valeur fournie par l'app)
CREATE OR REPLACE FUNCTION fn_compute_line_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.line_total_xaf IS NULL THEN
    NEW.line_total_xaf := round(
      (NEW.quantity * NEW.unit_price_xaf * (1 - NEW.discount_pct / 100.0))::numeric, 0
    );
  END IF;
  RETURN NEW;
END;
$$;

-- balance_xaf : calculé si absent à l'INSERT de la facture (= total - déjà payé)
CREATE OR REPLACE FUNCTION fn_compute_invoice_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.balance_xaf IS NULL THEN
    NEW.balance_xaf := COALESCE(NEW.total_xaf, 0) - COALESCE(NEW.amount_paid_xaf, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_lines_total ON quote_lines;
CREATE TRIGGER trg_quote_lines_total
  BEFORE INSERT ON quote_lines
  FOR EACH ROW EXECUTE FUNCTION fn_compute_line_total();

DROP TRIGGER IF EXISTS trg_invoice_lines_total ON invoice_lines;
CREATE TRIGGER trg_invoice_lines_total
  BEFORE INSERT ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION fn_compute_line_total();

DROP TRIGGER IF EXISTS trg_counter_sale_lines_total ON counter_sale_lines;
CREATE TRIGGER trg_counter_sale_lines_total
  BEFORE INSERT ON counter_sale_lines
  FOR EACH ROW EXECUTE FUNCTION fn_compute_line_total();

DROP TRIGGER IF EXISTS trg_invoice_balance_init ON invoices;
CREATE TRIGGER trg_invoice_balance_init
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_compute_invoice_balance();

DROP TRIGGER IF EXISTS trg_stock_movement ON stock_movements;
CREATE TRIGGER trg_stock_movement
  BEFORE INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION fn_apply_stock_movement();

DROP TRIGGER IF EXISTS trg_ot_auto_fields ON service_orders;
CREATE TRIGGER trg_ot_auto_fields
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_ot_auto_fields();

DROP TRIGGER IF EXISTS trg_service_order_garage_ref ON service_orders;
CREATE TRIGGER trg_service_order_garage_ref
  BEFORE INSERT ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_service_order_ref();

DROP TRIGGER IF EXISTS trg_quote_garage_ref ON quotes;
CREATE TRIGGER trg_quote_garage_ref
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_quote_ref();

DROP TRIGGER IF EXISTS trg_invoice_garage_ref ON invoices;
CREATE TRIGGER trg_invoice_garage_ref
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_invoice_ref();

DROP TRIGGER IF EXISTS trg_asp_garage_ref ON asp_purchases;
CREATE TRIGGER trg_asp_garage_ref
  BEFORE INSERT ON asp_purchases
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_asp_ref();

DROP TRIGGER IF EXISTS trg_counter_sale_garage_ref ON counter_sales;
CREATE TRIGGER trg_counter_sale_garage_ref
  BEFORE INSERT ON counter_sales
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_counter_sale_ref();

DROP TRIGGER IF EXISTS trg_ot_status_history ON service_orders;
CREATE TRIGGER trg_ot_status_history
  AFTER INSERT OR UPDATE OF status ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_ot_status_history();

DROP TRIGGER IF EXISTS trg_payment_invoice ON payments;
CREATE TRIGGER trg_payment_invoice
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_invoice_recalc();

DROP TRIGGER IF EXISTS trg_stock_alert ON parts_catalog;
CREATE TRIGGER trg_stock_alert
  AFTER UPDATE OF qty_in_stock ON parts_catalog
  FOR EACH ROW
  EXECUTE FUNCTION fn_stock_alert();

DROP TRIGGER IF EXISTS trg_vehicle_immob ON vehicle_immobilizations;
CREATE TRIGGER trg_vehicle_immob
  AFTER INSERT OR UPDATE OF resolved_at ON vehicle_immobilizations
  FOR EACH ROW
  EXECUTE FUNCTION fn_vehicle_immob_sync();

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'roles', 'customers', 'vehicles',
    'service_orders', 'technician_observations', 'ot_work_items',
    'quality_controls', 'parts_catalog', 'labor_catalog',
    'quotes', 'invoices', 'asp_purchases', 'counter_sales', 'suppliers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── Vues métier ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_active_ot_dashboard;
DROP VIEW IF EXISTS v_pending_invoices;
DROP VIEW IF EXISTS v_stock_status;
DROP VIEW IF EXISTS v_user_permissions;

CREATE OR REPLACE VIEW v_active_ot_dashboard
WITH (security_invoker = true) AS
SELECT
  so.id,
  so.reference,
  so.status,
  so.priority,
  v.plate_number,
  vm.name AS make,
  vmo.name AS model,
  COALESCE((c.first_name || ' ') || c.last_name, c.company_name) AS customer_name,
  c.phone_primary AS customer_phone,
  so.client_complaint,
  so.opened_at,
  so.promised_at,
  so.estimated_ready_at,
  ROUND(EXTRACT(EPOCH FROM now() - so.opened_at) / 3600, 1) AS hours_open,
  (u1.first_name || ' ') || u1.last_name AS conseiller_name,
  (u2.first_name || ' ') || u2.last_name AS chef_name,
  (SELECT COUNT(*)::INTEGER FROM ot_work_items w
   WHERE w.service_order_id = so.id
     AND w.status = 'COMPLETED'::work_item_status_t) AS works_done,
  (SELECT COUNT(*)::INTEGER FROM ot_work_items w
   WHERE w.service_order_id = so.id) AS works_total,
  vi.reason AS immob_reason,
  vi.immobilized_at AS immob_since,
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
WHERE so.status <> ALL (ARRAY['CLOSED'::ot_status_t, 'CANCELLED'::ot_status_t]);

CREATE OR REPLACE VIEW v_pending_invoices
WITH (security_invoker = true) AS
SELECT
  i.id,
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
ORDER BY i.due_date;

CREATE OR REPLACE VIEW v_stock_status
WITH (security_invoker = true) AS
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
    WHEN p.qty_available <= 0 THEN 'OUT_OF_STOCK'
    WHEN p.qty_available <= p.min_threshold THEN 'LOW'
    WHEN p.max_threshold IS NOT NULL AND p.qty_available >= p.max_threshold THEN 'OVERSTOCK'
    ELSE 'OK'
  END AS stock_status,
  s.name AS preferred_supplier
FROM parts_catalog p
LEFT JOIN suppliers s ON s.id = p.preferred_supplier_id
WHERE p.is_active = true;

CREATE OR REPLACE VIEW v_user_permissions
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
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
WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE'::user_status_t;
