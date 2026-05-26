import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const q = async (sql) => (await pool.query(sql)).rows;

const checks = {
  dashboardView: await q('SELECT COUNT(*)::int AS active_ot FROM v_active_ot_dashboard'),
  userPermsView: await q('SELECT COUNT(*)::int AS rows FROM v_user_permissions LIMIT 1'),
  stockView: await q('SELECT COUNT(*)::int AS rows FROM v_stock_status'),
  pendingInvoicesView: await q('SELECT COUNT(*)::int AS rows FROM v_pending_invoices'),
  prismaMigration: await q(`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    WHERE migration_name = '20260523_qc_multi_round_enums'
  `),
  staleChecks: await q(`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('asp_purchases_status_check','ot_work_items_status_check')
  `),
  aspAuthorizedCheck: await q(`
    SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'chk_asp_authorized'
  `),
};

console.log(JSON.stringify(checks, null, 2));
await pool.end();
