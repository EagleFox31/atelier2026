import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { StockController } from '../../modules/stock/stock.controller';
import { StockService } from '../../modules/stock/stock.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'],   TECH_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const PART_ID = '11111111-1111-4111-8111-111111111111';
const OT_ID   = '22222222-2222-4222-8222-222222222222';

const PART_STUB = {
  id: PART_ID, reference: 'FLT-001', nameFr: 'Filtre huile',
  qtyInStock: 10, qtyAvailable: 10, minThreshold: 2,
  category: 'FILTRES', salePriceXaf: 3500, isActive: true,
  supplier: { id: 'sup-1', name: 'Total Lubricants' },
};

function makeStockPrismaMock() {
  const base = makeIntegrationPrismaMock();
  const txMock = {
    stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    aSPPurchase:   { create: jest.fn().mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' }) },
  };
  return {
    ...base,
    partsCatalog: {
      findMany:   jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create:     jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
    stockMovement: { findMany: jest.fn().mockResolvedValue([]) },
    supplier:      { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw:     jest.fn().mockResolvedValue([]),
    $transaction:  jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Stock — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeStockPrismaMock>;

  beforeAll(async () => {
    prisma = makeStockPrismaMock();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    ({ app } = await createTestApp({
      controllers: [StockController],
      extraProviders: [
        StockService,
        { provide: getQueueToken('stock-alerts'), useValue: { add: jest.fn() } },
      ],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    prisma._txMock.stockMovement.create.mockResolvedValue({ id: 'sm-1' });
    prisma._txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' });
  });

  // ── GET /api/stock/parts ───────────────────────────────────────────────────

  describe('GET /api/stock/parts', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/stock/parts');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('200 — tableau de pièces avec { id, reference, nameFr, qtyInStock, supplier }', async () => {
      prisma.partsCatalog.findMany.mockResolvedValue([PART_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        reference: expect.any(String),
        nameFr: expect.any(String),
        qtyInStock: expect.any(Number),
        supplier: expect.any(Object),
      });
    });

    it('200 lowStock=true — utilise $queryRaw (pas findMany)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: PART_ID, reference: 'FLT-001' }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts?lowStock=true')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.partsCatalog.findMany).not.toHaveBeenCalled();
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── GET /api/stock/parts/low-stock ────────────────────────────────────────

  describe('GET /api/stock/parts/low-stock', () => {
    it('200 — tableau de pièces sous seuil via $queryRaw', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: PART_ID, reference: 'FLT-001', name_fr: 'Filtre huile', qty_available: 1, min_threshold: 2 },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts/low-stock')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  // ── GET /api/stock/movements ───────────────────────────────────────────────

  describe('GET /api/stock/movements', () => {
    it('200 — tableau de mouvements avec { id, part, performer }', async () => {
      prisma.stockMovement.findMany.mockResolvedValue([{
        id: 'sm-1', partId: PART_ID, movementType: 'PURCHASE', quantity: 5,
        part: { id: PART_ID, nameFr: 'Filtre huile' },
        performer: { firstName: 'Jean', lastName: 'Tech' },
        serviceOrder: null,
        performedAt: '2026-01-10T10:00:00.000Z',
      }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/movements')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        movementType: expect.any(String),
        quantity: expect.any(Number),
        part: expect.any(Object),
      });
    });
  });

  // ── GET /api/stock/suppliers ───────────────────────────────────────────────

  describe('GET /api/stock/suppliers', () => {
    it('200 — tableau de fournisseurs { id, name }', async () => {
      prisma.supplier.findMany.mockResolvedValue([{ id: 'sup-1', name: 'Total Lubricants', isActive: true }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/suppliers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
      });
    });
  });

  // ── POST /api/stock/movement ───────────────────────────────────────────────

  describe('POST /api/stock/movement', () => {
    it('403 TECHNICIEN sans STK_CREATE → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ partId: PART_ID, type: 'PURCHASE', quantity: 5 });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('201 — shape : { id, partId, movementType, quantity }', async () => {
      prisma._txMock.stockMovement.create.mockResolvedValue({
        id: 'sm-new', partId: PART_ID, movementType: 'PURCHASE', quantity: 5, performedBy: 'chef-1',
      });
      prisma.partsCatalog.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ partId: PART_ID, type: 'PURCHASE', quantity: 5 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        partId: PART_ID,
        movementType: 'PURCHASE',
        quantity: 5,
      });
    });
  });

  // ── POST /api/stock/asp ────────────────────────────────────────────────────

  describe('POST /api/stock/asp', () => {
    it('201 — shape : { id, reference } de l\'ASP créé', async () => {
      prisma._txMock.aSPPurchase.create.mockResolvedValue({
        id: 'asp-new', reference: 'ASP-2026-001',
        partId: PART_ID, serviceOrderId: OT_ID, quantity: 2,
        purchasePriceXaf: 5000, salePriceXaf: 7000, status: 'RECEIVED',
      });

      const res = await request(app.getHttpServer())
        .post('/api/stock/asp')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          partId: PART_ID, serviceOrderId: OT_ID,
          quantity: 2, purchasePrice: 5000, salePrice: 7000, supplierName: 'Express',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        reference: expect.any(String),
        partId: PART_ID,
        quantity: 2,
      });
    });
  });

  // ── GET /api/stock/parts/:id ───────────────────────────────────────────────

  describe('GET /api/stock/parts/:id', () => {
    it('200 — retourne la pièce avec supplier', async () => {
      prisma.partsCatalog.findUnique.mockResolvedValue(PART_STUB);

      const res = await request(app.getHttpServer())
        .get(`/api/stock/parts/${PART_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: PART_ID,
        reference: 'FLT-001',
        supplier: expect.any(Object),
      });
    });

    it('404 — pièce inexistante → errorCode Not Found, message introuvable', async () => {
      prisma.partsCatalog.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        errorCode: 'Not Found',
        message: expect.any(String),
      });
      expect(res.body.message).toContain('introuvable');
    });
  });
});
