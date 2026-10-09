-- Notifications client multicanal (WhatsApp d'abord) : historique, consentement,
-- préférences par garage, lien public de devis.
-- Idempotent. Les noms d'objets sont ceux que génère Prisma : en prod, `prisma db push`
-- tourne avant ce script et a déjà créé ces objets ; ici on ne crée que ce qui manque.

DO $$ BEGIN CREATE TYPE notification_channel_t AS ENUM ('WHATSAPP', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE customer_notification_event_t AS ENUM (
  'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER', 'SERVICE_ORDER_RECEIVED', 'QUOTE_APPROVAL_REQUESTED',
  'VEHICLE_READY', 'INVOICE_AVAILABLE', 'INVOICE_PAYMENT_REMINDER', 'PAYMENT_CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE customer_notification_status_t AS ENUM (
  'PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'SIMULATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE consent_status_t AS ENUM ('GRANTED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE consent_source_t AS ENUM ('IN_PERSON', 'SIGNED_FORM', 'PHONE_CALL', 'CUSTOMER_MESSAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  garage_id UUID NOT NULL,
  customer_id UUID,
  event_type customer_notification_event_t NOT NULL,
  idempotency_key TEXT NOT NULL,
  channel notification_channel_t,
  status customer_notification_status_t NOT NULL DEFAULT 'PENDING',
  skip_reason TEXT,
  service_order_id UUID,
  appointment_id UUID,
  quote_id UUID,
  invoice_id UUID,
  payment_id UUID,
  recipient_e164 TEXT,
  lang TEXT,
  template_name TEXT,
  template_language TEXT,
  template_version SMALLINT,
  variables JSONB,
  provider TEXT,
  sender_account_ref TEXT,
  provider_message_id TEXT,
  attempt_count SMALLINT NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  fallback_of_id UUID,
  dispatch_started_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT customer_notifications_garage_id_fkey FOREIGN KEY (garage_id)
    REFERENCES garages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_service_order_id_fkey FOREIGN KEY (service_order_id)
    REFERENCES service_orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_appointment_id_fkey FOREIGN KEY (appointment_id)
    REFERENCES appointments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_quote_id_fkey FOREIGN KEY (quote_id)
    REFERENCES quotes(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_invoice_id_fkey FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_payment_id_fkey FOREIGN KEY (payment_id)
    REFERENCES payments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT customer_notifications_fallback_of_id_fkey FOREIGN KEY (fallback_of_id)
    REFERENCES customer_notifications(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_notifications_garage_id_idempotency_key_key
  ON customer_notifications (garage_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS customer_notifications_provider_provider_message_id_key
  ON customer_notifications (provider, provider_message_id);
CREATE INDEX IF NOT EXISTS customer_notifications_garage_id_created_at_idx
  ON customer_notifications (garage_id, created_at);
CREATE INDEX IF NOT EXISTS customer_notifications_customer_id_created_at_idx
  ON customer_notifications (customer_id, created_at);
CREATE INDEX IF NOT EXISTS customer_notifications_service_order_id_idx
  ON customer_notifications (service_order_id);
CREATE INDEX IF NOT EXISTS customer_notifications_status_created_at_idx
  ON customer_notifications (status, created_at);

CREATE TABLE IF NOT EXISTS customer_channel_consents (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  garage_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  channel notification_channel_t NOT NULL,
  status consent_status_t NOT NULL,
  phone_e164 TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_channel_consents_pkey PRIMARY KEY (id),
  CONSTRAINT customer_channel_consents_garage_id_fkey FOREIGN KEY (garage_id)
    REFERENCES garages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT customer_channel_consents_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_channel_consents_customer_id_channel_key
  ON customer_channel_consents (customer_id, channel);
CREATE INDEX IF NOT EXISTS customer_channel_consents_garage_id_idx
  ON customer_channel_consents (garage_id);

CREATE TABLE IF NOT EXISTS customer_consent_events (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  consent_id UUID NOT NULL,
  action consent_status_t NOT NULL,
  phone_e164 TEXT NOT NULL,
  source consent_source_t NOT NULL,
  consent_text_version TEXT NOT NULL,
  note TEXT,
  recorded_by_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_consent_events_pkey PRIMARY KEY (id),
  CONSTRAINT customer_consent_events_consent_id_fkey FOREIGN KEY (consent_id)
    REFERENCES customer_channel_consents(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT customer_consent_events_recorded_by_id_fkey FOREIGN KEY (recorded_by_id)
    REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS customer_consent_events_consent_id_occurred_at_idx
  ON customer_consent_events (consent_id, occurred_at);

-- Preuve de consentement : le journal ne se modifie jamais (ajout seul).
CREATE OR REPLACE FUNCTION fn_customer_consent_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'customer_consent_events est en ajout seul';
END $$;
DROP TRIGGER IF EXISTS trg_customer_consent_events_append_only ON customer_consent_events;
CREATE TRIGGER trg_customer_consent_events_append_only
  BEFORE UPDATE ON customer_consent_events
  FOR EACH ROW EXECUTE FUNCTION fn_customer_consent_events_append_only();

CREATE TABLE IF NOT EXISTS garage_notification_settings (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  garage_id UUID NOT NULL,
  event_type customer_notification_event_t NOT NULL,
  enabled BOOLEAN NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by_id UUID,
  CONSTRAINT garage_notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT garage_notification_settings_garage_id_fkey FOREIGN KEY (garage_id)
    REFERENCES garages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT garage_notification_settings_updated_by_id_fkey FOREIGN KEY (updated_by_id)
    REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS garage_notification_settings_garage_id_event_type_key
  ON garage_notification_settings (garage_id, event_type);

CREATE TABLE IF NOT EXISTS quote_access_tokens (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  garage_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  notification_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT quote_access_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT quote_access_tokens_garage_id_fkey FOREIGN KEY (garage_id)
    REFERENCES garages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT quote_access_tokens_quote_id_fkey FOREIGN KEY (quote_id)
    REFERENCES quotes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT quote_access_tokens_notification_id_fkey FOREIGN KEY (notification_id)
    REFERENCES customer_notifications(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_access_tokens_token_hash_key
  ON quote_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS quote_access_tokens_quote_id_idx
  ON quote_access_tokens (quote_id);
