import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)?.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : false,
});

const { rows: chefs } = await pool.query(`
  SELECT u.id, u.email FROM users u
  JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
  JOIN roles r ON r.id = ur.role_id
  WHERE r.code = 'CHEF_ATELIER' LIMIT 1
`);

if (!chefs[0]) {
  console.error('No chef found');
  process.exit(1);
}

const chefId = chefs[0].id;
console.log('Insert test notif for', chefs[0].email);

await pool.query(
  `INSERT INTO in_app_notifications (recipient_id, title, body, link)
   VALUES ($1, $2, $3, $4)`,
  [chefId, 'Test notification', 'Vérification cloche header', '/workshop'],
);

const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM in_app_notifications');
console.log('count after insert:', rows[0].n);

await pool.end();
