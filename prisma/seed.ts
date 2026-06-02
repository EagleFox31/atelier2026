import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Permission matrix par rôle ───────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN:    ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE', 'FAC_VIEW', 'FAC_PAY'],
  ADMIN:          ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE', 'FAC_VIEW', 'FAC_PAY'],
  CHEF_ATELIER:   ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE', 'FAC_VIEW'],
  TECHNICIEN:     ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'],
  RECEPTIONNISTE: ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'FAC_VIEW'],
  CAISSIER:       ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW', 'FAC_VIEW', 'FAC_PAY'],
  SYSTEM:         ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'],
};

// ─── Utilisateurs de test ─────────────────────────────────────────────────────
const TEST_USERS = [
  { employeeCode: 'EMP-000', firstName: 'Super',  lastName: 'Admin',   email: 'superadmin@atelier.cm', password: 'Atelier2026!', role: 'SUPER_ADMIN' },
  { employeeCode: 'EMP-001', firstName: 'Admin',  lastName: 'Système', email: 'admin@atelier.cm',      password: 'Atelier2026!', role: 'ADMIN' },
  { employeeCode: 'EMP-002', firstName: 'Jean',   lastName: 'Kengne',  email: 'chef@atelier.cm',       password: 'Atelier2026!', role: 'CHEF_ATELIER' },
  { employeeCode: 'EMP-003', firstName: 'Moussa', lastName: 'Traoré',  email: 'tech1@atelier.cm',      password: 'Atelier2026!', role: 'TECHNICIEN' },
  { employeeCode: 'EMP-004', firstName: 'Alice',  lastName: 'Zanga',   email: 'reception@atelier.cm',  password: 'Atelier2026!', role: 'RECEPTIONNISTE' },
  { employeeCode: 'EMP-005', firstName: 'Paul',   lastName: 'Mbarga',  email: 'caisse@atelier.cm',     password: 'Atelier2026!', role: 'CAISSIER' },
  { employeeCode: 'SYS-001', firstName: 'Système', lastName: 'Bot',     email: 'bot@atelier.cm',        password: 'SystemPassword_NoLogin!', role: 'SYSTEM' },
];

