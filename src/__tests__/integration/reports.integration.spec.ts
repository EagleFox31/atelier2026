import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ReportsController } from '../../modules/reports/reports.controller';
import { ReportsService } from '../../modules/reports/reports.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

// ADMIN → bypass total (RequireRole vérifié ici)
const ADMIN_USER  = makeDbUser('admin-1', ['ADMIN'], []);
const ADMIN_TOKEN = signTestToken('admin-1', 1);

// CHEF_ATELIER → n'a pas le rôle ADMIN → 403 sur @RequireRole('ADMIN')
const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);

function makeReportsPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    invoice: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { totalXaf: 500000, amountPaidXaf: 450000 },
      }),
    },
    oTWorkItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('Reports — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeReportsPrismaMock>;

  beforeAll(async () => {
    prisma = makeReportsPrismaMock();

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
      if (where.id === 'chef-1')  return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [ReportsController],
      extraProviders: [ReportsService],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
      if (where.id === 'chef-1')  return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });
  });

  // ─── GET /api/reports/revenue ────────────────────────────────────────────────

  describe('GET /api/reports/revenue', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/reports/revenue');
      expect(res.status).toBe(401);
    });

    it('403 — CHEF_ATELIER (pas ADMIN)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('200 — ADMIN : totalRevenue et totalCollected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalRevenue:   500000,
        totalCollected: 450000,
      });
    });

    it('200 — filtre par startDate et endDate', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue?startDate=2026-01-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ─── GET /api/reports/workshop-performance ───────────────────────────────────

  describe('GET /api/reports/workshop-performance', () => {
    it('403 — CHEF_ATELIER', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('200 — ADMIN : retourne agrégat par technicien', async () => {
      prisma.oTWorkItem.findMany.mockResolvedValue([
        {
          technician: { firstName: 'Jean', lastName: 'Tech' },
          estimatedHours: 3,
          actualHours: 2.5,
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('Jean Tech');
      expect(res.body['Jean Tech']).toMatchObject({
        estimatedHours: 3,
        actualHours:    2.5,
      });
    });
  });
});
