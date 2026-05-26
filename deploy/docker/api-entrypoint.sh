#!/bin/sh
set -e

# Migrations Supabase via DIRECT_URL (pas prisma migrate deploy — voir docs/comprendre-l-app-101.md)
if [ -n "$DIRECT_URL" ]; then
  echo "[api] Application des migrations (migrate-missing.mjs)..."
  node scripts/migrate-missing.mjs || {
    echo "[api] ATTENTION: migrate-missing a echoue — verifier DIRECT_URL / connectivite"
    exit 1
  }
else
  echo "[api] DIRECT_URL absent — migrations ignorees (dev local uniquement)"
fi

exec "$@"
