#!/bin/sh
set -e

# Base vide : Prisma (tables) → full_schema.sql (triggers, audit partitions, vues) → migrate-missing
if [ -n "$DIRECT_URL" ]; then
  echo "[api] Attente PostgreSQL..."
  node scripts/wait-for-postgres.mjs

  # psql ne comprend pas ?schema=public (paramètre Prisma) — on le retire
  PSQL_URL="${DIRECT_URL%%\?*}"

  # audit_logs doit être une table normale quand prisma db push tourne :
  # s'il est déjà partitionné (full_schema.sql d'un run précédent), on le supprime
  # pour que Prisma le crée en table normale, puis full_schema.sql le convertira.
  psql "$PSQL_URL" -c "
    DO \$\$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'audit_logs' AND c.relkind = 'p'
      ) THEN
        DROP TABLE audit_logs CASCADE;
        RAISE NOTICE 'audit_logs partitionné supprimé (sera recréé par Prisma puis partitionné par full_schema.sql)';
      END IF;
    END \$\$;
  "

  if [ -f prisma/full_schema.sql ]; then
    echo "[api] Pré-init SQL (extensions, séquences, fonctions — erreurs triggers ignorées)..."
    psql "$PSQL_URL" -f prisma/full_schema.sql || true
  else
    echo "[api] ATTENTION: prisma/full_schema.sql absent"
    exit 1
  fi

  echo "[api] Schéma Prisma (db push)..."
  npx prisma db push --accept-data-loss

  echo "[api] SQL métier complet (triggers, audit partitions, vues)..."
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f prisma/full_schema.sql

  echo "[api] Migrations complémentaires (migrate-missing.mjs)..."
  node scripts/migrate-missing.mjs
else
  echo "[api] DIRECT_URL absent — init BDD ignorée"
fi

exec "$@"
