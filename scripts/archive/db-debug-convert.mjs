import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();

async function tryStep(label, sql) {
  try {
    await client.query(sql);
    console.log('OK:', label);
    return true;
  } catch (e) {
    console.error('FAIL:', label, e.message);
    return false;
  }
}

const col = await client.query(`
  SELECT data_type, udt_name FROM information_schema.columns
  WHERE table_name = 'ot_work_items' AND column_name = 'status'
`);
console.log('CURRENT:', col.rows[0]);

await tryStep('drop check', `ALTER TABLE ot_work_items DROP CONSTRAINT IF EXISTS ot_work_items_status_check`);
await tryStep('drop view', `DROP VIEW IF EXISTS v_active_ot_dashboard`);
await tryStep('update done', `UPDATE ot_work_items SET status = 'COMPLETED' WHERE status = 'DONE'`);
await tryStep('drop default', `ALTER TABLE ot_work_items ALTER COLUMN status DROP DEFAULT`);
await tryStep('alter type', `
  ALTER TABLE ot_work_items ALTER COLUMN status TYPE work_item_status_t
  USING CASE status::text
    WHEN 'PENDING'     THEN 'PENDING'::work_item_status_t
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::work_item_status_t
    WHEN 'COMPLETED'   THEN 'COMPLETED'::work_item_status_t
    WHEN 'DONE'        THEN 'COMPLETED'::work_item_status_t
    WHEN 'CANCELLED'   THEN 'CANCELLED'::work_item_status_t
    ELSE 'PENDING'::work_item_status_t
  END
`);

client.release();
await pool.end();
