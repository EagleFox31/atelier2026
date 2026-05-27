import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { StockController } from '../../modules/stock/stock.controller';
import { StockService } from '../../modules/stock/stock.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);

const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'], TECH_PERMS);
const TECH_TOKEN = signTestToken('tech-1', 1);

const PART_ID = '11111111-1111-4111-8111-111111111111';
const OT_ID   = '22222222-2222-4222-8222-222222222222';

function makeStockPrismaMock() {
  const base = makeIntegrationPrismaMock();
  const txMock = {
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'sm-1' }),
    },
    aSPPurchase: {
      create: jest.fn().mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' }),
    },
  };
  return {
    ...base,
    partsCatalog: {
      findMany:  jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create:    jest.fn(),
      update:    jest.fn().mockResolvedValue({}),
    },
    stockMovement: { findMany: jest.fn().mockResolvedValue([]) },
    supplier:      { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

describe('Stock — intégration HTTP', () => {
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
        { provide: NotificationsService, useValue: { getUserIdsByRoles: jest.fn().mockResolvedValue([]), createInApp: jest.fn().mockResolvedValue([]) } },
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
  });

  // ─── GET /api/stock/parts ────────────────────────────────────────────────────

  describe('GET /api/stock/parts', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/stock/parts');
      expect(res.status).toBe(401);
    });

    it('200 — liste des pièces actives', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stock/parts')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
    });

    it('200 — lowStock=true → $queryRaw (filtre par seuil SQL)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: PART_ID, reference: 'FLT-001' }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts?lowStock=true')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.partsCatalog.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── GET /api/stock/parts/low-stock ─────────────────────────────────────────

  describe('GET /api/stock/parts/low-stock', () => {
    it('200 — retourne les pièces sous seuil via $queryRaw', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: PART_ID, nameFr: 'Filtre huile' }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/parts/low-stock')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  // ─── GET /api/stock/movements ────────────────────────────────────────────────

  describe('GET /api/stock/movements', () => {
    it('200 — liste des mouvements', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stock/movements')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/stock/suppliers ────────────────────────────────────────────────

  describe('GET /api/stock/suppliers', () => {
    it('200 — filtre isActive:true, tri name asc', async () => {
      prisma.supplier.findMany.mockResolvedValue([{ id: 'sup-1', name: 'Total' }]);

      const res = await request(app.getHttpServer())
        .get('/api/stock/suppliers')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where:   { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  // ─── POST /api/stock/movement ────────────────────────────────────────────────

  describe('POST /api/stock/movement', () => {
    it('403 — TECHNICIEN sans STK_CREATE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ partId: PART_ID, type: 'PURCHASE', quantity: 5 });
      expect(res.status).toBe(403);
    });

    it('201 — enregistre le mouvement (chef)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stock/movement')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ partId: PART_ID, type: 'PURCHASE', quantity: 10 });

      expect(res.status).toBe(201);
      expect(prisma._txMock.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partId:       PART_ID,
            movementType: 'PURCHASE',
            quantity:     10,
            performedBy:  'chef-1',
          }),
        }),
      );
    });
  });

  // ─── POST /api/stock/asp ─────────────────────────────────────────────────────

  describe('POST /api/stock/asp', () => {
    it('201 — crée ASP + 2 mouvements (PURCHASE + OT_CONSUMPTION)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/stock/asp')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          partId:        PART_ID,
          serviceOrderId: OT_ID,
          quantity:      2,
          purchasePrice: 5000,
          salePrice:     7000,
          supplierName:  'Total Lubricants',
        });

      expect(res.status).toBe(201);
      expect(prisma._txMock.aSPPurchase.create).toHaveBeenCalled();
      expect(prisma._txMock.stockMovement.create).toHaveBeenCalledTimes(2);
    });
  });
});
