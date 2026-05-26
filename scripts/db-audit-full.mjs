import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

const prismaModels = [
  'roles', 'permissions', 'role_permissions', 'users', 'user_roles', 'audit_logs',
  'customers', 'vehicle_makes', 'vehicle_models', 'vehicles', 'vehicle_immobilizations',
  'reception_check_catalog', 'service_orders', 'ot_status_history', 'reception_checks',
  'reception_check_items', 'technician_observations', 'labor_catalog', 'ot_work_items',
  'quality_controls', 'suppliers', 'parts_catalog', 'stock_movements', 'quotes', 'quote_lines',
  'asp_purchases', 'invoices', 'invoice_lines', 'payments', 'counter_sales', 'counter_sale_lines',
  'appointments', 'sms_notifications',
];

try {
  const version = (await q('SELECT version()'))[0].version;

  const dbTables = await q(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const dbTableSet = new Set(dbTables.map((t) => t.table_name));

  const extraTables = dbTables
    .map((t) => t.table_name)
    .filter((t) => !prismaModels.includes(t) && !t.startsWith('_'));
  const missingTables = prismaModels.filter((t) => !dbTableSet.has(t));

  const columns = await q(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const pkColumns = await q(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY tc.table_name, kcu.ordinal_position
  `);

  const fks = await q(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.delete_rule,
      rc.update_rule,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  const checks = await q(`
    SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace
    ORDER BY 1, 2
  `);

  const uniques = await q(`
    SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'u' AND connamespace = 'public'::regnamespace
    ORDER BY 1, 2
  `);

  const indexes = await q(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const rls = await q(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const policies = await q(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  `);

  const grants = await q(`
    SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
    GROUP BY grantee, table_name
    ORDER BY grantee, table_name
  `);

  const functions = await q(`
    SELECT
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
      n.nspname AS schema
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public')
    ORDER BY n.nspname, p.proname
  `);

  const triggers = await q(`
    SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation,
           action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);

  const enums = await q(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname ORDER BY t.typname
  `);

  const sequences = await q(`
    SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'
  `);

  let migrations = [];
  try {
    migrations = await q(`
      SELECT migration_name, finished_at, rolled_back_at, applied_steps_count, logs
      FROM _prisma_migrations ORDER BY started_at
    `);
  } catch {
    migrations = [];
  }

  const rowCounts = {};
  for (const t of dbTables.map((x) => x.table_name)) {
    if (t.startsWith('_')) continue;
    const r = await q(`SELECT COUNT(*)::int AS c FROM "${t}"`);
    rowCounts[t] = r[0].c;
  }

  // Integrity checks
  const orphanChecks = [];

  async function orphanCheck(name, sql) {
    try {
      const rows = await q(sql);
      orphanChecks.push({ name, count: rows.length, sample: rows.slice(0, 5) });
    } catch (e) {
      orphanChecks.push({ name, error: e.message });
    }
  }

  await orphanCheck('vehicles → deleted customer', `
    SELECT v.id, v.plate_number, v.customer_id
    FROM vehicles v
    LEFT JOIN customers c ON c.id = v.customer_id AND c.deleted_at IS NULL
    WHERE c.id IS NULL AND v.deleted_at IS NULL
  `);

  await orphanCheck('service_orders → deleted customer', `
    SELECT so.id, so.reference, so.customer_id
    FROM service_orders so
    LEFT JOIN customers c ON c.id = so.customer_id AND c.deleted_at IS NULL
    WHERE c.id IS NULL
  `);

  await orphanCheck('service_orders → deleted vehicle', `
    SELECT so.id, so.reference, so.vehicle_id
    FROM service_orders so
    LEFT JOIN vehicles v ON v.id = so.vehicle_id AND v.deleted_at IS NULL
    WHERE v.id IS NULL
  `);

  await orphanCheck('parts_catalog negative qty_available', `
    SELECT id, reference, qty_in_stock, qty_reserved, qty_available
    FROM parts_catalog WHERE qty_available < 0
  `);

  await orphanCheck('parts_catalog qty_available mismatch', `
    SELECT id, reference, qty_in_stock, qty_reserved, qty_available,
           (qty_in_stock - qty_reserved) AS expected
    FROM parts_catalog
    WHERE qty_available IS DISTINCT FROM (qty_in_stock - qty_reserved)
  `);

  await orphanCheck('users soft-deleted still ACTIVE status', `
    SELECT id, email, status, deleted_at FROM users
    WHERE deleted_at IS NOT NULL AND status = 'ACTIVE'
  `);

  await orphanCheck('payments exceed invoice total', `
    SELECT i.id, i.reference, i.total_xaf, i.amount_paid_xaf, i.balance_xaf,
           COALESCE(SUM(p.amount_xaf), 0) AS sum_payments
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'CONFIRMED'
    GROUP BY i.id
    HAVING COALESCE(SUM(p.amount_xaf), 0) > i.total_xaf
  `);

  await orphanCheck('duplicate customer phone (active)', `
    SELECT phone_primary, COUNT(*) AS cnt
    FROM customers WHERE deleted_at IS NULL
    GROUP BY phone_primary HAVING COUNT(*) > 1
  `);

  await orphanCheck('OT status history without matching order', `
    SELECT h.id, h.service_order_id
    FROM ot_status_history h
    LEFT JOIN service_orders so ON so.id = h.service_order_id
    WHERE so.id IS NULL
  `);

  // Soft delete columns presence
  const softDeleteExpected = ['users', 'customers', 'vehicles'];
  const softDeleteCols = await q(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'deleted_at'
    ORDER BY table_name
  `);

  // audit_logs partitioning
  const auditParent = dbTableSet.has('audit_logs');
  const auditPartitions = dbTables
    .map((t) => t.table_name)
    .filter((t) => t.startsWith('audit_logs_'));

  // Extensions
  const extensions = await q(`SELECT extname, extversion FROM pg_extension ORDER BY extname`);

  // Table sizes
  const sizes = await q(`
    SELECT relname AS table_name,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
           pg_total_relation_size(c.oid) AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 20
  `);

  // Hot query patterns EXPLAIN (read-only)
  const explains = [];
  const explainQueries = [
    ['service_orders by status', `EXPLAIN (FORMAT JSON) SELECT * FROM service_orders WHERE status = 'IN_PROGRESS' ORDER BY opened_at DESC LIMIT 20`],
    ['customers search phone', `EXPLAIN (FORMAT JSON) SELECT * FROM customers WHERE phone_primary LIKE '237%' AND deleted_at IS NULL LIMIT 20`],
    ['parts low stock', `EXPLAIN (FORMAT JSON) SELECT * FROM parts_catalog WHERE qty_available <= min_threshold AND is_active = true`],
    ['role_permissions join', `EXPLAIN (FORMAT JSON) SELECT r.code, p.code FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id LIMIT 50`],
  ];

  for (const [name, sql] of explainQueries) {
    try {
      const r = await q(sql);
      const plan = r[0]['QUERY PLAN'][0]['Plan'];
      explains.push({
        name,
        nodeType: plan['Node Type'],
        totalCost: plan['Total Cost'],
        planRows: plan['Plan Rows'],
        indexName: plan['Index Name'] || plan['Plans']?.[0]?.['Index Name'] || null,
      });
    } catch (e) {
      explains.push({ name, error: e.message });
    }
  }

  // Duplicate enum types (PascalCase vs _t suffix)
  const enumPairs = [];
  const enumNames = enums.map((e) => e.typname);
  for (const e of enums) {
    if (e.typname.endsWith('_t')) continue;
    const mapped = enumNames.find((n) => n === `${e.typname.toLowerCase()}_t` || n.includes(e.typname.toLowerCase()));
  }
  const legacyEnums = enums.filter((e) => !e.typname.endsWith('_t') && e.typname !== 'AppointmentStatus');
  const mappedEnums = enums.filter((e) => e.typname.endsWith('_t'));

  // Compare enum labels between duplicates
  const enumDuplicates = [];
  const pairs = [
    ['UserStatus', 'user_status_t'],
    ['VehicleStatus', 'vehicle_status_t'],
    ['OTStatus', 'ot_status_t'],
    ['CheckResult', 'check_result_t'],
    ['QuoteStatus', 'quote_status_t'],
    ['InvoiceStatus', 'invoice_status_t'],
    ['PaymentMethod', 'payment_method_t'],
    ['StockMovementType', 'stock_movement_type_t'],
    ['PartStatus', 'part_status_t'],
    ['CustomerType', 'customer_type_t'],
    ['SMSStatus', 'sms_status_t'],
    ['ImmobilizationReason', 'immobilization_reason_t'],
    ['AppointmentStatus', null],
  ];
  for (const [a, b] of pairs) {
    const ea = enums.find((e) => e.typname === a);
    const eb = b ? enums.find((e) => e.typname === b) : null;
    if (ea && eb) {
      enumDuplicates.push({
        prisma: a,
        sql: b,
        labelsMatch: JSON.stringify(ea.labels) === JSON.stringify(eb.labels),
        prismaLabels: ea.labels,
        sqlLabels: eb.labels,
      });
    } else if (ea && !eb) {
      enumDuplicates.push({ prisma: a, sql: b, missingSqlEnum: true, prismaLabels: ea.labels });
    }
  }

  // Columns in DB not typical - audit_logs partition key
  const auditLogsCols = columns.filter((c) => c.table_name === 'audit_logs');

  // Grant summary for anon/authenticated
  const publicGrants = grants.filter((g) => ['anon', 'authenticated', 'public'].includes(g.grantee));

  const report = {
    meta: {
      auditedAt: new Date().toISOString(),
      postgres: version.split(',')[0],
      connection: 'DIRECT_URL (port 5432)',
    },
    schema: {
      prismaModelCount: prismaModels.length,
      dbTableCount: dbTables.length,
      extraTables,
      missingTables,
      auditLogsPartitioned: auditPartitions.length > 0,
      auditPartitions,
      softDeleteTables: softDeleteCols.map((c) => c.table_name),
      softDeleteExpected,
    },
    migrations: {
      prismaMigrationRows: migrations.length,
      migrations,
      note: migrations.length === 0 ? 'Schema likely applied via custom_schema.sql, not prisma migrate deploy' : null,
    },
    security: {
      rlsEnabledAll: rls.every((r) => r.rls_enabled),
      rlsWithoutPolicies: rls.filter((r) => r.rls_enabled).length - policies.length,
      policyCount: policies.length,
      policies,
      publicGrants,
      securityDefinerFunctions: functions.filter((f) => f.security === 'SECURITY DEFINER'),
      allFunctions: functions,
    },
    enums: {
      total: enums.length,
      legacyPascalCase: legacyEnums.map((e) => e.typname),
      mappedSql: mappedEnums.map((e) => e.typname),
      duplicateAnalysis: enumDuplicates,
    },
    integrity: {
      orphanChecks,
      checkConstraintCount: checks.length,
      checks: checks.slice(0, 30),
    },
    performance: {
      indexCount: indexes.length,
      explains,
      topSizes: sizes,
      sequences,
    },
    data: {
      rowCounts,
      totals: Object.values(rowCounts).reduce((a, b) => a + b, 0),
    },
    triggers: triggers.map((t) => ({
      table: t.table_name,
      name: t.trigger_name,
      timing: t.action_timing,
      event: t.event_manipulation,
    })),
    extensions: extensions.map((e) => `${e.extname}@${e.extversion}`),
  };

  const outPath = path.join(process.cwd(), 'scripts', 'db-audit-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('REPORT_WRITTEN:', outPath);
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error('AUDIT_FATAL:', e.message);
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await pool.end();
}
