import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'prisma', 'migrations', '20260524_prod_debt_cleanup', 'migration.sql'),
  'utf8',
);

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query(`
    INSERT INTO _prisma_migrations (
      id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
    )
    SELECT gen_random_uuid()::text, 'prod-debt-cleanup-20260524', NOW(),
           '20260524_prod_debt_cleanup', NULL, NULL, NOW(), 1
    WHERE NOT EXISTS (
      SELECT 1 FROM _prisma_migrations WHERE migration_name = '20260524_prod_debt_cleanup'
    )
  `);
  await client.query('COMMIT');
  console.log('DEBT_CLEANUP_APPLIED');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('DEBT_CLEANUP_FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
