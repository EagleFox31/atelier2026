import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { CounterSalesController } from '../../modules/counter-sales/counter-sales.controller';
import { CounterSalesService } from '../../modules/counter-sales/counter-sales.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

const CAISSIER_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'];
const CAISSIER_USER  = makeDbUser('caisse-1', ['CAISSIER'], CAISSIER_PERMS);
const CAISSIER_TOKEN = signTestToken('caisse-1', 1);

const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'], TECH_PERMS);
const TECH_TOKEN = signTestToken('tech-1', 1);

const PART_ID = '11111111-1111-4111-8111-111111111111';

function makeCounterSalesPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    counterSale: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn(),
    },
    partsCatalog: {
      findFirst: jest.fn().mockResolvedValue({ id: PART_ID }),
    },
  };
}

describe('Counter-Sales — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeCounterSalesPrismaMock>;

  beforeAll(async () => {
    prisma = makeCounterSalesPrismaMock();

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'tech-1')   return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [CounterSalesController],
      extraProviders: [CounterSalesService],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'tech-1')   return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
  });

  // ─── GET /api/counter-sales ──────────────────────────────────────────────────

  describe('GET /api/counter-sales', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/counter-sales');
      expect(res.status).toBe(401);
    });

    it('403 — TECHNICIEN sans FAC_CREATE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/counter-sales')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('200 — liste des ventes comptoir', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── POST /api/counter-sales ─────────────────────────────────────────────────

  describe('POST /api/counter-sales', () => {
    it('400 — lines vide (ArrayMinSize(1))', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ lines: [] });
      expect(res.status).toBe(400);
    });

    it('400 — partId invalide dans une ligne', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          lines: [{ partId: 'not-a-uuid', quantity: 1, unitPriceXaf: 5000 }],
        });
      expect(res.status).toBe(400);
    });

    it('201 — crée une vente avec montants fiscaux corrects', async () => {
      // subtotal = 10000 → taxAmount = 1925 → stamp 0 (10000 + 1925 = 11925 ≤ 20000) → total = 11925
      prisma.counterSale.create.mockResolvedValue({ id: 'cs-1', totalXaf: 11925 });

      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          walkInName: 'Client Anonyme',
          lines: [{ partId: PART_ID, quantity: 1, unitPriceXaf: 10000 }],
        });

      expect(res.status).toBe(201);
      expect(prisma.counterSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            soldBy:       'caisse-1',
            walkInName:   'Client Anonyme',
            subtotalXaf:  10000,
            taxAmountXaf: 1925,
            stampDutyXaf: 0,
            totalXaf:     11925,
          }),
        }),
      );
    });

    it('201 — timbre (1000 XAF) appliqué quand total > 20000 XAF', async () => {
      // subtotal = 20000 → taxAmount = 3850 → stamp = 1000 (20000 + 3850 = 23850 > 20000) → total = 24850
      prisma.counterSale.create.mockResolvedValue({ id: 'cs-2', totalXaf: 24850 });

      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          lines: [{ partId: PART_ID, quantity: 1, unitPriceXaf: 20000 }],
        });

      expect(res.status).toBe(201);
      expect(prisma.counterSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalXaf:  20000,
            taxAmountXaf: 3850,
            stampDutyXaf: 1000,
            totalXaf:     24850,
          }),
        }),
      );
    });
  });
});
