-- Invitations sécurisées des employés par e-mail (#15).
-- Seule l'empreinte SHA-256 du jeton est stockée ; le jeton brut ne vit que dans le lien envoyé.
-- Idempotent : rejouable sans effet (IF NOT EXISTS). Comptes existants : colonnes NULL → statut « none ».
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_token_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_invite_token_hash_key ON public.users(invite_token_hash);
