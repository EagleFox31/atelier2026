import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { config } from 'dotenv';

config(); // charge .env

const root    = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'postman/newman-env.json');

// ── 1. Lire les IDs créés par le run précédent ────────────────────────────────

function getEnvValue(values, key) {
  return (values.find(v => v.key === key) || {}).value || '';
}

let previousIds = {};
if (existsSync(envFile)) {
  try {
    const env = JSON.parse(readFileSync(envFile, 'utf8'));
    previousIds = {
      memberId:      getEnvValue(env.values, 'memberId'),
      appointmentId: getEnvValue(env.values, 'appointmentId'),
      saleId:        getEnvValue(env.values, 'saleId'),
      invoiceId:     getEnvValue(env.values, 'invoiceId'),
      quoteId:       getEnvValue(env.values, 'quoteId'),
      otId:          getEnvValue(env.values, 'otId'),
      vehicleId:     getEnvValue(env.values, 'vehicleId'),
      customerId:    getEnvValue(env.values, 'customerId'),
      partId:        getEnvValue(env.values, 'partId'),
    };
  } catch { /* env corrompu, on continue */ }
}

// ── 2. Nettoyage DB (ordre FK inversé) ───────────────────────────────────────

const DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (DIRECT_URL) {
  const pool = new pg.Pool({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Paiements & factures
      if (previousIds.invoiceId) {
        await client.query(`DELETE FROM payments WHERE invoice_id = $1`, [previousIds.invoiceId]);
        await client.query(`DELETE FROM invoice_lines WHERE invoice_id = $1`, [previousIds.invoiceId]);
        await client.query(`DELETE FROM invoices WHERE id = $1`, [previousIds.invoiceId]);
      }
      if (previousIds.quoteId) {
        await client.query(`DELETE FROM quote_lines WHERE quote_id = $1`, [previousIds.quoteId]);
        await client.query(`DELETE FROM quotes WHERE id = $1`, [previousIds.quoteId]);
      }

      // OT et sous-entités
      if (previousIds.otId) {
        await client.query(`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE service_order_id = $1)`, [previousIds.otId]);
        await client.query(`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE service_order_id = $1)`, [previousIds.otId]);
        await client.query(`DELETE FROM invoices WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE service_order_id = $1)`, [previousIds.otId]);
        await client.query(`DELETE FROM quotes WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM ot_work_items WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM technician_observations WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM reception_check_items WHERE reception_check_id IN (SELECT id FROM reception_checks WHERE service_order_id = $1)`, [previousIds.otId]);
        await client.query(`DELETE FROM reception_checks WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM quality_controls WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM ot_status_history WHERE service_order_id = $1`, [previousIds.otId]);
        await client.query(`DELETE FROM service_orders WHERE id = $1`, [previousIds.otId]);
      }

      // Ventes comptoir
      if (previousIds.saleId) {
        await client.query(`DELETE FROM counter_sale_lines WHERE counter_sale_id = $1`, [previousIds.saleId]);
        await client.query(`DELETE FROM counter_sales WHERE id = $1`, [previousIds.saleId]);
      }

      // Rendez-vous
      if (previousIds.appointmentId) {
        await client.query(`DELETE FROM appointments WHERE id = $1`, [previousIds.appointmentId]);
      }

      // Véhicule
      if (previousIds.vehicleId) {
        await client.query(`DELETE FROM vehicles WHERE id = $1`, [previousIds.vehicleId]);
      }

      // Client
      if (previousIds.customerId) {
        await client.query(`DELETE FROM customers WHERE id = $1`, [previousIds.customerId]);
      }

      // Membre de l'équipe (hard-delete pour libérer l'email)
      if (previousIds.memberId) {
        await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [previousIds.memberId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [previousIds.memberId]);
      }

      // Pièce catalogue créée par le test stock
      if (previousIds.partId) {
        await client.query(`DELETE FROM stock_movements WHERE part_id = $1`, [previousIds.partId]);
        await client.query(`DELETE FROM parts_catalog WHERE id = $1`, [previousIds.partId]);
      }

      await client.query('COMMIT');
      console.log('🗑️  Données E2E précédentes supprimées de la base.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('⚠️  Nettoyage DB partiel (certaines tables peut-être absentes) :', err.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('⚠️  Connexion DB impossible, nettoyage ignoré :', err.message);
  } finally {
    await pool.end();
  }
} else {
  console.warn('⚠️  DIRECT_URL absent — nettoyage DB ignoré.');
}

// ── 3. Réinitialiser le fichier d'environnement Newman ────────────────────────

const empty = {
  id: 'atelier-e2e-env',
  name: 'Atelier E2E — État persisté',
  values: [
    'customerId','vehicleId','otId','otStatus','otQcRound','otReceptionDone',
    'quoteId','invoiceId','partId','memberId','memberPhone','appointmentId','saleId',
    'testEmail','testPhone','testPlate','memberEmail','testPartRef',
  ].map(key => ({ key, value: '', enabled: true }))
};

writeFileSync(envFile, JSON.stringify(empty, null, 2));
console.log('✅ Environnement Newman réinitialisé — prochain run repart de zéro.');
