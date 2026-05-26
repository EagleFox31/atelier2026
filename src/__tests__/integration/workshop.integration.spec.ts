import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { OTStatus, Prisma } from '@prisma/client';
import { WorkshopController } from '../../modules/workshop/workshop.controller';
import { WorkshopService } from '../../modules/workshop/workshop.service';
import { AuditService } from '../../shared/audit/audit.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);

const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];
const TECH_USER = makeDbUser('tech-1', ['TECHNICIEN'], TECH_PERMS);
const TECH_TOKEN = signTestToken('tech-1', 1);

const OT_ID = '11111111-1111-4111-8111-111111111111';
const VEH_ID = '33333333-3333-4333-8333-333333333333';
const CUST_ID = '22222222-2222-4222-8222-222222222222';
const LABOR_ID = '44444444-4444-4444-8444-444444444444';
const CATALOG_ID = '77777777-7777-4777-8777-777777777777';

function makeWorkshopPrismaMock() {
  const base = makeIntegrationPrismaMock();
  const txMock = {
    serviceOrder: {
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: { update: jest.fn() },
  };

  return {
    ...base,
    serviceOrder: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    technicianObservation: { create: jest.fn() },
    oTWorkItem: { create: jest.fn(), delete: jest.fn() },
    receptionCheckCatalog: { findMany: jest.fn() },
    receptionCheck: { create: jest.fn() },
    laborCatalog: { findMany: jest.fn().mockResolvedValue([]) },
    qualityControl: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { round: 1 } }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

describe('Workshop — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeWorkshopPrismaMock>;
  let auditMock: { log: jest.Mock };

  beforeAll(async () => {
    prisma = makeWorkshopPrismaMock();
    auditMock = { log: jest.fn() };

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [WorkshopController],
      extraProviders: [
        WorkshopService,
        { provide: AuditService, useValue: auditMock },
        { provide: getQueueToken('sms-notifications'), useValue: { add: jest.fn() } },
      ],
      prismaOverride: prisma,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });
  });

  describe('POST /api/workshop/ot', () => {
    it('201 — crée un OT en RECEIVED si mileageIn fourni', async () => {
      const created = { id: OT_ID, status: OTStatus.RECEIVED, mileageIn: 85000 };
      prisma._txMock.serviceOrder.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          vehicleId: VEH_ID,
          customerId: CUST_ID,
          clientComplaint: 'Bruit moteur',
          mileageIn: 85000,
        });

      expect(res.status).toBe(201);
      expect(prisma._txMock.serviceOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OTStatus.RECEIVED,
            mileageIn: 85000,
            openedBy: 'chef-1',
          }),
        }),
      );
    });

    it('201 — crée un OT en DRAFT sans mileageIn', async () => {
      prisma._txMock.serviceOrder.create.mockResolvedValue({ id: OT_ID, status: OTStatus.DRAFT });

      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          vehicleId: VEH_ID,
          customerId: CUST_ID,
          clientComplaint: 'Diagnostic à faire',
        });

      expect(res.status).toBe(201);
      expect(prisma._txMock.serviceOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OTStatus.DRAFT }),
        }),
      );
    });
  });

  describe('GET /api/workshop/ot', () => {
    it('filtre par assignedChef pour un TECHNICIEN pur', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
        if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
        return Promise.resolve(null);
      });
      prisma.serviceOrder.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/workshop/ot')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.serviceOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { assignedChef: 'tech-1' } }),
      );
    });
  });

  describe('GET /api/workshop/ot/:id', () => {
    it('404 — OT introuvable', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get(`/api/workshop/ot/${OT_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('introuvable');
    });
  });

  describe('POST /api/workshop/ot/:id/observation', () => {
    it('201 — crée une observation technicien', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue({
        id: OT_ID,
        status: OTStatus.DIAGNOSING,
        assignedChef: 'chef-1',
      });
      prisma.technicianObservation.create.mockResolvedValue({
        id: 'obs-1',
        description: 'Fuite huile',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/observation`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ description: 'Fuite huile', category: 'MECANIQUE' });

      expect(res.status).toBe(201);
      expect(prisma.technicianObservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceOrderId: OT_ID,
            observedBy: 'chef-1',
            description: 'Fuite huile',
          }),
        }),
      );
    });

    it('201 — technicien assigné avec ORD_VIEW uniquement', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
        return Promise.resolve(null);
      });
      prisma.serviceOrder.findUnique.mockResolvedValue({
        id: OT_ID,
        status: OTStatus.DIAGNOSING,
        assignedChef: 'tech-1',
      });
      prisma.technicianObservation.create.mockResolvedValue({
        id: 'obs-2',
        description: 'Batterie 9,4 V',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/observation`)
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ description: 'Batterie 9,4 V', category: 'ELECTRIQUE' });

      expect(res.status).toBe(201);
      expect(prisma.technicianObservation.create).toHaveBeenCalled();
    });
  });

  describe('POST /api/workshop/ot/:id/reception-check', () => {
    it('201 — remonte mileageIn et crée le contrôle réception', async () => {
      prisma.receptionCheckCatalog.findMany.mockResolvedValue([
        { id: CATALOG_ID, isActive: true },
      ]);
      prisma.serviceOrder.update.mockResolvedValue({});
      prisma.receptionCheck.create.mockResolvedValue({ id: 'rc-1', checkItems: [] });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/reception-check`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ mileageAtReception: 90000 });

      expect(res.status).toBe(201);
      expect(prisma.serviceOrder.update).toHaveBeenCalledWith({
        where: { id: OT_ID },
        data: { mileageIn: 90000 },
      });
      expect(prisma.receptionCheck.create).toHaveBeenCalled();
    });
  });

  describe('POST /api/workshop/ot/:id/quality-control', () => {
    it('201 — crée un contrôle qualité avec round incrémenté', async () => {
      prisma.qualityControl.aggregate.mockResolvedValue({ _max: { round: 1 } });
      prisma.qualityControl.create.mockResolvedValue({ id: 'qc-1', round: 2 });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/quality-control`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ overallResult: 'OK', checklist: [] });

      expect(res.status).toBe(201);
      expect(prisma.qualityControl.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceOrderId: OT_ID,
            round: 2,
            isApproved: true,
            performedBy: 'chef-1',
          }),
        }),
      );
    });
  });

  describe('POST /api/workshop/ot/:id/work-item', () => {
    it('201 — ajoute une ligne de travail', async () => {
      prisma.oTWorkItem.create.mockResolvedValue({ id: 'wi-1' });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/work-item`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          laborCatalogId: LABOR_ID,
          unitPriceXaf: 15000,
          quantity: 1,
        });

      expect(res.status).toBe(201);
      expect(prisma.oTWorkItem.create).toHaveBeenCalled();
    });
  });

  // ─── Phase 3 : erreurs Prisma → codes HTTP ───────────────────────────────────

  describe('AllExceptionsFilter — erreurs Prisma remontent en HTTP', () => {
    const makePrismaError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('test error', {
        code,
        clientVersion: '0',
        meta: {},
      });

    it('P2003 — createOT avec vehicleId inexistant → 400 DB_FOREIGN_KEY', async () => {
      prisma._txMock.serviceOrder.create.mockRejectedValue(makePrismaError('P2003'));

      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ vehicleId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', customerId: CUST_ID, clientComplaint: 'Test FK' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });

    it('P2003 — addWorkItem avec laborCatalogId inexistant → 400 DB_FOREIGN_KEY', async () => {
      prisma.oTWorkItem.create.mockRejectedValue(makePrismaError('P2003'));

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/work-item`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ laborCatalogId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', unitPriceXaf: 10000 });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });

    it('P2025 — assignChef sur OT inexistant → 404 DB_NOT_FOUND', async () => {
      prisma.serviceOrder.update.mockRejectedValue(makePrismaError('P2025'));

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/assign`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ assignedChefId: 'chef-2' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });
  });
});
