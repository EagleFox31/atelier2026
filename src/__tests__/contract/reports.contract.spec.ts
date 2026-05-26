import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ReportsController } from '../../modules/reports/reports.controller';
import { ReportsService } from '../../modules/reports/reports.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER  = makeDbUser('admin-1', ['ADMIN'],         []);
const CHEF_PERMS  = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER   = makeDbUser('chef-1',  ['CHEF_ATELIER'], CHEF_PERMS);

const ADMIN_TOKEN = signTestToken('admin-1', 1);
const CHEF_TOKEN  = signTestToken('chef-1', 1);

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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Reports — contrats de réponse HTTP', () => {
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
    prisma.invoice.aggregate.mockResolvedValue({
      _sum: { totalXaf: 500000, amountPaidXaf: 450000 },
    });
    prisma.oTWorkItem.findMany.mockResolvedValue([]);
  });

  // ── GET /api/reports/revenue ───────────────────────────────────────────────

  describe('GET /api/reports/revenue', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/reports/revenue');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('403 CHEF_ATELIER (RequireRole ADMIN) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('200 — shape exacte : { totalRevenue, totalCollected, period: { startDate, endDate } }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalRevenue:   500000,
        totalCollected: 450000,
      });
      expect(res.body.period).toEqual({ startDate: null, endDate: null });
    });

    it('200 — totalRevenue et totalCollected sont des nombres', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(typeof res.body.totalRevenue).toBe('number');
      expect(typeof res.body.totalCollected).toBe('number');
    });

    it('200 avec startDate seule — endDate null explicite', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue?startDate=2026-01-01')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toEqual({ startDate: '2026-01-01', endDate: null });
    });

    it('200 avec dates — period reflète les query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue?startDate=2026-01-01&endDate=2026-05-31')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toEqual({
        startDate: '2026-01-01',
        endDate:   '2026-05-31',
      });
    });

    it('200 — _sum null → totalRevenue=0 et totalCollected=0', async () => {
      prisma.invoice.aggregate.mockResolvedValue({
        _sum: { totalXaf: null, amountPaidXaf: null },
      });

      const res = await request(app.getHttpServer())
        .get('/api/reports/revenue')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.totalRevenue).toBe(0);
      expect(res.body.totalCollected).toBe(0);
    });
  });

  // ── GET /api/reports/workshop-performance ─────────────────────────────────

  describe('GET /api/reports/workshop-performance', () => {
    it('403 CHEF_ATELIER → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('200 — objet vide {} quand aucun work item COMPLETED', async () => {
      prisma.oTWorkItem.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('200 — shape : Record<nomTechnicien, { estimatedHours, actualHours }>', async () => {
      prisma.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 3, actualHours: 2.5, technician: { firstName: 'Jean', lastName: 'Tech' } },
        { estimatedHours: 2, actualHours: 1.5, technician: { firstName: 'Jean', lastName: 'Tech' } },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('Jean Tech');
      expect(res.body['Jean Tech']).toEqual({
        estimatedHours: 5,
        actualHours:    4,
      });
    });

    it('200 — technicien null → regroupé sous "Unassigned"', async () => {
      prisma.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 2, actualHours: 1, technician: null },
        { estimatedHours: 1, actualHours: 1, technician: null },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('Unassigned');
      expect(res.body['Unassigned']).toEqual({
        estimatedHours: 3,
        actualHours:    2,
      });
    });

    it('200 — chaque valeur de performance contient exactement estimatedHours et actualHours', async () => {
      prisma.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 4, actualHours: 3, technician: { firstName: 'Marc', lastName: 'A' } },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/reports/workshop-performance')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      const entry = res.body['Marc A'];
      expect(Object.keys(entry).sort()).toEqual(['actualHours', 'estimatedHours'].sort());
    });
  });
});
