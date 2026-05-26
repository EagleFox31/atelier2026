import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersModule } from '../../modules/customers/customers.module';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER = makeDbUser('tech-1', ['TECHNICIEN'],   TECH_PERMS);

const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const CUSTOMER_STUB = {
  id: 'cust-1',
  lastName: 'Ngono',
  firstName: 'Paul',
  companyName: null,
  phonePrimary: '+237690000001',
  phoneSecondary: null,
  email: null,
  customerType: 'INDIVIDUAL',
  address: null,
  city: null,
  isVip: false,
  notes: null,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  deletedAt: null,
};

/** Enveloppe d'erreur produite par AllExceptionsFilter */
const ERROR_ENVELOPE = {
  statusCode: expect.any(Number),
  errorCode: expect.any(String),
  message: expect.anything(),
  timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  path: expect.any(String),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Customers — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeIntegrationPrismaMock>;

  beforeAll(async () => {
    prisma = makeIntegrationPrismaMock();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    ({ app } = await createTestApp({ moduleImports: [CustomersModule], prismaOverride: prisma }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
  });

  // ── GET /api/customers ────────────────────────────────────────────────────

  describe('GET /api/customers', () => {
    it('200 — retourne un tableau', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — chaque item contient au minimum { id, lastName, phonePrimary }', async () => {
      prisma.customer.findMany.mockResolvedValue([CUSTOMER_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        lastName: expect.any(String),
        phonePrimary: expect.any(String),
      });
    });

    it('401 sans token — enveloppe erreur : 5 champs exacts, pas de fuite interne', async () => {
      const res = await request(app.getHttpServer()).get('/api/customers');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('403 TECHNICIEN (pas VEH_CREATE) sur POST → errorCode Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ lastName: 'Ngono', phonePrimary: '+237690000000' });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        ...ERROR_ENVELOPE,
        statusCode: 403,
        errorCode: 'Forbidden',
      });
    });
  });

  // ── POST /api/customers ────────────────────────────────────────────────────

  describe('POST /api/customers', () => {
    it('201 — shape : objet client avec id', async () => {
      prisma.customer.create.mockResolvedValue(CUSTOMER_STUB);

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ lastName: 'Ngono', phonePrimary: '+237690000001' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        lastName: 'Ngono',
        phonePrimary: '+237690000001',
      });
    });

    it('400 (validation) — shape : { statusCode: 400, errorCode: "Bad Request", message: string[], timestamp, path }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ phonePrimary: '+237690000000' }); // lastName manquant

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        errorCode: 'Bad Request',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: '/api/customers',
      });
      // ValidationPipe retourne un tableau d'erreurs
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('400 (validation) — message contient le nom du champ en faute', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ lastName: 'Ngono' }); // phonePrimary manquant

      expect(res.status).toBe(400);
      const messages: string[] = Array.isArray(res.body.message)
        ? res.body.message
        : [res.body.message];
      expect(messages.some((m) => m.includes('phonePrimary'))).toBe(true);
    });

    it('409 (P2002) — shape : { statusCode: 409, errorCode: "DB_CONFLICT", message: string, ... }', async () => {
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
        .send({ lastName: 'Ngono', phonePrimary: '+237690000001' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        errorCode: 'DB_CONFLICT',
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: '/api/customers',
      });
    });

    it('409 (P2002) — message mentionne le champ en conflit', async () => {
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
        .send({ lastName: 'Ngono', phonePrimary: '+237690000001' });

      expect(res.body.message).toContain('phonePrimary');
    });

    it('400 (P2003) — shape : { statusCode: 400, errorCode: "DB_FOREIGN_KEY", ... }', async () => {
      prisma.customer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ lastName: 'Ngono', phonePrimary: '+237690000001' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        errorCode: 'DB_FOREIGN_KEY',
      });
    });
  });

  // ── GET /api/customers/:id ─────────────────────────────────────────────────

  describe('GET /api/customers/:id', () => {
    it('200 — shape : client avec relations vehicles[] et serviceOrders[]', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        ...CUSTOMER_STUB,
        vehicles: [{ id: 'veh-1', plate: 'CE-1234-LT' }],
        serviceOrders: [],
      });

      const res = await request(app.getHttpServer())
        .get('/api/customers/cust-1')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'cust-1',
        lastName: 'Ngono',
        vehicles: expect.any(Array),
        serviceOrders: expect.any(Array),
      });
    });

    it('200 — vehicles est un tableau (même vide)', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        ...CUSTOMER_STUB,
        vehicles: [],
        serviceOrders: [],
      });

      const res = await request(app.getHttpServer())
        .get('/api/customers/cust-1')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.vehicles)).toBe(true);
      expect(Array.isArray(res.body.serviceOrders)).toBe(true);
    });

    it('404 — client inexistant → shape : { statusCode: 404, errorCode: "Not Found", ... }', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/customers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        errorCode: 'Not Found',
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: expect.stringContaining('/api/customers/'),
      });
    });

    it('404 — message métier explicite (pas juste "Not Found")', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/customers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      // Le service lance NotFoundException('Client introuvable')
      expect(res.body.message).toContain('introuvable');
    });
  });

  // ── PATCH /api/customers/:id ───────────────────────────────────────────────

  describe('PATCH /api/customers/:id', () => {
    it('200 — retourne le client mis à jour', async () => {
      const updated = { ...CUSTOMER_STUB, firstName: 'Pierre', updatedAt: new Date().toISOString() };
      prisma.customer.findUnique.mockResolvedValue({ ...CUSTOMER_STUB, vehicles: [], serviceOrders: [] });
      prisma.customer.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/customers/cust-1')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Pierre' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'cust-1', firstName: 'Pierre' });
    });

    it('404 — client inexistant → errorCode "Not Found"', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/api/customers/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });

  // ── DELETE /api/customers/:id ──────────────────────────────────────────────

  describe('DELETE /api/customers/:id', () => {
    it('200 — soft delete : retourne un objet avec deletedAt renseigné', async () => {
      const softDeleted = { ...CUSTOMER_STUB, deletedAt: new Date().toISOString() };
      prisma.customer.findUnique.mockResolvedValue({ ...CUSTOMER_STUB, vehicles: [], serviceOrders: [] });
      prisma.customer.update.mockResolvedValue(softDeleted);

      const res = await request(app.getHttpServer())
        .delete('/api/customers/cust-1')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      // Soft delete → deletedAt non-null
      expect(res.body.deletedAt).not.toBeNull();
    });

    it('404 — client inexistant → enveloppe erreur', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/api/customers/00000000-0000-4000-8000-000000000002')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });
});
