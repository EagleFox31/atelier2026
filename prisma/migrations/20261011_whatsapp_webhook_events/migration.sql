-- Boîte de réception du webhook WhatsApp Meta (lot 3) : accusés de remise persistés
-- avant la réponse 200, puis appliqués aux notifications client.
-- Idempotent. Les noms d'objets sont ceux que génère Prisma : en prod, `prisma db push`
-- tourne avant ce script et a déjà créé ces objets ; ici on ne crée que ce qui manque.

DO $$ BEGIN CREATE TYPE whatsapp_webhook_event_kind_t AS ENUM ('STATUS', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE whatsapp_webhook_event_outcome_t AS ENUM ('APPLIED', 'NO_CHANGE', 'UNMATCHED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  kind whatsapp_webhook_event_kind_t NOT NULL,
  provider TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  status customer_notification_status_t,
  occurred_at TIMESTAMPTZ NOT NULL,
  error_code TEXT,
  dedup_key TEXT NOT NULL,
  notification_id UUID,
  outcome whatsapp_webhook_event_outcome_t,
  attempts SMALLINT NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  CONSTRAINT whatsapp_webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_webhook_events_notification_id_fkey FOREIGN KEY (notification_id)
    REFERENCES customer_notifications(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_webhook_events_dedup_key_key
  ON whatsapp_webhook_events (dedup_key);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_processed_at_received_at_idx
  ON whatsapp_webhook_events (processed_at, received_at);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_notification_id_idx
  ON whatsapp_webhook_events (notification_id);
