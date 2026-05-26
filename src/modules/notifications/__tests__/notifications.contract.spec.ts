/**
 * Tests de CONTRAT — InAppNotification API
 *
 * Valide que la shape des réponses respecte le contrat attendu par le frontend.
 * Le contrat est défini ici (côté producteur) et doit rester cohérent avec
 * l'interface `InAppNotification` dans lib/api.ts.
 *
 * On utilise des schemas de validation JSON pour vérifier la structure.
 * Pas de pact.js — approche "provider contract test" légère, sans broker.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

class StubAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: 'contract-user', roles: [] };
    return true;
  }
}

// ── Contrat attendu par le frontend (lib/api.ts > InAppNotification) ──────────

interface InAppNotificationContract {
  id: string;           // string UUID
  title: string;        // string non-vide
  body: string;         // string non-vide
  link: string | null;  // string ou null
  isRead: boolean;      // booléen
  readAt: string | null; // ISO 8601 ou null
  serviceOrderId: string | null; // UUID ou null
  createdAt: string;    // ISO 8601
}

function assertMatchesContract(obj: unknown): asserts obj is InAppNotificationContract {
  expect(obj).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      title: expect.any(String),
      body: expect.any(String),
      isRead: expect.any(Boolean),
      createdAt: expect.any(String),
    }),
  );
  // link, readAt, serviceOrderId peuvent être null — vérifier le type si présents
  const o = obj as Record<string, unknown>;
  if (o.link !== null) expect(typeof o.link).toBe('string');
  if (o.readAt !== null && o.readAt !== undefined) expect(typeof o.readAt).toBe('string');
  if (o.serviceOrderId !== null && o.serviceOrderId !== undefined) expect(typeof o.serviceOrderId).toBe('string');
}

// ── Fixtures ────────────────────────────────────────────────────────────────────

const fixtureNotif = {
  id: 'contract-notif-1',
  recipientId: 'contract-user',
  title: 'Véhicule prêt à restituer',
  body: 'Hilux AB-123-CD — M. Kouam doit être prévenu.',
  link: '/workshop/ot-contract-1',
  isRead: false,
  readAt: null,
  serviceOrderId: 'ot-contract-1',
  createdAt: new Date('2026-05-25T10:00:00Z'),
};

const prismaMock = {
  inAppNotification: {
    create: jest.fn().mockResolvedValue(fixtureNotif),
    findMany: jest.fn().mockResolvedValue([fixtureNotif]),
    count: jest.fn().mockResolvedValue(1),
    findUnique: jest.fn().mockResolvedValue(fixtureNotif),
    update: jest.fn().mockResolvedValue({ ...fixtureNotif, isRead: true, readAt: new Date().toISOString() }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  sMSNotification: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

let app: INestApplication;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      NotificationsService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: getQueueToken('sms-notifications'), useValue: { add: jest.fn() } },
      { provide: APP_GUARD, useClass: StubAuthGuard },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
});

afterAll(() => app.close());

// ── Contrats ───────────────────────────────────────────────────────────────────

describe('CONTRAT : GET /notifications/inbox', () => {
  it('retourne un tableau d\'objets conformes au contrat InAppNotification', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/inbox')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    for (const item of res.body) {
      assertMatchesContract(item);
    }
  });

  it('les champs obligatoires sont présents et du bon type', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/inbox')
      .expect(200);

    const notif = res.body[0];
    expect(notif).toHaveProperty('id');
    expect(notif).toHaveProperty('title');
    expect(notif).toHaveProperty('body');
    expect(notif).toHaveProperty('isRead');
    expect(notif).toHaveProperty('createdAt');
    expect(notif).toHaveProperty('link');
    expect(notif).toHaveProperty('readAt');
    expect(notif).toHaveProperty('serviceOrderId');
  });
});

describe('CONTRAT : GET /notifications/unread-count', () => {
  it('retourne { count: number }', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(200);

    expect(res.body).toMatchObject({ count: expect.any(Number) });
  });
});

describe('CONTRAT : PATCH /notifications/:id/read', () => {
  it('retourne la notification mise à jour conformément au contrat', async () => {
    const res = await request(app.getHttpServer())
      .patch('/notifications/contract-notif-1/read')
      .expect(200);

    assertMatchesContract(res.body);
    expect(res.body.isRead).toBe(true);
  });
});

describe('CONTRAT : PATCH /notifications/read-all', () => {
  it('retourne un objet avec le nombre de mises à jour', async () => {
    const res = await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .expect(200);

    // Prisma updateMany retourne { count: number }
    expect(res.body).toMatchObject({ count: expect.any(Number) });
  });
});
