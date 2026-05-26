import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VehiclesController } from '../../modules/vehicles/vehicles.controller';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'],   TECH_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const CUST_UUID = '22222222-2222-4222-8222-222222222222';
const VEH_UUID  = '33333333-3333-4333-8333-333333333333';

const VEHICLE_STUB = {
  id: VEH_UUID, plateNumber: 'CE-1234-LT', vin: null, year: 2018,
  color: 'Gris', fuelType: 'DIESEL', customerId: CUST_UUID,
  makeId: null, modelId: null, deletedAt: null,
  createdAt: '2026-01-10T08:00:00.000Z', updatedAt: '2026-01-10T08:00:00.000Z',
  customer: { id: CUST_UUID, lastName: 'Ngono', phonePrimary: '+237690000001' },
  make: null, model: null,
};

function makeVehiclesPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    vehicle: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    vehicleMake:  { findMany: jest.fn().mockResolvedValue([]) },
    vehicleModel: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('Vehicles — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeVehiclesPrismaMock>;

  beforeAll(async () => {
    prisma = makeVehiclesPrismaMock();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    ({ app } = await createTestApp({
      controllers: [VehiclesController],
      extraProviders: [VehiclesService],
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

  describe('GET /api/vehicles', () => {
    it('401 sans token — enveloppe erreur exactement 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/vehicles');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('200 — tableau, chaque item contient { id, plateNumber, customer }', async () => {
      prisma.vehicle.findMany.mockResolvedValue([VEHICLE_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        plateNumber: expect.any(String),
        customer: expect.any(Object),
      });
    });
  });

  describe('GET /api/vehicles/makes', () => {
    it('200 — tableau de marques avec { id, name }', async () => {
      prisma.vehicleMake.findMany.mockResolvedValue([{ id: 'make-1', name: 'Toyota' }]);

      const res = await request(app.getHttpServer())
        .get('/api/vehicles/makes')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    });
  });

  describe('GET /api/vehicles/models', () => {
    it('200 — tableau de modèles', async () => {
      prisma.vehicleModel.findMany.mockResolvedValue([{ id: 'model-1', name: 'Corolla' }]);

      const res = await request(app.getHttpServer())
        .get('/api/vehicles/models')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/vehicles/:id', () => {
    it('200 — shape : { id, plateNumber, customer, serviceOrders[] }', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({
        ...VEHICLE_STUB,
        serviceOrders: [{ id: 'ot-1', reference: 'OT-2026-001', status: 'DRAFT' }],
      });

      const res = await request(app.getHttpServer())
        .get(`/api/vehicles/${VEH_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: VEH_UUID,
        plateNumber: 'CE-1234-LT',
        customer: expect.any(Object),
        serviceOrders: expect.any(Array),
      });
    });

    it('404 — inexistant → { statusCode: 404, errorCode: "Not Found", message contient "introuvable" }', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/vehicles/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        errorCode: 'Not Found',
        message: expect.stringContaining('introuvable'),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        path: expect.stringContaining('/api/vehicles/'),
      });
    });
  });

  describe('POST /api/vehicles', () => {
    it('403 TECHNICIEN (sans VEH_CREATE) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ customerId: CUST_UUID, plateNumber: 'CE-0000-LT' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('400 validation — customerId manquant → message[] contient "customerId"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ plateNumber: 'CE-0000-LT' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.some((m: string) => m.includes('customerId'))).toBe(true);
    });

    it('201 — shape : { id, plateNumber, customerId }', async () => {
      prisma.vehicle.create.mockResolvedValue(VEHICLE_STUB);

      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_UUID, plateNumber: 'CE-1234-LT' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        plateNumber: 'CE-1234-LT',
        customerId: CUST_UUID,
      });
    });

    it('409 (P2002) — doublon → errorCode "DB_CONFLICT", message mentionne le champ', async () => {
      prisma.vehicle.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002', clientVersion: '7.7.0', meta: { target: ['plateNumber'] },
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_UUID, plateNumber: 'CE-1234-LT' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, errorCode: 'DB_CONFLICT' });
      expect(res.body.message).toContain('plateNumber');
    });
  });

  describe('PATCH /api/vehicles/:id', () => {
    it('200 — retourne le véhicule mis à jour', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE_STUB, serviceOrders: [] });
      prisma.vehicle.update.mockResolvedValue({ ...VEHICLE_STUB, color: 'Blanc' });

      const res = await request(app.getHttpServer())
        .patch(`/api/vehicles/${VEH_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ color: 'Blanc' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: VEH_UUID, color: 'Blanc' });
    });

    it('404 — inexistant → errorCode "Not Found"', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/api/vehicles/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ color: 'Noir' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    it('200 — soft delete : deletedAt non-null dans la réponse', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE_STUB, serviceOrders: [] });
      prisma.vehicle.update.mockResolvedValue({ ...VEHICLE_STUB, deletedAt: new Date().toISOString() });

      const res = await request(app.getHttpServer())
        .delete(`/api/vehicles/${VEH_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.deletedAt).not.toBeNull();
    });

    it('404 — inexistant → errorCode "Not Found"', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/api/vehicles/00000000-0000-4000-8000-000000000002')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });
});
