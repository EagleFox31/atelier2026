#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const otRef = process.argv[2] ?? 'OT-2026-00076';
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(
  `SELECT so.reference AS ot, so.status AS ot_status,
          q.reference AS quote_ref, q.status AS quote_status,
          i.reference AS invoice_ref, i.status AS invoice_status, i.id AS invoice_id
   FROM service_orders so
   LEFT JOIN quotes q ON q.service_order_id = so.id
   LEFT JOIN invoices i ON i.quote_id = q.id
   WHERE so.reference = $1`,
  [otRef],
);
console.table(r.rows);
await pool.end();
