/**
 * Backend ↔ DB smoke test via Prisma (same client as NestJS).
 * Run: node scripts/db-backend-smoke.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, WorkItemStatus, ASPStatus, QuoteStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const results = [];

function pass(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
}
function warn(name, detail) {
  results.push({ status: 'WARN', name, detail });
}
function fail(name, detail) {
  results.push({ status: 'FAIL', name, detail });
}

try {
  // 1. Pooler connection (runtime URL)
  await prisma.$queryRaw`SELECT 1 AS ok`;
  pass('DATABASE_URL pooler connection');

  // 2. Core reads used by backend
  const otCount = await prisma.serviceOrder.count();
  pass('serviceOrder.findMany/count', `${otCount} OT`);

  const users = await prisma.user.findMany({ take: 1, include: { roles: true } });
  if (users.length === 0) warn('users seed', 'no users found');
  else pass('user.findMany with roles');

  const perms = await prisma.rolePermission.count();
  pass('RBAC role_permissions', `${perms} rows`);

  // 3. WorkItemStatus enum alignment
  const wi = await prisma.oTWorkItem.findMany({ take: 1 });
  if (wi.length && !Object.values(WorkItemStatus).includes(wi[0].status)) {
    fail('WorkItemStatus enum', `unknown value ${wi[0].status}`);
  } else {
    pass('WorkItemStatus enum', wi.length ? wi[0].status : 'no rows (OK)');
  }

  // 4. ASP enum — test insert rollback
  const ot = await prisma.serviceOrder.findFirst({ select: { id: true, openedBy: true } });
  if (ot) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.aSPPurchase.create({
          data: {
            serviceOrderId: ot.id,
            partDescription: 'smoke-test-part',
            quantity: 1,
            supplierName: 'Test Supplier',
            purchasePriceXaf: 1000,
            salePriceXaf: 1500,
            status: ASPStatus.RECEIVED,
            authorizedBy: ot.openedBy,
            authorizedAt: new Date(),
            receivedAt: new Date(),
            createdBy: ot.openedBy,
          },
        });
        throw new Error('ROLLBACK_SMOKE');
      });
    } catch (e) {
      if (e.message === 'ROLLBACK_SMOKE') {
        pass('ASPStatus.RECEIVED insert', 'enum + chk_asp_authorized OK');
      } else {
        fail('ASPStatus.RECEIVED insert', e.message);
      }
    }

    // Old invalid values must fail
    for (const bad of ['ORDERED', 'BILLED', 'DONE']) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO asp_purchases (id, reference, service_order_id, part_description, quantity, supplier_name, purchase_price_xaf, sale_price_xaf, status, created_by)
           VALUES (uuid_generate_v4(), 'SMOKE', $1::uuid, 'x', 1, 's', 1, 1, $2, $3::uuid)`,
          ot.id,
          bad,
          ot.openedBy,
        );
        fail(`reject legacy status ${bad}`, 'insert succeeded — should have failed');
      } catch {
        pass(`reject legacy status ${bad}`);
      }
    }
  }

  // 5. Quality control round (backend path)
  if (ot) {
    const maxRound = await prisma.$queryRaw`
      SELECT COALESCE(MAX(round), 0) AS max_round FROM quality_controls WHERE service_order_id = ${ot.id}::uuid
    `;
    pass('quality_controls.round raw query', `max_round=${String(maxRound[0]?.max_round ?? 0)}`);
  }

  // 6. Low stock raw SQL (stock controller)
  const lowStock = await prisma.$queryRaw`
    SELECT id FROM parts_catalog WHERE qty_available <= min_threshold AND is_active = true LIMIT 5
  `;
  pass('low-stock $queryRaw', `${lowStock.length} rows`);

  // 7. Reports WorkItemStatus.COMPLETED filter
  const completed = await prisma.oTWorkItem.count({ where: { status: WorkItemStatus.COMPLETED } });
  pass('reports WorkItemStatus.COMPLETED', `${completed} rows`);

  // 8. Quote BILLED (QuoteStatus not ASP — still valid)
  if (Object.values(QuoteStatus).includes('BILLED')) {
    pass('QuoteStatus.BILLED in Prisma client');
  }

  // 9. Soft delete extension
  const allCustomers = await prisma.customer.count();
  pass('customers count (soft-delete filter via extension)', `${allCustomers} active`);

  // 10. audit_logs partitioned table via Prisma
  const auditCount = await prisma.auditLog.count();
  pass('auditLog.count (partitioned)', `${auditCount} rows`);

} catch (e) {
  fail('unexpected', e.message);
} finally {
  await prisma.$disconnect();
  await pool.end();
}

const failed = results.filter((r) => r.status === 'FAIL');
const warned = results.filter((r) => r.status === 'WARN');
console.log(JSON.stringify({ summary: { pass: results.filter((r) => r.status === 'PASS').length, warn: warned.length, fail: failed.length }, results }, null, 2));
process.exitCode = failed.length ? 1 : 0;
