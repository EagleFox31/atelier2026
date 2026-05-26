import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await pool.query(s)).rows;

console.log(JSON.stringify({
  fnNextRef: await q(`SELECT pg_get_function_identity_arguments(oid) args FROM pg_proc WHERE proname = 'fn_next_ref' ORDER BY 1`),
  orphanEnums: await q(`
    SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.udt_name = t.typname)
    ORDER BY 1
  `),
  newIndexes: await q(`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      AND indexname IN ('idx_role_permissions_permission_id','idx_vehicles_make_id','idx_appointments_service_order_id')
  `),
  refSample: await q(`SELECT fn_next_ref('OT', 'seq_ot') AS next_ot`),
  migrations: await q(`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at`),
}, null, 2));
await pool.end();
