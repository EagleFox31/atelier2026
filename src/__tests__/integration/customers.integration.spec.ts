import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersModule } from '../../modules/customers/customers.module';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'],   TECH_PERMS);

const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const VALID_CUSTOMER = {
  lastName: 'Ngono',
  phonePrimary: '+237690000000',
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Customers — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeIntegrationPrismaMock>;

  beforeAll(async () => {
    prisma = makeIntegrationPrismaMock();

    // Le guard appelle user.findUnique avec { where: { id: userId } }
    // On route vers le bon utilisateur selon le sub du JWT
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({ moduleImports: [CustomersModule], prismaOverride: prisma }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-brancher le routing après clearAllMocks
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
  });

  // ── Groupe 1 : Authentification JWT ──────────────────────────────────────────

  describe('JwtAuthGuard', () => {
    it('401 — aucun token fourni', async () => {
      const res = await request(app.getHttpServer()).get('/api/customers');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Token manquant');
    });

    it('401 — token Bearer invalide (signature incorrecte)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', 'Bearer ce.nest.pas.un.jwt');
      expect(res.status).toBe(401);
    });

    it('401 — token valide mais utilisateur introuvable en DB', async () => {
      const tokenOrphan = signTestToken('user-disparu', 1);
      // findUnique retourne null pour cet id inconnu (déjà configuré dans mockImplementation)

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${tokenOrphan}`);

      expect(res.status).toBe(401);
    });

    it('401 — tokenVersion révoqué (logout effectué côté serveur)', async () => {
      const tokenV1 = signTestToken('chef-1', 1);
      prisma.user.findUnique.mockResolvedValue(
        makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS, { tokenVersion: 2 }), // version DB = 2 ≠ JWT = 1
      );

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${tokenV1}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Session invalide ou expirée');
    });
  });

  // ── Groupe 2 : RBAC (PermissionsGuard) ───────────────────────────────────────

  describe('PermissionsGuard', () => {
    it('403 — TECHNICIEN tente POST /api/customers (nécessite VEH_CREATE)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send(VALID_CUSTOMER);

      expect(res.status).toBe(403);
    });

    it('403 — TECHNICIEN tente PATCH /api/customers/:id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/customers/some-id')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ firstName: 'Hack' });

      expect(res.status).toBe(403);
    });

    it('200 — TECHNICIEN peut GET /api/customers (VEH_VIEW autorisé)', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(200);
    });
  });

  // ── Groupe 3 : ValidationPipe (class-validator) ───────────────────────────────

  describe('ValidationPipe', () => {
    it('400 — champ obligatoire lastName manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ phonePrimary: '+237690000000' }); // lastName absent

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('lastName');
    });

    it('400 — champ obligatoire phonePrimary manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ lastName: 'Ngono' }); // phonePrimary absent

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('phonePrimary');
    });

    it('400 — champ inconnu rejeté (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ ...VALID_CUSTOMER, champInconnu: 'injection' });

      expect(res.status).toBe(400);
    });

    it('400 — email invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ ...VALID_CUSTOMER, email: 'pas-un-email' });

      expect(res.status).toBe(400);
    });

    it('400 — customerType invalide (hors enum)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ ...VALID_CUSTOMER, customerType: 'ROBOT' });

      expect(res.status).toBe(400);
    });
  });

  // ── Groupe 4 : AllExceptionsFilter (erreurs Prisma → codes HTTP) ──────────────

  describe('AllExceptionsFilter', () => {
    it('409 — doublon Prisma P2002 → errorCode DB_CONFLICT', async () => {
      prisma.customer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.7.0',
          meta: { target: ['phonePrimary'] },
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send(VALID_CUSTOMER);

      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('DB_CONFLICT');
      expect(res.body.message).toContain('phonePrimary');
    });

    it('400 — clé étrangère invalide P2003 → errorCode DB_FOREIGN_KEY', async () => {
      prisma.customer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send(VALID_CUSTOMER);

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });
  });

  // ── Groupe 5 : Flux nominal ───────────────────────────────────────────────────

  describe('Happy path', () => {
    it('201 — CHEF_ATELIER crée un client avec les champs obligatoires', async () => {
      const created = { id: 'cust-new', ...VALID_CUSTOMER, createdAt: new Date() };
      prisma.customer.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send(VALID_CUSTOMER);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('cust-new');
      // Le service reçoit exactement le body validé
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ lastName: 'Ngono', phonePrimary: '+237690000000' }),
      });
    });

    it('200 — GET /api/customers retourne la liste', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c-1', lastName: 'Ngono', phonePrimary: '+237690000000' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
