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

async function q(sql) {
  const client = await pool.connect();
  try {
    return await client.query(sql);
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

  console.log('\n✅ Migration terminée.');
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

  await q(`
    ALTER TABLE public.users
      ADD COLUMN onboarding_completed_at TIMESTAMPTZ
  `);

  console.log('   ✅ Colonne users.onboarding_completed_at ajoutée');
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
