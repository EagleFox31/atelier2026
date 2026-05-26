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
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER    = makeDbUser('admin-1',    ['ADMIN'],    []);
const CAISSIER_USER = makeDbUser('caissier-1', ['CAISSIER'], ['FAC_CREATE', 'VEH_VIEW', 'ORD_VIEW', 'STK_VIEW']);

const ADMIN_TOKEN    = signTestToken('admin-1', 1);
const CAISSIER_TOKEN = signTestToken('caissier-1', 1);

const SMS_STUB = {
  id: 'sms-1',
  phoneTo: '+237690000000',
  message: 'Votre véhicule est prêt',
  status: 'SENT',
  sentAt: '2026-05-20T10:00:00.000Z',
  customerId: null,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Notifications — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeIntegrationPrismaMock>;
  let smsHistoryMock: jest.Mock;
  let queueAddMock: jest.Mock;

  const routeUser = ({ where }: { where: { id: string } }) => {
    if (where.id === 'admin-1')    return Promise.resolve(ADMIN_USER);
    if (where.id === 'caissier-1') return Promise.resolve(CAISSIER_USER);
    return Promise.resolve(null);
  };

  beforeAll(async () => {
    prisma = makeIntegrationPrismaMock();
    smsHistoryMock = jest.fn().mockResolvedValue([]);
    queueAddMock   = jest.fn().mockResolvedValue({ id: 'job-123' });

    prisma.user.findUnique.mockImplementation(routeUser);

    const smsCreateMock = jest.fn().mockResolvedValue({
      id: 'sms-new',
      phoneTo: '+237690000000',
      templateCode: 'VEHICLE_READY',
      messageBody: 'Votre véhicule est prêt à être récupéré à l\'atelier. Merci pour votre confiance.',
      customerId: null,
      lang: 'fr',
      status: 'PENDING',
      sentAt: null,
      createdAt: new Date().toISOString(),
    });

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

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(routeUser);
    smsHistoryMock.mockResolvedValue([]);
    queueAddMock.mockResolvedValue({ id: 'job-123' });
  });

  // ── GET /api/notifications/sms ─────────────────────────────────────────────

  describe('GET /api/notifications/sms', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/notifications/sms');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('403 CAISSIER (pas ADMIN) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('200 — retourne un tableau', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('200 — chaque SMS contient { id, phoneTo, message, sentAt }', async () => {
      smsHistoryMock.mockResolvedValue([SMS_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        phoneTo: expect.any(String),
        message: expect.any(String),
        sentAt: expect.any(String),
      });
    });

    it('200 — tableau limité à 50 entrées max (orderBy sentAt desc)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications/sms')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(smsHistoryMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, orderBy: { sentAt: 'desc' } }),
      );
    });
  });

  // ── POST /api/notifications/sms/send ──────────────────────────────────────

  describe('POST /api/notifications/sms/send', () => {
    it('403 CAISSIER → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          phoneTo: '+237690000000',
          templateCode: 'VEHICLE_READY',
        });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('201 — shape : notification SMS avec status PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          phoneTo: '+237690000000',
          templateCode: 'VEHICLE_READY',
          lang: 'fr',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: 'sms-new',
          phoneTo: '+237690000000',
          templateCode: 'VEHICLE_READY',
          status: 'PENDING',
        }),
      );
    });

    it('201 — job BullMQ ajouté avec templateCode et notificationId', async () => {
      await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          phoneTo: '+237699000001',
          templateCode: 'VEHICLE_READY',
          customerId: '6734cb73-c6bc-4d27-a415-0f32ea5cfcec',
        });

      expect(queueAddMock).toHaveBeenCalledWith(
        'VEHICLE_READY',
        expect.objectContaining({
          phone: '+237699000001',
          notificationId: 'sms-new',
        }),
      );
    });

    it('400 — templateCode inconnu', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/sms/send')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          phoneTo: '+237690000000',
          templateCode: 'UNKNOWN_TEMPLATE',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Modèle SMS inconnu');
    });
  });
});
