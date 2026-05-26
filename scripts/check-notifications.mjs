import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)?.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : false,
});

const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM in_app_notifications');
console.log('in_app_notifications count:', countRows[0].n);

const { rows: recent } = await pool.query(`
  SELECT n.title, n.body, n.is_read, n.created_at, u.email
  FROM in_app_notifications n
  JOIN users u ON u.id = n.recipient_id
  ORDER BY n.created_at DESC
  LIMIT 5
`);
console.log('recent notifications:', recent);

const { rows: chefs } = await pool.query(`
  SELECT u.email, r.code
  FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.revoked_at IS NULL AND r.code IN ('CHEF_ATELIER', 'ADMIN')
`);
console.log('chef/admin users:', chefs);

await pool.end();
