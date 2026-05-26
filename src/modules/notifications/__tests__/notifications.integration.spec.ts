/**
 * Tests D'INTÉGRATION — NotificationsController + NotificationsService
 *
 * Stratégie : module de test minimaliste avec les providers exacts (pas
 * d'import du module complet), PrismaService mocké pour éviter toute
 * connexion DB en CI. Vérifie que Controller → Service → Prisma est câblé.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

// ── Stub guard : injecte le user depuis le header X-Test-User ─────────────────

class StubAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['x-test-user'];
    req.user = header ? JSON.parse(header) : { id: 'user-test', roles: [] };
    return true;
  }
}

const USER = JSON.stringify({ id: 'user-test', roles: [] });

// ── Fixtures ────────────────────────────────────────────────────────────────────

const makeNotif = (overrides = {}) => ({
  id: 'notif-integration-1',
  recipientId: 'user-test',
  title: 'Véhicule prêt',
  body: 'Hilux — M. Kouam',
  link: '/workshop/ot-1',
  isRead: false,
  readAt: null,
  serviceOrderId: 'ot-1',
  createdAt: new Date('2026-05-25T10:00:00Z'),
  ...overrides,
});

const prismaMock = {
  inAppNotification: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([makeNotif()]),
    count: jest.fn().mockResolvedValue(1),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  sMSNotification: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
};

const queueMock = { add: jest.fn() };

// ── App setup ──────────────────────────────────────────────────────────────────

let app: INestApplication;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      NotificationsService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: getQueueToken('sms-notifications'), useValue: queueMock },
      { provide: APP_GUARD, useClass: StubAuthGuard },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
});

afterAll(() => app.close());

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /notifications/inbox', () => {
  it("200 — retourne les notifications de l'utilisateur connecté", async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/inbox')
      .set('x-test-user', USER)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 'notif-integration-1', isRead: false });
  });
});

describe('GET /notifications/unread-count', () => {
  it('200 — retourne { count: number }', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('x-test-user', USER)
      .expect(200);

    expect(res.body).toMatchObject({ count: 1 });
  });
});

describe('PATCH /notifications/:id/read', () => {
  it('200 — marque la notification comme lue', async () => {
    prismaMock.inAppNotification.findUnique.mockResolvedValueOnce(makeNotif());
    prismaMock.inAppNotification.update.mockResolvedValueOnce(makeNotif({ isRead: true }));

    const res = await request(app.getHttpServer())
      .patch('/notifications/notif-integration-1/read')
      .set('x-test-user', USER)
      .expect(200);

    expect(res.body.isRead).toBe(true);
  });

  it('404 — notification inexistante', async () => {
    prismaMock.inAppNotification.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .patch('/notifications/inexistant/read')
      .set('x-test-user', USER)
      .expect(404);
  });

  it("403 — notification appartenant à un autre utilisateur", async () => {
    prismaMock.inAppNotification.findUnique.mockResolvedValueOnce(
      makeNotif({ recipientId: 'autre-user' }),
    );

    await request(app.getHttpServer())
      .patch('/notifications/notif-integration-1/read')
      .set('x-test-user', USER)
      .expect(403);
  });
});

describe('PATCH /notifications/read-all', () => {
  it('200 — marque toutes les notifications comme lues', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('x-test-user', USER)
      .expect(200);

    expect(prismaMock.inAppNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientId: 'user-test', isRead: false } }),
    );
  });
});
