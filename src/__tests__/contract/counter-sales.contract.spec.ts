import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { CounterSalesController } from '../../modules/counter-sales/counter-sales.controller';
import { CounterSalesService } from '../../modules/counter-sales/counter-sales.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CAISSIER_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'FAC_CREATE', 'STK_VIEW'];
const TECH_PERMS     = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CAISSIER_USER  = makeDbUser('caisse-1', ['CAISSIER'],   CAISSIER_PERMS);
const TECH_USER      = makeDbUser('tech-1',   ['TECHNICIEN'], TECH_PERMS);
const CAISSIER_TOKEN = signTestToken('caisse-1', 1);
const TECH_TOKEN     = signTestToken('tech-1', 1);

const PART_UUID = '11111111-1111-4111-8111-111111111111';

function makeCounterSalesPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    counterSale: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn(),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Counter-Sales — contrats de réponse HTTP', () => {
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

  // ── GET /api/counter-sales ─────────────────────────────────────────────────

  describe('GET /api/counter-sales', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/counter-sales');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('403 TECHNICIEN (sans FAC_CREATE) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/counter-sales')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('200 — retourne un tableau', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — chaque vente contient { id, subtotalXaf, taxAmountXaf, stampDutyXaf, totalXaf, lines }', async () => {
      prisma.counterSale.findMany.mockResolvedValue([{
        id: 'cs-1', reference: 'VCC-2026-001',
        subtotalXaf: 10000, taxAmountXaf: 1925, stampDutyXaf: 0, totalXaf: 11925,
        soldBy: 'caisse-1',
        customer: null, lines: [], seller: { firstName: 'Jean', lastName: 'Caisse' },
      }]);

      const res = await request(app.getHttpServer())
        .get('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        subtotalXaf: expect.any(Number),
        taxAmountXaf: expect.any(Number),
        stampDutyXaf: expect.any(Number),
        totalXaf: expect.any(Number),
        lines: expect.any(Array),
      });
    });
  });

  // ── POST /api/counter-sales ────────────────────────────────────────────────

  describe('POST /api/counter-sales', () => {
    it('400 validation — lines vide → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ lines: [] });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
    });

    it('400 validation — partId invalide (non-UUID) → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ lines: [{ partId: 'not-a-uuid', quantity: 1, unitPriceXaf: 5000 }] });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
    });

    it('201 — shape fiscale exacte pour subtotal=10000 : taxAmount=1925, stamp=0, total=11925', async () => {
      // subtotal = 10000, TVA = 1925, stamp = 0 (10000+1925=11925 ≤ 20000)
      prisma.counterSale.create.mockResolvedValue({
        id: 'cs-new', reference: 'VCC-2026-002',
        subtotalXaf: 10000, taxAmountXaf: 1925, stampDutyXaf: 0, totalXaf: 11925,
        soldBy: 'caisse-1', lines: [{ id: 'line-1' }],
      });

      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          walkInName: 'Client Anonyme',
          lines: [{ partId: PART_UUID, quantity: 1, unitPriceXaf: 10000 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        subtotalXaf:  10000,
        taxAmountXaf: 1925,
        stampDutyXaf: 0,
        totalXaf:     11925,
        lines:        expect.any(Array),
      });
    });

    it('201 — timbre 1000 XAF quand subtotal+TVA > 20 000 : stamp=1000, total=24850', async () => {
      // subtotal = 20000, TVA = 3850, stamp = 1000 (20000+3850=23850 > 20000)
      prisma.counterSale.create.mockResolvedValue({
        id: 'cs-new2', reference: 'VCC-2026-003',
        subtotalXaf: 20000, taxAmountXaf: 3850, stampDutyXaf: 1000, totalXaf: 24850,
        soldBy: 'caisse-1', lines: [{ id: 'line-2' }],
      });

      const res = await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          lines: [{ partId: PART_UUID, quantity: 1, unitPriceXaf: 20000 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        subtotalXaf:  20000,
        taxAmountXaf: 3850,
        stampDutyXaf: 1000,
        totalXaf:     24850,
      });
    });

    it('201 — soldBy dans la vente correspond à l\'utilisateur authentifié', async () => {
      prisma.counterSale.create.mockResolvedValue({
        id: 'cs-new3', subtotalXaf: 5000, taxAmountXaf: 963,
        stampDutyXaf: 0, totalXaf: 5963, soldBy: 'caisse-1', lines: [],
      });

      await request(app.getHttpServer())
        .post('/api/counter-sales')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ lines: [{ partId: PART_UUID, quantity: 1, unitPriceXaf: 5000 }] });

      expect(prisma.counterSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soldBy: 'caisse-1' }),
        }),
      );
    });
  });
});
