/**
 * reset-demo-data.mjs
 *
 * Supprime toutes les données transactionnelles (clients, véhicules, OTs,
 * devis, factures, paiements, stock, RDV, ventes comptoir, notifications…)
 * en préservant :
 *   - les utilisateurs / rôles / permissions (équipe)
 *   - le catalogue de contrôle réception (receptionCheckCatalog)
 *   - le catalogue de main d'œuvre (laborCatalog)
 *   - le catalogue pièces (partsCatalog) et fournisseurs
 *   - les marques et modèles de véhicules
 *
 * Usage : node scripts/reset-demo-data.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Nettoyage des données transactionnelles…\n');

  // ─── 1. Données financières ──────────────────────────────────────────────────
  const payments      = await prisma.payment.deleteMany();
  console.log(`  ✓ payments          : ${payments.count} supprimés`);

  // invoice_lines cascade depuis invoice
  const invoices      = await prisma.invoice.deleteMany();
  console.log(`  ✓ invoices          : ${invoices.count} supprimés`);

  // quote_lines cascade depuis quote
  const quotes        = await prisma.quote.deleteMany();
  console.log(`  ✓ quotes            : ${quotes.count} supprimés`);

  // ─── 2. Ventes comptoir ──────────────────────────────────────────────────────
  // counter_sale_lines cascade depuis counter_sale
  const counterSales  = await prisma.counterSale.deleteMany();
  console.log(`  ✓ counter_sales     : ${counterSales.count} supprimés`);

  // ─── 3. Stock ────────────────────────────────────────────────────────────────
  const aspPurchases  = await prisma.aSPPurchase.deleteMany();
  console.log(`  ✓ asp_purchases     : ${aspPurchases.count} supprimés`);

  const stockMoves    = await prisma.stockMovement.deleteMany();
  console.log(`  ✓ stock_movements   : ${stockMoves.count} supprimés`);

  // ─── 4. Ordres de travail (enfants d'abord, cascade gère le reste) ───────────
  const qualityCtrl   = await prisma.qualityControl.deleteMany();
  console.log(`  ✓ quality_controls  : ${qualityCtrl.count} supprimés`);

  const workItems     = await prisma.oTWorkItem.deleteMany();
  console.log(`  ✓ ot_work_items     : ${workItems.count} supprimés`);

  // reception_check_items cascade depuis reception_check
  const recChecks     = await prisma.receptionCheck.deleteMany();
  console.log(`  ✓ reception_checks  : ${recChecks.count} supprimés`);

  const observations  = await prisma.technicianObservation.deleteMany();
  console.log(`  ✓ observations      : ${observations.count} supprimés`);

  const statusHistory = await prisma.oTStatusHistory.deleteMany();
  console.log(`  ✓ ot_status_history : ${statusHistory.count} supprimés`);

  const serviceOrders = await prisma.serviceOrder.deleteMany();
  console.log(`  ✓ service_orders    : ${serviceOrders.count} supprimés`);

  // ─── 5. Planning ─────────────────────────────────────────────────────────────
  const appointments  = await prisma.appointment.deleteMany();
  console.log(`  ✓ appointments      : ${appointments.count} supprimés`);

  // ─── 6. Véhicules ────────────────────────────────────────────────────────────
  const immobiliz     = await prisma.vehicleImmobilization.deleteMany();
  console.log(`  ✓ immobilizations   : ${immobiliz.count} supprimés`);

  const vehicles      = await prisma.vehicle.deleteMany();
  console.log(`  ✓ vehicles          : ${vehicles.count} supprimés`);

  // ─── 7. Clients ──────────────────────────────────────────────────────────────
  const customers     = await prisma.customer.deleteMany();
  console.log(`  ✓ customers         : ${customers.count} supprimés`);

  // ─── 8. Logs & notifications ─────────────────────────────────────────────────
  const sms           = await prisma.sMSNotification.deleteMany();
  console.log(`  ✓ sms_notifications : ${sms.count} supprimés`);

  const auditLogs     = await prisma.auditLog.deleteMany();
  console.log(`  ✓ audit_logs        : ${auditLogs.count} supprimés`);

  console.log('\n✅ Base de données prête pour le scénario de démo.\n');
  console.log('Conservé :', [
    'users / roles / permissions',
    'receptionCheckCatalog',
    'laborCatalog',
    'partsCatalog + suppliers',
    'vehicleMakes + vehicleModels',
  ].map(s => `  • ${s}`).join('\n'));
}

main()
  .catch(e => { console.error('❌ Erreur :', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
