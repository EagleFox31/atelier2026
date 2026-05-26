#!/usr/bin/env node
/**
 * Audit cohérence statuts devis ↔ OT + définition contrainte SQL.
 * Usage: node scripts/audit-quote-ot-status.mjs
 *
 * Incohérence réelle = OT avancé (IN_PROGRESS+) avec devis encore DRAFT/SENT.
 * BILLED sur OT CLOSED est normal (devis facturé, plus APPROVED).
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

const constraint = await pool.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conname = 'quotes_client_approval_method_check'
`);
console.log('=== CONSTRAINT quotes_client_approval_method_check ===');
console.log(JSON.stringify(constraint.rows, null, 2));

const allQuotes = await pool.query(`
  SELECT
    so.reference AS ot_ref,
    so.status AS ot_status,
    q.reference AS quote_ref,
    q.status AS quote_status,
    q.client_approval_method,
    q.approved_by_client_at IS NOT NULL AS has_approved_at
  FROM quotes q
  JOIN service_orders so ON so.id = q.service_order_id
  ORDER BY so.reference, q.created_at
`);
console.log(`\n=== TOUS LES DEVIS vs OT (${allQuotes.rowCount}) ===`);
console.table(allQuotes.rows);

const otPostApprovalNoApprovedQuote = await pool.query(`
  SELECT so.reference AS ot_ref, so.status AS ot_status,
         array_agg(q.reference || ':' || q.status ORDER BY q.created_at) AS quotes
  FROM service_orders so
  LEFT JOIN quotes q ON q.service_order_id = so.id
  WHERE so.status IN (
    'QUOTE_APPROVED','IN_PROGRESS','QC_PENDING','QC_REJECTED',
    'QC_DONE','READY','INVOICED','CLOSED'
  )
  GROUP BY so.id, so.reference, so.status
  HAVING NOT bool_or(q.status IN ('APPROVED', 'BILLED'))
  ORDER BY so.reference
`);
console.log(`\n=== OT avancé SANS devis APPROVED/BILLED (${otPostApprovalNoApprovedQuote.rowCount}) ===`);
console.table(otPostApprovalNoApprovedQuote.rows);

const quoteApprovedOtNot = await pool.query(`
  SELECT so.reference AS ot_ref, so.status AS ot_status,
         q.reference AS quote_ref, q.status AS quote_status
  FROM quotes q
  JOIN service_orders so ON so.id = q.service_order_id
  WHERE q.status = 'APPROVED'
    AND so.status IN ('DRAFT','RECEIVED','DIAGNOSING','QUOTE_PENDING')
  ORDER BY so.reference
`);
console.log(`\n=== DEVIS APPROVED mais OT pas encore QUOTE_APPROVED+ (${quoteApprovedOtNot.rowCount}) ===`);
console.table(quoteApprovedOtNot.rows);

const otApprovedQuotePending = await pool.query(`
  SELECT so.reference AS ot_ref, so.status AS ot_status,
         q.reference AS quote_ref, q.status AS quote_status
  FROM service_orders so
  JOIN quotes q ON q.service_order_id = so.id
  WHERE so.status IN (
    'QUOTE_APPROVED','IN_PROGRESS','QC_PENDING','QC_REJECTED',
    'QC_DONE','READY','INVOICED','CLOSED'
  )
    AND q.status IN ('DRAFT','SENT')
  ORDER BY so.reference, q.reference
`);
console.log(`\n=== OT avancé mais devis encore DRAFT/SENT (${otApprovedQuotePending.rowCount}) ===`);
console.table(otApprovedQuotePending.rows);

await pool.end();
