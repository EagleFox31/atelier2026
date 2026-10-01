-- Suspension de tenant portée par subscription_status (et non plus par le statut
-- de chaque utilisateur) : on mémorise le statut à restaurer à la réactivation.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status_before_suspension subscription_status_t;
