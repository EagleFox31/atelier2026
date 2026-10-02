import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (sql) => (await pool.query(sql)).rows;

const views = await q(`
  SELECT viewname, definition
  FROM pg_views
  WHERE schemaname = 'public'
    AND viewname IN ('v_active_ot_dashboard','v_user_permissions','v_stock_status','v_pending_invoices')
  ORDER BY viewname
`);

console.log(JSON.stringify(views, null, 2));
await pool.end();
