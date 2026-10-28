-- Opaque WhatsApp contact links; idempotent and scoped to exactly one garage.
CREATE TABLE IF NOT EXISTS garage_contact_links (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  garage_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT garage_contact_links_pkey PRIMARY KEY (id),
  CONSTRAINT garage_contact_links_garage_id_fkey FOREIGN KEY (garage_id)
    REFERENCES garages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT garage_contact_links_notification_id_fkey FOREIGN KEY (notification_id)
    REFERENCES customer_notifications(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS garage_contact_links_token_hash_key ON garage_contact_links (token_hash);
CREATE INDEX IF NOT EXISTS garage_contact_links_notification_id_idx ON garage_contact_links (notification_id);
CREATE INDEX IF NOT EXISTS garage_contact_links_garage_id_idx ON garage_contact_links (garage_id);
