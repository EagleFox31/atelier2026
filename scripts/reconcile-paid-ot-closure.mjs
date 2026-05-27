#!/usr/bin/env node
/**
 * Rattrapage : factures PAID dont l'OT est encore READY ou INVOICED → CLOSED.
 * Usage: node scripts/reconcile-paid-ot-closure.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const adminRow = await pool.query(
  `SELECT id FROM users WHERE email = 'admin@atelier.cm' AND deleted_at IS NULL LIMIT 1`,
);
const SYSTEM_USER = process.env.RECONCILE_USER_ID ?? adminRow.rows[0]?.id;
if (!SYSTEM_USER) {
  console.error('Utilisateur admin introuvable — définir RECONCILE_USER_ID');
  await pool.end();
  process.exit(1);
}

const rows = await pool.query(`
  SELECT i.id AS invoice_id,
         i.reference AS inv_ref,
         so.id AS ot_id,
         so.reference AS ot_ref,
         so.status AS ot_status,
         so.version
  FROM invoices i
  INNER JOIN service_orders so ON so.id = i.service_order_id
  WHERE i.status = 'PAID'
    AND so.status IN ('READY', 'INVOICED')
  ORDER BY i.paid_at DESC NULLS LAST
`);

if (rows.rowCount === 0) {
  console.log('Aucun OT à rattraper.');
  await pool.end();
  process.exit(0);
}

console.log(`Rattrapage de ${rows.rowCount} OT(s)...`);

for (const row of rows.rows) {
  const reason = `Rattrapage clôture auto — facture ${row.inv_ref} soldée`;
  const affected = await pool.query(
    `
    WITH set_user AS (SELECT set_config('app.current_user_id', $1, true))
    UPDATE service_orders
    SET
      status = 'CLOSED'::ot_status_t,
      version = version + 1,
      closed_at = COALESCE(closed_at, NOW())
    WHERE id = $2::uuid
      AND version = $3
      AND status IN ('READY', 'INVOICED')
    `,
    [SYSTEM_USER, row.ot_id, row.version],
  );

  if (affected.rowCount === 1) {
    await pool.query(
      `
      UPDATE ot_status_history
      SET changed_by = $1::uuid,
          reason = $2
      WHERE service_order_id = $3::uuid
        AND to_status = 'CLOSED'
        AND changed_at >= NOW() - INTERVAL '5 seconds'
      `,
      [SYSTEM_USER, reason, row.ot_id],
    );
    console.log(`  OK ${row.ot_ref} (${row.ot_status} → CLOSED) — ${row.inv_ref}`);
  } else {
    console.warn(`  SKIP ${row.ot_ref} — conflit de version ou statut modifié`);
  }
}

await pool.end();
