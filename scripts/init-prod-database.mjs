#!/usr/bin/env node
/**
 * Initialise une base vide : schéma Prisma + full_schema.sql (triggers, audit partitions, vues)
 * + migrate-missing.mjs. Idempotent sur re-exécution partielle.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!directUrl) {
  console.error('DIRECT_URL ou DATABASE_URL requis');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fullSql = resolve(root, 'prisma/full_schema.sql');

console.log('[db] Attente PostgreSQL...');
execSync('node scripts/wait-for-postgres.mjs', { cwd: root, stdio: 'inherit' });

console.log('[db] Schéma Prisma (db push)...');
execSync('npx prisma db push --accept-data-loss', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: directUrl, DIRECT_URL: directUrl },
});

if (!existsSync(fullSql)) {
  console.error('[db] Fichier introuvable:', fullSql);
  process.exit(1);
}

console.log('[db] SQL métier (full_schema.sql)...');
const psqlCmd = process.platform === 'win32'
  ? `psql "${directUrl}" -v ON_ERROR_STOP=1 -f "${fullSql}"`
  : `psql "${directUrl}" -v ON_ERROR_STOP=1 -f "${fullSql}"`;
try {
  execSync(psqlCmd, { cwd: root, stdio: 'inherit', shell: true });
} catch (err) {
  console.error('[db] psql a échoué — installer postgresql-client (ou utiliser le conteneur API)');
  process.exit(1);
}

console.log('[db] Migrations complémentaires (migrate-missing.mjs)...');
execSync('node scripts/migrate-missing.mjs', { cwd: root, stdio: 'inherit' });

console.log('[db] Initialisation terminée.');
