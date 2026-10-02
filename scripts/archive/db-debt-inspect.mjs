import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await pool.query(s)).rows;

const defaults = await q(`
  SELECT table_name, column_name, column_default
  FROM information_schema.columns
  WHERE column_default LIKE '%fn_next_ref%'
  ORDER BY table_name
`);

const enumUsage = await q(`
  SELECT c.table_name, c.column_name, c.udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.data_type = 'USER-DEFINED'
  ORDER BY c.udt_name, c.table_name
`);

const orphanEnums = await q(`
  SELECT t.typname
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typtype = 'e'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.udt_name = t.typname
    )
  ORDER BY t.typname
`);

console.log(JSON.stringify({ defaults, enumUsage, orphanEnums }, null, 2));
await pool.end();
