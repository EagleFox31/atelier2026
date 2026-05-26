import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

try {
  const tables = await q(`
    SELECT c.relname AS table_name,
           c.reltuples::bigint AS est_rows,
           pg_total_relation_size(c.oid) AS total_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const rls = await q(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const rlsPolicies = await q(`
    SELECT tablename, policyname, cmd,
           qual IS NOT NULL AS has_using,
           with_check IS NOT NULL AS has_with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  const fksNoIndex = await q(`
    SELECT c.conrelid::regclass::text AS table_name,
           c.conname AS fk_name,
           string_agg(a.attname, ', ' ORDER BY u.ord) AS fk_columns
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    GROUP BY c.conrelid, c.conname, c.conkey
    HAVING NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND i.indkey[0:cardinality(c.conkey)-1] @> c.conkey
    )
  `);

  const enums = await q(`
    SELECT t.typname AS enum_name,
           array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `);

  const triggers = await q(`
    SELECT event_object_table AS table_name, trigger_name,
           action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);

  let prismaMigrations = [];
  try {
    prismaMigrations = await q(`
      SELECT migration_name, finished_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 10
    `);
  } catch {
    prismaMigrations = [];
  }

  const seqScans = await q(`
    SELECT relname, seq_scan, idx_scan, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY seq_scan DESC NULLS LAST
    LIMIT 15
  `);

  const exactCounts = await q(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const rowCounts = {};
  for (const { table_name } of exactCounts.slice(0, 40)) {
    if (table_name.startsWith('_')) continue;
    const r = await q(`SELECT COUNT(*)::int AS count FROM "${table_name}"`);
    rowCounts[table_name] = r[0].count;
  }

  console.log(
    JSON.stringify(
      {
        summary: {
          postgres: (await q('SELECT version()'))[0].version.split(',')[0],
          tableCount: tables.length,
          rlsEnabledCount: rls.filter((r) => r.rls_enabled).length,
          rlsDisabledCount: rls.filter((r) => !r.rls_enabled).length,
          rlsPolicyCount: rlsPolicies.length,
          enumCount: enums.length,
          triggerCount: triggers.length,
          fkMissingIndexCount: fksNoIndex.length,
          migrationCount: prismaMigrations.length,
        },
        rowCounts,
        tables,
        rlsDisabledTables: rls.filter((r) => !r.rls_enabled).map((r) => r.table_name),
        rlsPolicies,
        fksNoIndex,
        enums: enums.map((e) => ({ name: e.enum_name, labels: e.labels })),
        triggers,
        recentMigrations: prismaMigrations,
        seqScans,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error('AUDIT_ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
