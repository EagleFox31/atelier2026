import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlanningController } from '../../modules/planning/planning.controller';
import { PlanningService } from '../../modules/planning/planning.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CHEF_PERMS  = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const TECH_PERMS  = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_USER  = makeDbUser('tech-1', ['TECHNICIEN'],   TECH_PERMS);

const CHEF_TOKEN = signTestToken('chef-1', 1);
const TECH_TOKEN = signTestToken('tech-1', 1);

const CUST_UUID = '22222222-2222-4222-8222-222222222222';
const APPT_UUID = '99999999-9999-4999-8999-999999999999';

const APPT_STUB = {
  id: APPT_UUID,
  customerId: CUST_UUID,
  scheduledAt: '2026-06-15T09:00:00.000Z',
  durationMinutes: 60,
  reason: 'Vidange moteur',
  status: 'SCHEDULED',
  notes: null,
  vehicleId: null,
  serviceOrderId: null,
  customer: { id: CUST_UUID, lastName: 'Ngono', phonePrimary: '+237690000001' },
  vehicle: null,
  createdAt: '2026-05-20T08:00:00.000Z',
  updatedAt: '2026-05-20T08:00:00.000Z',
};

function makePlanningPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn(),
      update:   jest.fn(),
      delete:   jest.fn(),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Planning — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makePlanningPrismaMock>;

  beforeAll(async () => {
    prisma = makePlanningPrismaMock();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      if (where.id === 'tech-1') return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    ({ app } = await createTestApp({
      controllers: [PlanningController],
      extraProviders: [PlanningService],
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

  // ── GET /api/planning/appointments ────────────────────────────────────────

  describe('GET /api/planning/appointments', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/planning/appointments');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('200 — retourne un tableau', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/planning/appointments')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — chaque item contient { id, scheduledAt, reason, status, customer }', async () => {
      prisma.appointment.findMany.mockResolvedValue([APPT_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        scheduledAt: expect.any(String),
        reason: expect.any(String),
        status: expect.any(String),
        customer: expect.any(Object),
      });
    });
  });

  // ── POST /api/planning/appointments ───────────────────────────────────────

  describe('POST /api/planning/appointments', () => {
    it('403 TECHNICIEN sans ORD_CREATE → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ customerId: CUST_UUID, scheduledAt: '2026-06-15T09:00:00.000Z', reason: 'Test' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('400 validation — scheduledAt manquant → message[] avec "scheduledAt"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_UUID, reason: 'Vidange' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.some((m: string) => m.includes('scheduledAt'))).toBe(true);
    });

    it('400 validation — customerId manquant → message[] avec "customerId"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ scheduledAt: '2026-06-15T09:00:00.000Z', reason: 'Vidange' });

      expect(res.status).toBe(400);
      expect(res.body.message.some((m: string) => m.includes('customerId'))).toBe(true);
    });

    it('201 — shape : { id, scheduledAt, reason, status, customerId }', async () => {
      prisma.appointment.create.mockResolvedValue(APPT_STUB);

      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_UUID, scheduledAt: '2026-06-15T09:00:00.000Z', reason: 'Vidange moteur' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        scheduledAt: expect.any(String),
        reason: 'Vidange moteur',
        status: 'SCHEDULED',
        customerId: CUST_UUID,
      });
    });

    it('400 (P2003) — customerId invalide → errorCode "DB_FOREIGN_KEY"', async () => {
      prisma.appointment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
          code: 'P2003', clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_UUID, scheduledAt: '2026-06-15T09:00:00.000Z', reason: 'Test FK' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });
  });

  // ── PATCH /api/planning/appointments/:id ──────────────────────────────────

  describe('PATCH /api/planning/appointments/:id', () => {
    it('200 — retourne le RDV mis à jour', async () => {
      prisma.appointment.update.mockResolvedValue({
        ...APPT_STUB,
        status: 'CONFIRMED',
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/planning/appointments/${APPT_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: APPT_UUID, status: 'CONFIRMED' });
    });

    it('404 (P2025) — RDV inexistant → errorCode "DB_NOT_FOUND"', async () => {
      prisma.appointment.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025', clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/planning/appointments/${APPT_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });
  });

  // ── DELETE /api/planning/appointments/:id ─────────────────────────────────

  describe('DELETE /api/planning/appointments/:id', () => {
    it('200 — hard delete : retourne le RDV supprimé sans deletedAt', async () => {
      prisma.appointment.delete.mockResolvedValue(APPT_STUB);

      const res = await request(app.getHttpServer())
        .delete(`/api/planning/appointments/${APPT_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      // Hard delete — le retour n'a pas de deletedAt (ni null ni date)
      expect(res.body).toMatchObject({ id: APPT_UUID });
      expect(res.body).not.toHaveProperty('deletedAt');
    });

    it('404 (P2025) — RDV inexistant → errorCode "DB_NOT_FOUND"', async () => {
      prisma.appointment.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025', clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .delete(`/api/planning/appointments/${APPT_UUID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });
  });
});
