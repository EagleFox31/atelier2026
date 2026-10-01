-- Sécurité des mots de passe (LESSON-2026-008).
-- 1. Changement imposé pour tout compte dont le mot de passe était stocké en clair.
-- 2. Effacement des mots de passe en clair (users.temp_password), qui n'est plus jamais écrit.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

UPDATE public.users
SET must_change_password = true, temp_password = NULL
WHERE temp_password IS NOT NULL;
