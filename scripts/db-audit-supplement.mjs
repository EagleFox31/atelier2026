import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (sql) => (await pool.query(sql)).rows;

const out = {
  views: await q(`
    SELECT c.relname, c.reloptions,
           CASE WHEN c.reloptions @> ARRAY['security_invoker=true'] THEN true ELSE false END AS security_invoker
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  `),
  statusColumns: await q(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name IN ('appointments','asp_purchases','ot_work_items','payments')
      AND column_name IN ('status','method')
    ORDER BY table_name, column_name
  `),
  staleChecks: await q(`
    SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname IN ('asp_purchases_status_check','ot_work_items_status_check')
  `),
  fnNextRef: await q(`
    SELECT pg_get_function_identity_arguments(oid) AS args, prosrc
    FROM pg_proc WHERE proname = 'fn_next_ref' ORDER BY 1
  `),
  auditPartition: await q(`
    SELECT c.relname, c.relkind,
           CASE c.relkind WHEN 'p' THEN 'partitioned parent' WHEN 'r' THEN 'table/partition' END AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname LIKE 'audit_logs%'
    ORDER BY c.relname
  `),
  dataApiExposure: await q(`
    SELECT COUNT(*) FILTER (WHERE grantee = 'anon') AS anon_tables,
           COUNT(*) FILTER (WHERE grantee = 'authenticated') AS auth_tables
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND privilege_type = 'SELECT'
  `),
};

console.log(JSON.stringify(out, null, 2));
await pool.end();
