-- Onboarding terminé — une fois par compte, tous appareils confondus
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
