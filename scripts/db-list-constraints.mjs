import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`
  SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid IN ('ot_work_items'::regclass, 'asp_purchases'::regclass)
  ORDER BY 1, 2
`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
