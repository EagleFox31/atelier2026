-- sms_notifications.garage_id
ALTER TABLE public.sms_notifications
  ADD COLUMN IF NOT EXISTS garage_id UUID REFERENCES garages(id);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_garage_id
  ON public.sms_notifications(garage_id);

UPDATE sms_notifications sn
SET garage_id = COALESCE(
  (SELECT so.garage_id FROM service_orders so WHERE so.id = sn.service_order_id),
  (SELECT c.garage_id FROM customers c WHERE c.id = sn.customer_id)
)
WHERE garage_id IS NULL;

-- parts_catalog.reference unique par garage
ALTER TABLE public.parts_catalog DROP CONSTRAINT IF EXISTS parts_catalog_reference_key;

CREATE UNIQUE INDEX IF NOT EXISTS parts_catalog_garage_reference_key
  ON public.parts_catalog (garage_id, reference);
