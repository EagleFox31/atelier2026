-- Notifications in-app (cloche header) — manquait en base malgré le modèle Prisma
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id               UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id     UUID         NOT NULL,
  title            TEXT         NOT NULL,
  body             TEXT         NOT NULL,
  link             TEXT,
  is_read          BOOLEAN      NOT NULL DEFAULT false,
  read_at          TIMESTAMPTZ,
  service_order_id UUID,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT fk_in_app_notif_recipient
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_in_app_notif_service_order
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_recipient_read
  ON public.in_app_notifications (recipient_id, is_read);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_created_at
  ON public.in_app_notifications (created_at);