async function main() {
  console.log('🌱 Démarrage du seeding...\n');

  // ── 1. Rôles ────────────────────────────────────────────────────────────────
  console.log('→ Rôles...');
  const roles = [
    { code: 'SUPER_ADMIN',    label: 'Super Administrateur', description: 'Accès plateforme complet — au-dessus des ateliers', isSystem: true },
    { code: 'ADMIN',          label: 'Administrateur',        description: 'Accès total au système', isSystem: true },
    { code: 'CHEF_ATELIER',   label: "Chef d'Atelier",        description: "Gestion des OT et de l'équipe", isSystem: true },
    { code: 'TECHNICIEN',     label: 'Technicien',            description: 'Réalisation des travaux', isSystem: true },
    { code: 'RECEPTIONNISTE', label: 'Réceptionniste',        description: 'Accueil client, suivi OT, consultation devis/factures', isSystem: true },
    { code: 'CAISSIER',       label: 'Caissier',              description: 'Encaissement et clôture des OT', isSystem: true },
    { code: 'SYSTEM',         label: 'Compte Système',        description: 'Processus automatisés', isSystem: true },
  ];
  for (const role of roles) {
    await prisma.role.upsert({ where: { code: role.code }, update: {}, create: role });
  }
  console.log(`   ✅ ${roles.length} rôles`);

  // ── 2. Permissions ──────────────────────────────────────────────────────────
  console.log('→ Permissions...');
  const permissions = [
    { code: 'VEH_VIEW',   module: 'VEHICLES', action: 'VIEW',   description: 'Voir les véhicules et clients' },
    { code: 'VEH_CREATE', module: 'VEHICLES', action: 'CREATE', description: 'Créer/modifier véhicules et clients' },
    { code: 'ORD_VIEW',   module: 'WORKSHOP', action: 'VIEW',   description: 'Voir les ordres de travail' },
    { code: 'ORD_CREATE', module: 'WORKSHOP', action: 'CREATE', description: 'Créer/modifier les ordres de travail' },
    { code: 'STK_VIEW',   module: 'STOCK',    action: 'VIEW',   description: 'Voir le stock et les niveaux de réserve' },
    { code: 'STK_CREATE', module: 'STOCK',    action: 'CREATE', description: 'Créer/modifier le catalogue stock, enregistrer mouvements et ASP' },
    { code: 'FAC_CREATE', module: 'BILLING',  action: 'CREATE', description: 'Créer devis, factures et valider devis client' },
    { code: 'FAC_VIEW',   module: 'BILLING',  action: 'VIEW',   description: 'Consulter devis et factures (lecture seule)' },
    { code: 'FAC_PAY',    module: 'BILLING',  action: 'PAY',    description: 'Enregistrer paiements et ventes comptoir' },
  ];
  for (const perm of permissions) {
    await prisma.permission.upsert({ where: { code: perm.code }, update: {}, create: perm });
  }
  console.log(`   ✅ ${permissions.length} permissions`);

  // ── 3. Liaisons rôles ↔ permissions — INSERT raw (évite la transaction composite) ──
  console.log('→ Liaisons rôles ↔ permissions...');
  let rpCount = 0;
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permCode of permCodes) {
      await prisma.$executeRaw`
        INSERT INTO role_permissions (role_id, permission_id, granted_at)
        SELECT r.id, p.id, now()
        FROM roles r, permissions p
        WHERE r.code = ${roleCode} AND p.code = ${permCode}
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `;
      rpCount++;
    }
  }
  console.log(`   ✅ ${rpCount} liaisons`);

  // ── 4. Utilisateurs de test ──────────────────────────────────────────────────
  console.log('→ Utilisateurs de test...');
  for (const u of TEST_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { tempPassword: u.password },
      create: {
        employeeCode: u.employeeCode,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash,
        tempPassword: u.password,
      },
    });
    const role = await prisma.role.findUnique({ where: { code: u.role } });
    if (role) {
      const exists = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, revokedAt: null } });
      if (!exists) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
    }
    console.log(`   ✅ ${u.email} (${u.role})`);
  }

  // ── 5. Catalogue main-d'œuvre ────────────────────────────────────────────────
  console.log("→ Catalogue main-d'œuvre...");
  const labors = [
    { code: 'MO_MEC_01',  category: 'MÉCANIQUE',     descriptionFr: 'Vidange moteur + filtre huile',         unitPriceXaf: 15000, standardHours: 1.0 },
    { code: 'MO_MEC_02',  category: 'MÉCANIQUE',     descriptionFr: 'Changement plaquettes frein avant',      unitPriceXaf: 12000, standardHours: 1.5 },
    { code: 'MO_MEC_03',  category: 'MÉCANIQUE',     descriptionFr: 'Changement courroie de distribution',    unitPriceXaf: 45000, standardHours: 4.0 },
    { code: 'MO_MEC_04',  category: 'MÉCANIQUE',     descriptionFr: 'Remplacement amortisseurs (x2)',         unitPriceXaf: 30000, standardHours: 2.5 },
    { code: 'MO_ELEC_01', category: 'ÉLECTRICITÉ',   descriptionFr: 'Diagnostic valise complet',              unitPriceXaf: 25000, standardHours: 1.0 },
    { code: 'MO_ELEC_02', category: 'ÉLECTRICITÉ',   descriptionFr: 'Remplacement alternateur',               unitPriceXaf: 35000, standardHours: 2.0 },
    { code: 'MO_CLIM_01', category: 'CLIMATISATION', descriptionFr: 'Recharge climatisation + contrôle',      unitPriceXaf: 20000, standardHours: 1.0 },
    { code: 'MO_CARB_01', category: 'CARROSSERIE',   descriptionFr: 'Débosselage aile avant',                 unitPriceXaf: 50000, standardHours: 3.0 },
    { code: 'MO_DIAG_01', category: 'DIAGNOSTIC',    descriptionFr: 'Contrôle technique complet',             unitPriceXaf: 10000, standardHours: 0.5 },
  ];
  for (const labor of labors) {
    await prisma.laborCatalog.upsert({ where: { code: labor.code }, update: {}, create: labor });
  }
  console.log(`   ✅ ${labors.length} prestations`);

  // ── 6. Paramètres atelier (singleton) ───────────────────────────────────────
  console.log('→ Paramètres atelier...');
  await prisma.workshopSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      shopName: 'Atelier Maître',
      tagline: 'Garage automobile — Yaoundé, Cameroun',
      niu: 'M012345678901X',
      email: 'contact@atelier2026.cm',
      phone: '+237 699 00 00 00',
      address: 'Bastos, Rue 1.042, Yaoundé, Cameroun',
      defaultLaborRateXaf: 15000,
      taxRatePct: 19.25,
    },
  });
  console.log('   ✅ workshop_settings (default)');

  console.log('\n✅ Seeding terminé.\n');
  console.log('📋 Comptes de test :');
  console.log('   superadmin@atelier.cm | Atelier2026! | SUPER_ADMIN');
  console.log('   admin@atelier.cm      | Atelier2026! | ADMIN');
  console.log('   chef@atelier.cm       | Atelier2026! | CHEF_ATELIER');
  console.log('   tech1@atelier.cm      | Atelier2026! | TECHNICIEN');
  console.log('   reception@atelier.cm  | Atelier2026! | RECEPTIONNISTE');
  console.log('   caisse@atelier.cm     | Atelier2026! | CAISSIER');
  console.log('   bot@atelier.cm        | [Automatisé] | SYSTEM');
}

main()
  .catch((e) => {
    console.error('❌ Erreur de seeding :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
