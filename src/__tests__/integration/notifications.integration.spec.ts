import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsController } from '../../modules/notifications/notifications.controller';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// ADMIN bypass PermissionsGuard quelle que soit la permission requise
const ADMIN_USER = makeDbUser('admin-1', ['ADMIN'], []);
// CAISSIER a FAC_CREATE mais pas la permission virtuelle 'ADMIN'
const CAISSIER_USER = makeDbUser('caissier-1', ['CAISSIER'], ['FAC_CREATE', 'VEH_VIEW', 'ORD_VIEW', 'STK_VIEW']);

const ADMIN_TOKEN = signTestToken('admin-1', 1);
const CAISSIER_TOKEN = signTestToken('caissier-1', 1);

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Notifications — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeIntegrationPrismaMock>;
  let smsHistoryMock: jest.Mock;
  let smsCreateMock: jest.Mock;
  let queueAddMock: jest.Mock;

  function routeUser({ where }: { where: { id: string } }) {
    if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
    if (where.id === 'caissier-1') return Promise.resolve(CAISSIER_USER);
    return Promise.resolve(null);
  }

  beforeAll(async () => {
    prisma = makeIntegrationPrismaMock();
    smsHistoryMock = jest.fn().mockResolvedValue([]);
    smsCreateMock = jest.fn().mockResolvedValue({ id: 'notif-123', phoneTo: '+237690000000', status: 'PENDING' });
    queueAddMock = jest.fn().mockResolvedValue({ id: 'job-123' });

    prisma.user.findUnique.mockImplementation(routeUser);

    ({ app } = await createTestApp({
      controllers: [NotificationsController],
      extraProviders: [
        NotificationsService,
        { provide: getQueueToken('sms-notifications'), useValue: { add: queueAddMock } },
      ],
      prismaOverride: {
        ...prisma,
        sMSNotification: { findMany: smsHistoryMock, create: smsCreateMock },
      } as ReturnType<typeof makeIntegrationPrismaMock>,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(routeUser);
    smsHistoryMock.mockResolvedValue([]);
    smsCreateMock.mockResolvedValue({ id: 'notif-123', phoneTo: '+237690000000', status: 'PENDING' });
    queueAddMock.mockResolvedValue({ id: 'job-123' });
  });

  // ── RBAC — @RequireRole('ADMIN') ─────────────────────────────────────────────

  describe('RBAC', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/notifications/sms');
      expect(res.status).toBe(401);
    });

    it('403 — CAISSIER (FAC_CREATE) ne peut pas GET /api/notifications/sms', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('403 — CAISSIER ne peut pas POST /api/notifications/sms/send', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ phone: '+237690000000', message: 'test' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/notifications/sms ─────────────────────────────────────────────────

  describe('GET /api/notifications/sms', () => {
    it('200 — ADMIN récupère l\'historique SMS', async () => {
      smsHistoryMock.mockResolvedValue([
        { id: 'sms-1', phoneTo: '+237690000000', message: 'Rappel RDV', sentAt: new Date() },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('sms-1');
    });

    it('200 — filtre par numéro de téléphone via query ?phone=', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms?phone=237690')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(smsHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phoneTo: { contains: '237690' } },
        }),
      );
    });

    it('200 — sans filtre si ?phone absent', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(smsHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('limité à 50 entrées (orderBy sentAt desc)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(smsHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, orderBy: { sentAt: 'desc' } }),
      );
    });
  });

  // ── POST /api/notifications/sms/send ──────────────────────────────────────────

  describe('POST /api/notifications/sms/send', () => {
    it('201 — ADMIN enfile un SMS via template → notification retournée', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ phoneTo: '+237690000000', templateCode: 'VEHICLE_READY' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('notif-123');
      expect(res.body.status).toBe('PENDING');
    });

    it('enfile le job avec le templateCode et les bons paramètres', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ phoneTo: '+237690000000', templateCode: 'VEHICLE_READY', lang: 'en' });

      expect(queueAddMock).toHaveBeenCalledWith(
        'VEHICLE_READY',
        expect.objectContaining({ phone: '+237690000000', lang: 'en' }),
      );
    });

    it('lang par défaut est "fr" si non fourni', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ phoneTo: '+237690000000', templateCode: 'VEHICLE_READY' });

      expect(queueAddMock).toHaveBeenCalledWith(
        'VEHICLE_READY',
        expect.objectContaining({ lang: 'fr' }),
      );
    });
  });
});
