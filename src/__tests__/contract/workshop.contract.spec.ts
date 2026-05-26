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
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER = makeDbUser('tech-1', ['TECHNICIEN'], TECH_PERMS);

const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const OT_ID = '11111111-1111-4111-8111-111111111111';
const VEH_ID = '33333333-3333-4333-8333-333333333333';
const CUST_ID = '22222222-2222-4222-8222-222222222222';
const LABOR_ID = '44444444-4444-4444-8444-444444444444';
const CATALOG_ID = '77777777-7777-4777-8777-777777777777';
const ITEM_ID = '88888888-8888-4888-8888-888888888888';

const OT_STUB = {
  id: OT_ID,
  reference: 'OT-2026-001',
  status: OTStatus.DRAFT,
  vehicleId: VEH_ID,
  customerId: CUST_ID,
  clientComplaint: 'Bruit moteur',
  priority: 'NORMAL',
  mileageIn: 85000,
  version: 1,
  openedBy: 'chef-1',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
};

const ERROR_ENVELOPE = {
  statusCode: expect.any(Number),
  errorCode: expect.any(String),
  message: expect.anything(),
  timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  path: expect.any(String),
};

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
    customer: {
      ...base.customer,
      findUnique: jest.fn(),
    },
    technicianObservation: { create: jest.fn() },
    oTWorkItem: { create: jest.fn(), delete: jest.fn() },
    receptionCheckCatalog: { findMany: jest.fn() },
    receptionCheck: { create: jest.fn() },
    laborCatalog: { findMany: jest.fn().mockResolvedValue([]) },
    qualityControl: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { round: 0 } }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Workshop — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeWorkshopPrismaMock>;

  beforeAll(async () => {
    prisma = makeWorkshopPrismaMock();

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [WorkshopController],
      extraProviders: [
        WorkshopService,
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: getQueueToken('sms-notifications'), useValue: { add: jest.fn() } },
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

  // ── GET /api/workshop/ot ──────────────────────────────────────────────────

  describe('GET /api/workshop/ot', () => {
    it('200 — retourne un tableau', async () => {
      prisma.serviceOrder.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — chaque item contient au minimum { id, status, customerId, vehicleId }', async () => {
      prisma.serviceOrder.findMany.mockResolvedValue([OT_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        status: expect.any(String),
        customerId: expect.any(String),
        vehicleId: expect.any(String),
      });
    });

    it('401 sans token — enveloppe erreur : 5 champs exacts', async () => {
      const res = await request(app.getHttpServer()).get('/api/workshop/ot');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });
  });

  // ── GET /api/workshop/ot/:id ──────────────────────────────────────────────

  describe('GET /api/workshop/ot/:id', () => {
    it('200 — shape : OT avec relations customer, vehicle, workItems, observations, quotes', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue({
        ...OT_STUB,
        customer: { id: CUST_ID, lastName: 'Ngono' },
        vehicle: { id: VEH_ID, plateNumber: 'CE-1234-LT' },
        workItems: [],
        observations: [],
        receptionChecks: [],
        statusHistory: [],
        quotes: [],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/workshop/ot/${OT_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: OT_ID,
        status: OTStatus.DRAFT,
        customer: expect.any(Object),
        vehicle: expect.any(Object),
        workItems: expect.any(Array),
        observations: expect.any(Array),
        receptionChecks: expect.any(Array),
        statusHistory: expect.any(Array),
        quotes: expect.any(Array),
      });
    });

    it('404 — OT inexistant → errorCode Not Found, message introuvable', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get(`/api/workshop/ot/${OT_ID}`)
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

  // ── POST /api/workshop/ot ─────────────────────────────────────────────────

  describe('POST /api/workshop/ot', () => {
    it('201 — shape : { id, status } avec status RECEIVED si mileageIn fourni', async () => {
      prisma._txMock.serviceOrder.create.mockResolvedValue({
        id: OT_ID,
        status: OTStatus.RECEIVED,
        mileageIn: 85000,
      });

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
      expect(res.body).toMatchObject({
        id: expect.any(String),
        status: OTStatus.RECEIVED,
        mileageIn: 85000,
      });
    });

    it('400 (validation) — message string[] avec champ manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ vehicleId: VEH_ID, customerId: CUST_ID }); // clientComplaint manquant

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        errorCode: 'Bad Request',
      });
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.some((m: string) => m.includes('clientComplaint'))).toBe(true);
    });

    it('400 (P2003) — errorCode DB_FOREIGN_KEY', async () => {
      prisma._txMock.serviceOrder.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003',
          clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ vehicleId: VEH_ID, customerId: CUST_ID, clientComplaint: 'Test FK' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });

    it('403 TECHNICIEN sans ORD_CREATE → errorCode Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/workshop/ot')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ vehicleId: VEH_ID, customerId: CUST_ID, clientComplaint: 'Test' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });
  });

  // ── PATCH /api/workshop/ot/:id/status ─────────────────────────────────────

  describe('PATCH /api/workshop/ot/:id/status', () => {
    it('200 — retourne l\'OT avec le nouveau status', async () => {
      const otWithRelations = {
        ...OT_STUB,
        status: OTStatus.DRAFT,
        mileageIn: 85000,
        vehicle: {},
        workItems: [],
        quotes: [{ lines: [] }],
        cancellationReason: null,
        closedAt: null,
      };
      prisma.serviceOrder.findUnique.mockResolvedValue(otWithRelations);
      prisma.serviceOrder.update.mockResolvedValue({
        ...OT_STUB,
        status: OTStatus.RECEIVED,
        version: 2,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/status`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: OTStatus.RECEIVED });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: OT_ID,
        status: OTStatus.RECEIVED,
      });
    });

    it('400 — transition non autorisée → errorCode Bad Request', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue({
        ...OT_STUB,
        status: OTStatus.DRAFT,
        vehicle: {},
        workItems: [],
        quotes: [{ lines: [] }],
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/status`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: OTStatus.IN_PROGRESS });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        errorCode: 'Bad Request',
        message: expect.any(String),
      });
    });

    it('404 — OT inexistant → errorCode Not Found', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/status`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: OTStatus.RECEIVED });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });

  // ── Catalogues ────────────────────────────────────────────────────────────

  describe('GET /api/workshop/labor-catalog', () => {
    it('200 — tableau de prestations { id, label, category }', async () => {
      prisma.laborCatalog.findMany.mockResolvedValue([
        { id: LABOR_ID, code: 'VIDANGE', category: 'ENTRETIEN', descriptionFr: 'Vidange moteur', unitPriceXaf: 15000 },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/workshop/labor-catalog')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        code: expect.any(String),
        descriptionFr: expect.any(String),
      });
    });
  });

  describe('GET /api/workshop/reception-catalog', () => {
    it('200 — tableau de points de contrôle { id, label }', async () => {
      prisma.receptionCheckCatalog.findMany.mockResolvedValue([
        { id: CATALOG_ID, code: 'PNEUS_AV', labelFr: 'Pneus avant', sortOrder: 1 },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/workshop/reception-catalog')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        labelFr: expect.any(String),
      });
    });
  });

  // ── Sous-ressources OT ──────────────────────────────────────────────────────

  describe('POST /api/workshop/ot/:id/observation', () => {
    it('201 — shape : { id, serviceOrderId, description }', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue({
        id: OT_ID,
        status: OTStatus.DIAGNOSING,
        assignedChef: 'chef-1',
      });
      prisma.technicianObservation.create.mockResolvedValue({
        id: 'obs-1',
        serviceOrderId: OT_ID,
        description: 'Fuite huile',
        category: 'MECANIQUE',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/observation`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ description: 'Fuite huile', category: 'MECANIQUE' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        serviceOrderId: OT_ID,
        description: 'Fuite huile',
      });
    });
  });

  describe('POST /api/workshop/ot/:id/work-item', () => {
    it('201 — shape : { id, serviceOrderId, laborCatalogId, unitPriceXaf }', async () => {
      prisma.oTWorkItem.create.mockResolvedValue({
        id: ITEM_ID,
        serviceOrderId: OT_ID,
        laborCatalogId: LABOR_ID,
        unitPriceXaf: 15000,
        quantity: 1,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/work-item`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ laborCatalogId: LABOR_ID, unitPriceXaf: 15000 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        serviceOrderId: OT_ID,
        laborCatalogId: LABOR_ID,
        unitPriceXaf: 15000,
      });
    });
  });

  describe('POST /api/workshop/ot/:id/reception-check', () => {
    it('201 — shape : { id, serviceOrderId, checkItems[] }', async () => {
      prisma.receptionCheckCatalog.findMany.mockResolvedValue([
        { id: CATALOG_ID, isActive: true },
      ]);
      prisma.serviceOrder.update.mockResolvedValue({});
      prisma.receptionCheck.create.mockResolvedValue({
        id: 'rc-1',
        serviceOrderId: OT_ID,
        mileageAtReception: 90000,
        checkItems: [{ id: 'ci-1', catalogId: CATALOG_ID, result: 'NA' }],
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/reception-check`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ mileageAtReception: 90000 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        serviceOrderId: OT_ID,
        checkItems: expect.any(Array),
      });
    });
  });

  describe('POST /api/workshop/ot/:id/quality-control', () => {
    it('201 — shape : { id, round, isApproved, overallResult }', async () => {
      prisma.qualityControl.aggregate.mockResolvedValue({ _max: { round: 1 } });
      prisma.qualityControl.create.mockResolvedValue({
        id: 'qc-1',
        serviceOrderId: OT_ID,
        round: 2,
        isApproved: true,
        overallResult: 'OK',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/workshop/ot/${OT_ID}/quality-control`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ overallResult: 'OK', checklist: [] });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        round: expect.any(Number),
        isApproved: true,
        overallResult: 'OK',
      });
    });
  });

  describe('PATCH /api/workshop/ot/:id/assign', () => {
    it('200 — retourne l\'OT avec assignedChef', async () => {
      prisma.serviceOrder.update.mockResolvedValue({
        ...OT_STUB,
        assignedChef: 'chef-2',
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/assign`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ assignedChefId: 'chef-2' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: OT_ID,
        assignedChef: 'chef-2',
      });
    });

    it('404 (P2025) — errorCode DB_NOT_FOUND', async () => {
      prisma.serviceOrder.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/workshop/ot/${OT_ID}/assign`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ assignedChefId: 'chef-2' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });
  });

  describe('DELETE /api/workshop/ot/:id/work-item/:itemId', () => {
    it('200 — retourne la ligne supprimée { id }', async () => {
      prisma.oTWorkItem.delete.mockResolvedValue({ id: ITEM_ID, serviceOrderId: OT_ID });

      const res = await request(app.getHttpServer())
        .delete(`/api/workshop/ot/${OT_ID}/work-item/${ITEM_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: ITEM_ID });
    });
  });
});
