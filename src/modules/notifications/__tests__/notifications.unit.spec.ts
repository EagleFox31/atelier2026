/**
 * Tests UNITAIRES — NotificationsService (in-app)
 * PrismaService entièrement mocké, aucune connexion DB.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeNotif = (overrides = {}) => ({
  id: 'notif-1',
  recipientId: 'user-1',
  title: 'Véhicule prêt',
  body: 'Hilux — M. Kouam',
  link: '/workshop/ot-1',
  isRead: false,
  readAt: null,
  serviceOrderId: 'ot-1',
  createdAt: new Date('2026-05-25T10:00:00Z'),
  ...overrides,
});

const buildModule = async (prismaOverrides: Record<string, unknown> = {}) => {
  const prismaMock = {
    inAppNotification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    sMSNotification: { create: jest.fn(), findMany: jest.fn() },
    userRole: { findMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    ...prismaOverrides,
  };

  const queueMock = { add: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: getQueueToken('sms-notifications'), useValue: queueMock },
    ],
  }).compile();

  return {
    service: module.get<NotificationsService>(NotificationsService),
    prisma: prismaMock,
  };
};

// ── createInApp ───────────────────────────────────────────────────────────────

describe('createInApp', () => {
  it('crée une notification par destinataire', async () => {
    const { service, prisma } = await buildModule();
    const notif = makeNotif();
    prisma.inAppNotification.create.mockResolvedValue(notif);
    prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));


    const result = await service.createInApp({
      recipientIds: ['user-1', 'user-2'],
      title: 'Véhicule prêt',
      body: 'Hilux — M. Kouam',
      link: '/workshop/ot-1',
      serviceOrderId: 'ot-1',
    });

    expect(prisma.inAppNotification.create).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('retourne un tableau vide si aucun destinataire', async () => {
    const { service, prisma } = await buildModule();

    const result = await service.createInApp({
      recipientIds: [],
      title: 'Test',
      body: 'Vide',
    });

    expect(result).toEqual([]);
    expect(prisma.inAppNotification.create).not.toHaveBeenCalled();
  });
});

// ── getInbox ──────────────────────────────────────────────────────────────────

describe('getInbox', () => {
  it("retourne les notifications non-lues de l'utilisateur", async () => {
    const { service, prisma } = await buildModule();
    const notif = makeNotif();
    prisma.inAppNotification.findMany.mockResolvedValue([notif]);

    const result = await service.getInbox('user-1');

    expect(prisma.inAppNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 'user-1', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
    expect(result).toEqual([notif]);
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('retourne le compte des notifications non-lues', async () => {
    const { service, prisma } = await buildModule();
    prisma.inAppNotification.count.mockResolvedValue(3);

    const count = await service.getUnreadCount('user-1');

    expect(count).toBe(3);
    expect(prisma.inAppNotification.count).toHaveBeenCalledWith({
      where: { recipientId: 'user-1', isRead: false },
    });
  });
});

// ── markRead ──────────────────────────────────────────────────────────────────

describe('markRead', () => {
  it('marque une notification comme lue', async () => {
    const { service, prisma } = await buildModule();
    const notif = makeNotif();
    prisma.inAppNotification.findUnique.mockResolvedValue(notif);
    prisma.inAppNotification.update.mockResolvedValue({ ...notif, isRead: true });

    const result = await service.markRead('notif-1', 'user-1');

    expect(prisma.inAppNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ isRead: true }),
      }),
    );
    expect(result.isRead).toBe(true);
  });

  it("lève NotFoundException si la notification n'existe pas", async () => {
    const { service, prisma } = await buildModule();
    prisma.inAppNotification.findUnique.mockResolvedValue(null);

    await expect(service.markRead('inexistant', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it("lève ForbiddenException si l'utilisateur n'est pas le destinataire", async () => {
    const { service, prisma } = await buildModule();
    prisma.inAppNotification.findUnique.mockResolvedValue(makeNotif({ recipientId: 'other-user' }));

    await expect(service.markRead('notif-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────────

describe('markAllRead', () => {
  it('marque toutes les notifications non-lues comme lues', async () => {
    const { service, prisma } = await buildModule();
    prisma.inAppNotification.updateMany.mockResolvedValue({ count: 5 });

    const result = await service.markAllRead('user-1');

    expect(prisma.inAppNotification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'user-1', isRead: false },
      data: expect.objectContaining({ isRead: true }),
    });
    expect(result).toEqual({ count: 5 });
  });
});

// ── getUserIdsByRoles ──────────────────────────────────────────────────────────

describe('getUserIdsByRoles', () => {
  it('retourne les IDs des utilisateurs ayant les rôles demandés', async () => {
    const { service, prisma } = await buildModule();
    prisma.userRole.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);

    const ids = await service.getUserIdsByRoles(['RECEPTIONNISTE', 'CAISSIER']);

    expect(ids).toEqual(['user-1', 'user-2']);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          role: { code: { in: ['RECEPTIONNISTE', 'CAISSIER'] } },
        }),
      }),
    );
  });

  it("retourne un tableau vide si aucun utilisateur n'a les rôles", async () => {
    const { service, prisma } = await buildModule();
    prisma.userRole.findMany.mockResolvedValue([]);

    const ids = await service.getUserIdsByRoles(['ROLE_INEXISTANT']);
    expect(ids).toEqual([]);
  });
});
