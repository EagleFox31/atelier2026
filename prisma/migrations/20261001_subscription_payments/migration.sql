CREATE TABLE IF NOT EXISTS subscription_payments (
  id                      UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider                TEXT        NOT NULL,
  provider_transaction_id TEXT,
  reference               TEXT        NOT NULL UNIQUE,
  plan                    TEXT        NOT NULL,
  billing_cycle           TEXT        NOT NULL,
  garage_count            INTEGER     NOT NULL,
  amount_xaf              INTEGER     NOT NULL,
  currency                TEXT        NOT NULL DEFAULT 'XAF',
  status                  TEXT        NOT NULL DEFAULT 'PENDING',
  provider_status         TEXT,
  authorization_url       TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_payments_provider_transaction_key
    UNIQUE (provider, provider_transaction_id),
  CONSTRAINT subscription_payments_amount_positive
    CHECK (amount_xaf > 0),
  CONSTRAINT subscription_payments_garage_count_positive
    CHECK (garage_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant_status
  ON subscription_payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created_at
  ON subscription_payments (created_at);

CREATE TABLE IF NOT EXISTS subscription_payment_events (
  id                      UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  subscription_payment_id UUID        REFERENCES subscription_payments(id) ON DELETE SET NULL,
  provider                TEXT        NOT NULL,
  fingerprint             TEXT        NOT NULL,
  event_type              TEXT        NOT NULL,
  processed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_payment_events_provider_fingerprint_key
    UNIQUE (provider, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payment_events_payment
  ON subscription_payment_events (subscription_payment_id);
