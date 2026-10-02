import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

async function captureState(label) {
  const statusCols = await q(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name IN ('appointments','asp_purchases','ot_work_items')
      AND column_name = 'status'
    ORDER BY table_name
  `);

  const staleChecks = await q(`
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname IN ('asp_purchases_status_check','ot_work_items_status_check')
  `);

  const views = await q(`
    SELECT c.relname,
           c.reloptions,
           CASE WHEN c.reloptions @> ARRAY['security_invoker=true'] THEN true ELSE false END AS security_invoker
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
    ORDER BY c.relname
  `);

  const grants = await q(`
    SELECT grantee, COUNT(DISTINCT table_name) AS table_count,
           string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    GROUP BY grantee
    ORDER BY grantee
  `);

  const enums = await q(`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname IN ('work_item_status_t', 'asp_status_t')
  `);

  const qcRound = await q(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'quality_controls' AND column_name = 'round'
  `);

  const qcUnique = await q(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'quality_controls'::regclass AND contype = 'u'
  `);

  return {
    label,
    capturedAt: new Date().toISOString(),
    statusCols,
    staleChecks,
    views,
    grants,
    enums: enums.map((e) => e.typname),
    qcRound,
    qcUnique: qcUnique.map((c) => c.conname),
  };
}

const label = process.argv[2] || 'snapshot';
const state = await captureState(label);
const outPath = path.join(process.cwd(), 'scripts', `db-state-${label}.json`);
fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
console.log('STATE_WRITTEN:', outPath);
console.log(JSON.stringify(state, null, 2));
await pool.end();
