import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { VehiclesController } from '../../modules/vehicles/vehicles.controller';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
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

const VEH_ID  = '11111111-1111-4111-8111-111111111111';
const CUST_ID = '22222222-2222-4222-8222-222222222222';
const MAKE_ID = '33333333-3333-4333-8333-333333333333';

function makeVehiclesPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    vehicle: {
      findMany:   jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    vehicleMake:  { findMany: jest.fn().mockResolvedValue([]) },
    vehicleModel: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('Vehicles — intégration HTTP', () => {
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

  // ─── GET /api/vehicles ───────────────────────────────────────────────────────

  describe('GET /api/vehicles', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/vehicles');
      expect(res.status).toBe(401);
    });

    it('200 — liste (chef a VEH_VIEW)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /api/vehicles/makes ─────────────────────────────────────────────────

  describe('GET /api/vehicles/makes', () => {
    it('200 — retourne les marques triées', async () => {
      prisma.vehicleMake.findMany.mockResolvedValue([{ id: MAKE_ID, name: 'Toyota' }]);

      const res = await request(app.getHttpServer())
        .get('/api/vehicles/makes')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prisma.vehicleMake.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  // ─── GET /api/vehicles/models ────────────────────────────────────────────────

  describe('GET /api/vehicles/models', () => {
    it('200 — filtre par makeId quand fourni', async () => {
      prisma.vehicleModel.findMany.mockResolvedValue([{ id: 'model-1', name: 'Corolla' }]);

      const res = await request(app.getHttpServer())
        .get(`/api/vehicles/models?makeId=${MAKE_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.vehicleModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { makeId: MAKE_ID } }),
      );
    });
  });

  // ─── GET /api/vehicles/:id ───────────────────────────────────────────────────

  describe('GET /api/vehicles/:id', () => {
    it('404 — véhicule introuvable (NotFoundException)', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get(`/api/vehicles/${VEH_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('introuvable');
    });
  });

  // ─── POST /api/vehicles ──────────────────────────────────────────────────────

  describe('POST /api/vehicles', () => {
    it('403 — TECHNICIEN sans VEH_CREATE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ customerId: CUST_ID, plateNumber: 'LT-1234' });
      expect(res.status).toBe(403);
    });

    it('400 — customerId manquant (ValidationPipe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ plateNumber: 'LT-1234' });
      expect(res.status).toBe(400);
    });

    it('201 — crée le véhicule', async () => {
      prisma.vehicle.create.mockResolvedValue({ id: VEH_ID, plateNumber: 'LT-1234' });

      const res = await request(app.getHttpServer())
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_ID, plateNumber: 'LT-1234' });

      expect(res.status).toBe(201);
      expect(prisma.vehicle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plateNumber: 'LT-1234', customerId: CUST_ID }),
        }),
      );
    });
  });

  // ─── PATCH /api/vehicles/:id ─────────────────────────────────────────────────

  describe('PATCH /api/vehicles/:id', () => {
    it('200 — met à jour le véhicule', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: VEH_ID, deletedAt: null });
      prisma.vehicle.update.mockResolvedValue({ id: VEH_ID, color: 'Rouge' });

      const res = await request(app.getHttpServer())
        .patch(`/api/vehicles/${VEH_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ color: 'Rouge' });

      expect(res.status).toBe(200);
      expect(prisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: VEH_ID }, data: { color: 'Rouge' } }),
      );
    });
  });

  // ─── DELETE /api/vehicles/:id ────────────────────────────────────────────────

  describe('DELETE /api/vehicles/:id', () => {
    it('200 — soft delete (deletedAt renseigné)', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: VEH_ID, deletedAt: null });
      prisma.vehicle.update.mockResolvedValue({ id: VEH_ID, deletedAt: new Date() });

      const res = await request(app.getHttpServer())
        .delete(`/api/vehicles/${VEH_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
