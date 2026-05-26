import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await pool.query(s)).rows;
console.log(JSON.stringify({
  count: (await pool.query('SELECT COUNT(*)::int c FROM ot_work_items')).rows[0],
  indexes: await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ot_work_items'`),
  triggers: await q(`SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'ot_work_items'`),
  constraints: await q(`SELECT conname, pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid = 'ot_work_items'::regclass`),
}, null, 2));
await pool.end();
