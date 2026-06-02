-- Numérotation métier par garage (préfixe tenant + compteur annuel)
-- Ex. SAMSUNG-ATELIER-OT-2026-00001, DEFAULT-DEMO-FAC-2026-00002

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

-- ─── Triggers BEFORE INSERT (remplacent le DEFAULT global si garage connu) ───

CREATE OR REPLACE FUNCTION fn_trg_service_order_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'OT', 'OT');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_order_garage_ref ON service_orders;
CREATE TRIGGER trg_service_order_garage_ref
  BEFORE INSERT ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_service_order_ref();

CREATE OR REPLACE FUNCTION fn_trg_quote_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'DEV', 'DEV');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_garage_ref ON quotes;
CREATE TRIGGER trg_quote_garage_ref
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_quote_ref();

CREATE OR REPLACE FUNCTION fn_trg_invoice_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.reference := fn_next_garage_ref(NEW.garage_id, 'FAC', 'FAC');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_garage_ref ON invoices;
CREATE TRIGGER trg_invoice_garage_ref
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_invoice_ref();

CREATE OR REPLACE FUNCTION fn_trg_asp_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_garage_id UUID;
BEGIN
  SELECT so.garage_id INTO v_garage_id
  FROM service_orders so
  WHERE so.id = NEW.service_order_id;

  NEW.reference := fn_next_garage_ref(v_garage_id, 'ASP', 'ASP');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asp_garage_ref ON asp_purchases;
CREATE TRIGGER trg_asp_garage_ref
  BEFORE INSERT ON asp_purchases
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_asp_ref();

CREATE OR REPLACE FUNCTION fn_trg_counter_sale_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_garage_id UUID;
BEGIN
  SELECT COALESCE(c.garage_id, u.garage_id)
  INTO v_garage_id
  FROM users u
  LEFT JOIN customers c ON c.id = NEW.customer_id
  WHERE u.id = NEW.sold_by;

  NEW.reference := fn_next_garage_ref(v_garage_id, 'VCC', 'VCC');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_counter_sale_garage_ref ON counter_sales;
CREATE TRIGGER trg_counter_sale_garage_ref
  BEFORE INSERT ON counter_sales
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_counter_sale_ref();

-- Initialiser les compteurs à partir des volumes existants (évite les collisions)
INSERT INTO garage_ref_counters (garage_id, ref_kind, ref_year, last_number)
SELECT garage_id, 'OT', 2026, COUNT(*)::int
FROM service_orders
WHERE garage_id IS NOT NULL
  AND opened_at >= '2026-01-01'::timestamptz
GROUP BY garage_id
ON CONFLICT (garage_id, ref_kind, ref_year) DO UPDATE
  SET last_number = GREATEST(garage_ref_counters.last_number, EXCLUDED.last_number);

INSERT INTO garage_ref_counters (garage_id, ref_kind, ref_year, last_number)
SELECT garage_id, 'DEV', 2026, COUNT(*)::int
FROM quotes
WHERE garage_id IS NOT NULL
  AND created_at >= '2026-01-01'::timestamptz
GROUP BY garage_id
ON CONFLICT (garage_id, ref_kind, ref_year) DO UPDATE
  SET last_number = GREATEST(garage_ref_counters.last_number, EXCLUDED.last_number);

INSERT INTO garage_ref_counters (garage_id, ref_kind, ref_year, last_number)
SELECT garage_id, 'FAC', 2026, COUNT(*)::int
FROM invoices
WHERE garage_id IS NOT NULL
  AND created_at >= '2026-01-01'::timestamptz
GROUP BY garage_id
ON CONFLICT (garage_id, ref_kind, ref_year) DO UPDATE
  SET last_number = GREATEST(garage_ref_counters.last_number, EXCLUDED.last_number);
