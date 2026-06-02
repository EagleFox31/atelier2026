/**
 * Script de migration pour les tables manquantes.
 * Utilise pool.query() directement (pas de transaction Prisma) — fonctionne avec pgbouncer.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const connString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('supabase.com') ? { rejectUnauthorized: false } : false,
  max: 2,
  connectionTimeoutMillis: 20000,
});

async function q(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function migrateInAppNotifications() {
  const { rows } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='in_app_notifications'
  `);

  if (rows.length > 0) {
    console.log('   ⏭️  Table in_app_notifications existe déjà');
    return;
  }

  await q(`
    CREATE TABLE public.in_app_notifications (
      id               UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      recipient_id     UUID         NOT NULL,
      title            TEXT         NOT NULL,
      body             TEXT         NOT NULL,
      link             TEXT,
      is_read          BOOLEAN      NOT NULL DEFAULT false,
      read_at          TIMESTAMPTZ,
      service_order_id UUID,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT fk_in_app_notif_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_in_app_notif_service_order
        FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE SET NULL
    )
  `);
  await q(`CREATE INDEX idx_in_app_notifications_recipient_read ON public.in_app_notifications(recipient_id, is_read)`);
  await q(`CREATE INDEX idx_in_app_notifications_created_at ON public.in_app_notifications(created_at)`);
  console.log('   ✅ Table in_app_notifications créée');
}

async function main() {
  console.log('🚀 Migration des tables manquantes...\n');

  // ── 1. Enum AppointmentStatus ──────────────────────────────────────────────
  const { rows: enumRows } = await q(`
    SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus'
  `);

  if (enumRows.length === 0) {
    await q(`
      CREATE TYPE "AppointmentStatus" AS ENUM (
        'SCHEDULED', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'
      )
    `);
    console.log('   ✅ Enum AppointmentStatus créé');
  } else {
    console.log('   ⏭️  Enum AppointmentStatus existe déjà');
  }

  // ── 2. Table appointments ──────────────────────────────────────────────────
  const { rows: tableRows } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='appointments'
  `);

  if (tableRows.length === 0) {
    await q(`
      CREATE TABLE public.appointments (
        id               UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        customer_id      UUID         NOT NULL,
        vehicle_id       UUID,
        service_order_id UUID,
        scheduled_at     TIMESTAMPTZ  NOT NULL,
        duration_minutes INT          NOT NULL DEFAULT 60,
        reason           TEXT         NOT NULL,
        status           "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
        notes            TEXT,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT fk_apt_customer      FOREIGN KEY (customer_id)      REFERENCES customers(id),
        CONSTRAINT fk_apt_vehicle       FOREIGN KEY (vehicle_id)       REFERENCES vehicles(id),
        CONSTRAINT fk_apt_service_order FOREIGN KEY (service_order_id) REFERENCES service_orders(id)
      )
    `);
    await q(`CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at)`);
    await q(`CREATE INDEX idx_appointments_customer_id  ON public.appointments(customer_id)`);
    console.log('   ✅ Table appointments créée');
  } else {
    console.log('   ⏭️  Table appointments existe déjà');
  }

  await migrateInAppNotifications();
  await migrateWorkshopSettings();
  await migrateUserOnboarding();
  await migrateUserNewFields();
  await migrateDemoRequests();
  await migrateMultiTenant();
  await migrateGarageIdColumns();
  await migrateMonthlyTargets();
  await migrateDefaultGarageForSeededData();
  await migrateWorkshopLogoUrl();

  console.log('\n✅ Migration terminée.');
}

async function migrateDemoRequests() {
  const { rows: enumRows } = await q(`
    SELECT 1 FROM pg_type WHERE typname = 'demo_request_status_t'
  `);

  if (enumRows.length === 0) {
    await q(`
      CREATE TYPE demo_request_status_t AS ENUM (
        'NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'REJECTED'
      )
    `);
    console.log('   ✅ Enum demo_request_status_t créé');
  } else {
    console.log('   ⏭️  Enum demo_request_status_t existe déjà');
  }

  const { rows: tableRows } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='demo_requests'
  `);

  if (tableRows.length > 0) {
    console.log('   ⏭️  Table demo_requests existe déjà');
    return;
  }

  await q(`
    CREATE TABLE public.demo_requests (
      id             UUID                  NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      full_name      TEXT                  NOT NULL,
      email          TEXT                  NOT NULL,
      phone          TEXT                  NOT NULL,
      garage_name    TEXT                  NOT NULL,
      city           TEXT,
      message        TEXT,
      status         demo_request_status_t NOT NULL DEFAULT 'NEW',
      admin_notes    TEXT,
      handled_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ           NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ           NOT NULL DEFAULT now()
    )
  `);
  await q(`CREATE INDEX idx_demo_requests_status ON public.demo_requests(status)`);
  await q(`CREATE INDEX idx_demo_requests_created_at ON public.demo_requests(created_at)`);
  console.log('   ✅ Table demo_requests créée');
}

async function migrateUserOnboarding() {
  const { rows } = await q(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'onboarding_completed_at'
  `);

  if (rows.length > 0) {
    console.log('   ⏭️  Colonne users.onboarding_completed_at existe déjà');
    return;
  }

  await q(`ALTER TABLE public.users ADD COLUMN onboarding_completed_at TIMESTAMPTZ`);
  console.log('   ✅ Colonne users.onboarding_completed_at ajoutée');
}

async function migrateMultiTenant() {
  // ── Table tenants ──────────────────────────────────────────────────────────
  const { rows: tenantTable } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tenants'
  `);
  if (tenantTable.length === 0) {
    await q(`
      CREATE TABLE public.tenants (
        id         UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        slug       TEXT        NOT NULL UNIQUE,
        name       TEXT        NOT NULL,
        email      TEXT        NOT NULL UNIQUE,
        plan       TEXT        NOT NULL DEFAULT 'starter',
        status     TEXT        NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('   ✅ Table tenants créée');
  } else {
    console.log('   ⏭️  Table tenants existe déjà');
  }

  // ── Table garages ──────────────────────────────────────────────────────────
  const { rows: garageTable } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='garages'
  `);
  if (garageTable.length === 0) {
    await q(`
      CREATE TABLE public.garages (
        id         UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        slug       TEXT        NOT NULL,
        name       TEXT        NOT NULL,
        city       TEXT        NOT NULL,
        address    TEXT        NOT NULL,
        phone      TEXT        NOT NULL,
        niu        TEXT,
        status     TEXT        NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(tenant_id, slug)
      )
    `);
    await q(`CREATE INDEX idx_garages_tenant_id ON public.garages(tenant_id)`);
    console.log('   ✅ Table garages créée');
  } else {
    console.log('   ⏭️  Table garages existe déjà');
  }

  // ── Colonnes FK sur users ──────────────────────────────────────────────────
  const userFkCols = [
    { col: 'tenant_id', sql: 'ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES tenants(id)' },
    { col: 'garage_id', sql: 'ALTER TABLE public.users ADD COLUMN garage_id UUID REFERENCES garages(id)' },
  ];
  for (const { col, sql } of userFkCols) {
    const { rows } = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='${col}'
    `);
    if (rows.length === 0) { await q(sql); console.log(`   ✅ users.${col} ajouté`); }
    else console.log(`   ⏭️  users.${col} existe déjà`);
  }

  // ── Colonne garage_id sur workshop_settings ────────────────────────────────
  const { rows: wsCol } = await q(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workshop_settings' AND column_name='garage_id'
  `);
  if (wsCol.length === 0) {
    await q(`ALTER TABLE public.workshop_settings ADD COLUMN garage_id UUID UNIQUE REFERENCES garages(id)`);
    console.log('   ✅ workshop_settings.garage_id ajouté');
  } else {
    console.log('   ⏭️  workshop_settings.garage_id existe déjà');
  }
}

async function migrateWorkshopLogoUrl() {
  const { rows } = await q(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workshop_settings' AND column_name='logo_url'
  `);
  if (rows.length > 0) { console.log('   ⏭️  workshop_settings.logo_url existe déjà'); return; }
  await q(`ALTER TABLE public.workshop_settings ADD COLUMN logo_url TEXT`);
  console.log('   ✅ workshop_settings.logo_url ajouté');
}

async function migrateDefaultGarageForSeededData() {
  // Vérifie s'il y a des users sans garage
  const { rows: orphans } = await q(`SELECT COUNT(*) FROM users WHERE garage_id IS NULL AND deleted_at IS NULL`);
  if (parseInt(orphans[0].count) === 0) {
    console.log('   ⏭️  Tous les users ont un garage — rien à migrer');
    return;
  }

  // Cherche un tenant/garage existant créé par inscription
  const { rows: existing } = await q(`SELECT id, tenant_id FROM garages ORDER BY created_at ASC LIMIT 1`);

  let garageId, tenantId;

  if (existing.length > 0) {
    // Un garage existe déjà (créé via /inscription) — on utilise le premier
    garageId = existing[0].id;
    tenantId = existing[0].tenant_id;
    console.log(`   ℹ️  Garage existant trouvé (${garageId}) — rattachement des users orphelins`);
  } else {
    // Aucun garage → créer le tenant + garage "default"
    const { rows: tenantRows } = await q(`
      INSERT INTO tenants (slug, name, email, plan, status)
      VALUES ('default', 'Atelier Maître (défaut)', 'admin@atelier.cm', 'starter', 'active')
      ON CONFLICT (slug) DO UPDATE SET slug = tenants.slug
      RETURNING id
    `);
    tenantId = tenantRows[0].id;

    const { rows: garageRows } = await q(`
      INSERT INTO garages (tenant_id, slug, name, city, address, phone, status)
      VALUES ($1, 'principal', 'Garage Principal', 'Yaoundé', 'Bastos, Rue 1.042, Yaoundé', '+237 699 00 00 00', 'active')
      RETURNING id
    `, [tenantId]);
    garageId = garageRows[0].id;
    console.log(`   ✅ Tenant + garage "default" créés`);
  }

  // Rattacher les users orphelins
  const { rowCount: usersUpdated } = await q(`
    UPDATE users SET garage_id = $1, tenant_id = $2
    WHERE garage_id IS NULL AND deleted_at IS NULL
  `, [garageId, tenantId]);
  console.log(`   ✅ ${usersUpdated} user(s) rattaché(s) au garage default`);

  // Rattacher les données opérationnelles orphelines
  const tables = ['customers','vehicles','service_orders','parts_catalog','stock_movements','quotes','invoices','payments','appointments'];
  for (const table of tables) {
    const { rows: hasCol } = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${table}' AND column_name='garage_id'
    `);
    if (hasCol.length === 0) continue;
    const { rowCount } = await q(`UPDATE ${table} SET garage_id = $1 WHERE garage_id IS NULL`, [garageId]);
    if (rowCount > 0) console.log(`   ✅ ${table} : ${rowCount} ligne(s) rattachée(s)`);
  }
}

async function migrateMonthlyTargets() {
  const { rows } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='monthly_targets'
  `);
  if (rows.length > 0) { console.log('   ⏭️  Table monthly_targets existe déjà'); return; }

  await q(`
    CREATE TABLE public.monthly_targets (
      id              UUID          NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      garage_id       UUID          REFERENCES garages(id) ON DELETE CASCADE,
      year            INT           NOT NULL,
      month           INT           NOT NULL CHECK (month BETWEEN 1 AND 12),
      target_xaf      NUMERIC(15,2) NOT NULL,
      created_by_id   UUID          REFERENCES users(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
      UNIQUE(garage_id, year, month)
    )
  `);
  await q(`CREATE INDEX idx_monthly_targets_garage_year ON public.monthly_targets(garage_id, year DESC)`);
  console.log('   ✅ Table monthly_targets créée');
}

async function migrateGarageIdColumns() {
  const tables = [
    'customers', 'vehicles', 'service_orders', 'parts_catalog',
    'stock_movements', 'quotes', 'invoices', 'payments', 'appointments',
  ];
  for (const table of tables) {
    const { rows } = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${table}' AND column_name='garage_id'
    `);
    if (rows.length === 0) {
      await q(`ALTER TABLE public.${table} ADD COLUMN garage_id UUID REFERENCES garages(id)`);
      console.log(`   ✅ ${table}.garage_id ajouté`);
    } else {
      console.log(`   ⏭️  ${table}.garage_id existe déjà`);
    }
  }
}

async function migrateUserNewFields() {
  const checks = [
    { col: 'temp_password',                sql: 'ALTER TABLE public.users ADD COLUMN temp_password TEXT' },
    { col: 'specialty',                    sql: 'ALTER TABLE public.users ADD COLUMN specialty TEXT' },
    { col: 'password_reset_requested_at',  sql: 'ALTER TABLE public.users ADD COLUMN password_reset_requested_at TIMESTAMPTZ' },
  ];

  for (const { col, sql } of checks) {
    const { rows } = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='${col}'
    `);
    if (rows.length > 0) {
      console.log(`   ⏭️  Colonne users.${col} existe déjà`);
    } else {
      await q(sql);
      console.log(`   ✅ Colonne users.${col} ajoutée`);
    }
  }
}

async function migrateWorkshopSettings() {
  const { rows } = await q(`
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='workshop_settings'
  `);

  if (rows.length > 0) {
    console.log('   ⏭️  Table workshop_settings existe déjà');
    return;
  }

  await q(`
    CREATE TABLE public.workshop_settings (
      id                      TEXT PRIMARY KEY DEFAULT 'default',
      shop_name               TEXT NOT NULL,
      tagline                 TEXT NOT NULL DEFAULT 'Garage automobile — Yaoundé, Cameroun',
      niu                     TEXT,
      email                   TEXT NOT NULL,
      phone                   TEXT NOT NULL,
      address                 TEXT NOT NULL,
      default_labor_rate_xaf  NUMERIC(15, 2),
      tax_rate_pct            NUMERIC(5, 2) NOT NULL DEFAULT 19.25,
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by_id           UUID REFERENCES users(id)
    )
  `);

  await q(`
    INSERT INTO workshop_settings (
      id, shop_name, tagline, niu, email, phone, address,
      default_labor_rate_xaf, tax_rate_pct
    ) VALUES (
      'default',
      'Atelier Maître',
      'Garage automobile — Yaoundé, Cameroun',
      'M012345678901X',
      'contact@atelier2026.cm',
      '+237 699 00 00 00',
      'Bastos, Rue 1.042, Yaoundé, Cameroun',
      15000,
      19.25
    ) ON CONFLICT (id) DO NOTHING
  `);

  console.log('   ✅ Table workshop_settings créée');
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => pool.end());
