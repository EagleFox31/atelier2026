import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE indexdef ILIKE '%status%' AND schemaname = 'public'`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
