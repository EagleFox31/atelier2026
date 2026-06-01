#!/usr/bin/env node
/**
 * Attend que PostgreSQL accepte des connexions (boot Docker Compose).
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DIRECT_URL ou DATABASE_URL requis');
  process.exit(1);
}

const ssl = url.includes('supabase.com') ? { rejectUnauthorized: false } : false;
const maxAttempts = 30;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const pool = new pg.Pool({ connectionString: url, ssl, max: 1 });
  try {
    await pool.query('SELECT 1');
    console.log(`[db] PostgreSQL prêt (tentative ${attempt}/${maxAttempts})`);
    process.exit(0);
  } catch (err) {
    console.log(`[db] En attente PostgreSQL (${attempt}/${maxAttempts})...`);
    if (attempt === maxAttempts) {
      console.error('[db] Timeout:', err.message);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    await pool.end().catch(() => {});
  }
}
