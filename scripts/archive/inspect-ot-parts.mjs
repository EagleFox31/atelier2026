#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const otRef = process.argv[2] ?? 'OT-2026-00076';
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const lines = await pool.query(
  `SELECT so.reference, so.status,
          q.reference AS quote_ref, ql.id AS line_id, ql.line_type,
          ql.part_id, ql.description, ql.part_status, ql.quantity, p.name_fr
   FROM service_orders so
   JOIN quotes q ON q.service_order_id = so.id
   JOIN quote_lines ql ON ql.quote_id = q.id
   LEFT JOIN parts_catalog p ON p.id = ql.part_id
   WHERE so.reference = $1
   ORDER BY ql.sort_order`,
  [otRef],
);
console.log(`=== Lignes devis ${otRef} ===`);
console.table(lines.rows);

const sm = await pool.query(
  `SELECT movement_type, quantity, notes, performed_at
   FROM stock_movements
   WHERE service_order_id = (SELECT id FROM service_orders WHERE reference = $1)
   ORDER BY performed_at`,
  [otRef],
);
console.log('=== Mouvements stock ===');
console.table(sm.rows);

await pool.end();
