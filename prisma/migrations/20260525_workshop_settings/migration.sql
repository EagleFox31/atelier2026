-- Paramètres atelier (singleton)
CREATE TABLE IF NOT EXISTS workshop_settings (
  id                      TEXT PRIMARY KEY DEFAULT 'default',
  shop_name               TEXT NOT NULL,
  tagline                 TEXT NOT NULL DEFAULT 'Garage automobile — Yaoundé, Cameroun',
  niu                     TEXT,
  email                   TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  address                 TEXT NOT NULL,
  default_labor_rate_xaf  NUMERIC(15, 2),
  tax_rate_pct            NUMERIC(5, 2) NOT NULL DEFAULT 19.25,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_id           UUID REFERENCES users(id)
);

INSERT INTO workshop_settings (
  id,
  shop_name,
  tagline,
  niu,
  email,
  phone,
  address,
  default_labor_rate_xaf,
  tax_rate_pct
) VALUES (
  'default',
  'ATELIER 2026',
  'Garage automobile — Yaoundé, Cameroun',
  'M012345678901X',
  'contact@atelier2026.cm',
  '+237 699 00 00 00',
  'Bastos, Rue 1.042, Yaoundé, Cameroun',
  15000,
  19.25
) ON CONFLICT (id) DO NOTHING;
