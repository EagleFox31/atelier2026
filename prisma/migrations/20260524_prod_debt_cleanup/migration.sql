-- Migration: prod debt cleanup — idempotent, safe to re-run
-- Appliquée sur Supabase avant mise en production

-- ─── 1. Unifier fn_next_ref (signature text,text — compatible Prisma dbgenerated) ───
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

-- Supprimer la surcharge ambiguë (text, regclass)
DROP FUNCTION IF EXISTS fn_next_ref(text, regclass);

-- ─── 2. Enums PascalCase orphelins (doublons Prisma, aucune colonne ne les référence) ───
DROP TYPE IF EXISTS "CheckResult";
DROP TYPE IF EXISTS "CustomerType";
DROP TYPE IF EXISTS "ImmobilizationReason";
DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "OTStatus";
DROP TYPE IF EXISTS "PartStatus";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "QuoteStatus";
DROP TYPE IF EXISTS "SMSStatus";
DROP TYPE IF EXISTS "StockMovementType";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "VehicleStatus";

-- ─── 3. Index FK manquants (perf prod — tables petites, IF NOT EXISTS sans CONCURRENTLY) ───
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
  ON role_permissions (permission_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON user_roles (role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_make_id
  ON vehicles (make_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_model_id
  ON vehicles (model_id);

CREATE INDEX IF NOT EXISTS idx_reception_checks_service_order_id
  ON reception_checks (service_order_id);

CREATE INDEX IF NOT EXISTS idx_reception_check_items_catalog_id
  ON reception_check_items (catalog_id);

CREATE INDEX IF NOT EXISTS idx_ot_status_history_changed_by
  ON ot_status_history (changed_by);

CREATE INDEX IF NOT EXISTS idx_quotes_customer_id
  ON quotes (customer_id);

CREATE INDEX IF NOT EXISTS idx_quotes_created_by
  ON quotes (created_by);

CREATE INDEX IF NOT EXISTS idx_quote_lines_part_id
  ON quote_lines (part_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by
  ON stock_movements (performed_by);

CREATE INDEX IF NOT EXISTS idx_asp_purchases_service_order_id
  ON asp_purchases (service_order_id);

CREATE INDEX IF NOT EXISTS idx_invoices_created_by
  ON invoices (created_by);

CREATE INDEX IF NOT EXISTS idx_payments_recorded_by
  ON payments (recorded_by);

CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id
  ON appointments (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_appointments_service_order_id
  ON appointments (service_order_id);
