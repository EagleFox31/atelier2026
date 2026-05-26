import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PlanningController } from '../../modules/planning/planning.controller';
import { PlanningService } from '../../modules/planning/planning.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER  = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);

const CUST_ID = '22222222-2222-4222-8222-222222222222';
const APPT_ID = '11111111-1111-4111-8111-111111111111';

function makePlanningPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    appointment: {
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn(),
      update:   jest.fn().mockResolvedValue({}),
      delete:   jest.fn().mockResolvedValue({}),
    },
  };
}

describe('Planning — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makePlanningPrismaMock>;

  beforeAll(async () => {
    prisma = makePlanningPrismaMock();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
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
      return Promise.resolve(null);
    });
  });

  // ─── GET /api/planning/appointments ─────────────────────────────────────────

  describe('GET /api/planning/appointments', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/planning/appointments');
      expect(res.status).toBe(401);
    });

    it('200 — liste des rendez-vous', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — passe date et status au service (plage + filtre)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/planning/appointments?date=2026-05-23&status=SCHEDULED')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
            scheduledAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ─── POST /api/planning/appointments ────────────────────────────────────────

  describe('POST /api/planning/appointments', () => {
    it('400 — customerId manquant (ValidationPipe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ scheduledAt: '2026-05-23T09:00:00.000Z', reason: 'Révision' });
      expect(res.status).toBe(400);
    });

    it('400 — reason manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ customerId: CUST_ID, scheduledAt: '2026-05-23T09:00:00.000Z' });
      expect(res.status).toBe(400);
    });

    it('201 — crée un rendez-vous', async () => {
      prisma.appointment.create.mockResolvedValue({ id: APPT_ID, customerId: CUST_ID });

      const res = await request(app.getHttpServer())
        .post('/api/planning/appointments')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          customerId:  CUST_ID,
          scheduledAt: '2026-05-23T09:00:00.000Z',
          reason:      'Révision annuelle',
        });

      expect(res.status).toBe(201);
      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: CUST_ID, reason: 'Révision annuelle' }),
        }),
      );
    });
  });

  // ─── PATCH /api/planning/appointments/:id ────────────────────────────────────

  describe('PATCH /api/planning/appointments/:id', () => {
    it('200 — met à jour le statut', async () => {
      prisma.appointment.update.mockResolvedValue({ id: APPT_ID, status: 'COMPLETED' });

      const res = await request(app.getHttpServer())
        .patch(`/api/planning/appointments/${APPT_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: APPT_ID },
        data:  { status: 'COMPLETED' },
      });
    });
  });

  // ─── DELETE /api/planning/appointments/:id ───────────────────────────────────

  describe('DELETE /api/planning/appointments/:id', () => {
    it('200 — hard delete (delete() et non update())', async () => {
      prisma.appointment.delete.mockResolvedValue({ id: APPT_ID });

      const res = await request(app.getHttpServer())
        .delete(`/api/planning/appointments/${APPT_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.delete).toHaveBeenCalledWith({ where: { id: APPT_ID } });
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });
  });
});
