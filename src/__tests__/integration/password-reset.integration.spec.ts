import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { TeamController } from '../../modules/team/team.controller';
import { TeamService } from '../../modules/team/team.service';
import { TeamInvitationService } from '../../modules/team/team-invitation.service';
import { TransactionalEmailService } from '../../shared/email/transactional-email.service';
import {
  TEST_GARAGE_ID,
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-temp-password'),
  compare: jest.fn(),
}));

/**
 * Non-régression du parcours « mot de passe oublié » (validé en production le 2026-10-08) :
 * demande → notification à l'ADMIN du garage → réinitialisation → changement imposé.
 *
 * Contrats protégés : réponse neutre (pas d'énumération de comptes), notification limitée
 * aux ADMIN du même garage, mot de passe temporaire renvoyé une seule fois, sessions
 * révoquées, accès bloqué (`PASSWORD_CHANGE_REQUIRED`) tant que le mot de passe n'est pas changé.
 */

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'admin-1';
const NEUTRAL = "Demande transmise à l'administrateur.";

const ADMIN_USER = makeDbUser(ADMIN_ID, ['ADMIN'], []);
const ADMIN_TOKEN = signTestToken(ADMIN_ID, 1);
const MEMBER_TOKEN = signTestToken(MEMBER_ID, 1);

function makePrisma() {
  const base = makeIntegrationPrismaMock();
  const prisma = {
    ...base,
    user: { ...base.user, findMany: jest.fn().mockResolvedValue([]) },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    inAppNotification: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return prisma;
}

describe('Mot de passe oublié — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makePrisma>;

  beforeAll(async () => {
    prisma = makePrisma();
    ({ app } = await createTestApp({
      controllers: [AuthController, TeamController],
      extraProviders: [
        AuthService,
        TeamService,
        TeamInvitationService,
        { provide: TransactionalEmailService, useValue: { send: jest.fn().mockResolvedValue('sent') } },
      ],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === ADMIN_ID ? ADMIN_USER : null),
    );
  });

  describe('POST /api/auth/forgot-password', () => {
    it('200 neutre et aucune écriture si le compte n’existe pas', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ identifier: 'fantome@atelier.cm' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(NEUTRAL);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.inAppNotification.create).not.toHaveBeenCalled();
    });

    it('marque la demande et notifie uniquement les ADMIN du garage du demandeur', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: MEMBER_ID,
        firstName: 'Tech',
        lastName: 'Reset',
        garageId: TEST_GARAGE_ID,
      });
      prisma.userRole.findMany.mockResolvedValue([{ userId: ADMIN_ID }]);

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ identifier: 'tech.reset' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(NEUTRAL);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: MEMBER_ID },
        data: { passwordResetRequestedAt: expect.any(Date) },
      });
      const where = prisma.userRole.findMany.mock.calls[0][0].where;
      expect(where.user.garageId).toBe(TEST_GARAGE_ID);
      expect(where.role.code.in).toEqual(['ADMIN', 'SUPER_ADMIN']);
      expect(prisma.inAppNotification.create).toHaveBeenCalledTimes(1);
      expect(prisma.inAppNotification.create.mock.calls[0][0].data).toMatchObject({
        recipientId: ADMIN_ID,
        title: 'Demande de réinitialisation de mot de passe',
        link: '/team',
      });
    });

    it('même réponse neutre quand le garage n’a aucun ADMIN actif', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: MEMBER_ID,
        firstName: 'Tech',
        lastName: 'Reset',
        garageId: TEST_GARAGE_ID,
      });
      prisma.userRole.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ identifier: 'tech.reset' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(NEUTRAL);
      expect(prisma.inAppNotification.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/team/:id/reset-password', () => {
    it('renvoie un mot de passe temporaire, impose le changement et révoque les sessions', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: MEMBER_ID }); // assertTeamMemberInGarage + findOne
      prisma.user.update.mockResolvedValue({
        id: MEMBER_ID,
        employeeCode: 'tech.reset',
        firstName: 'Tech',
        lastName: 'Reset',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/team/${MEMBER_ID}/reset-password`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});

      expect(res.status).toBe(201);
      expect(typeof res.body.tempPassword).toBe('string');
      expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(10);
      expect(res.body).not.toHaveProperty('passwordHash');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data).toMatchObject({
        passwordHash: 'hashed-temp-password',
        mustChangePassword: true,
        passwordResetRequestedAt: null,
        tokenVersion: { increment: 1 },
        inviteTokenHash: null,
      });
      expect(JSON.stringify(data)).not.toContain(res.body.tempPassword);
    });

    it('404 si le membre n’appartient pas au garage de l’ADMIN (anti-IDOR)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post(`/api/team/${MEMBER_ID}/reset-password`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({});

      expect(res.status).toBe(404);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('403 pour un rôle non ADMIN', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === MEMBER_ID ? makeDbUser(MEMBER_ID, ['TECHNICIEN'], ['VEH_VIEW']) : null),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/team/${MEMBER_ID}/reset-password`)
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({});

      expect(res.status).toBe(403);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Changement de mot de passe imposé', () => {
    it('403 PASSWORD_CHANGE_REQUIRED sur une route métier tant que le mot de passe est temporaire', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === MEMBER_ID
            ? makeDbUser(MEMBER_ID, ['ADMIN'], [], { mustChangePassword: true })
            : null,
        ),
      );

      const res = await request(app.getHttpServer())
        .get('/api/team')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('PASSWORD_CHANGE_REQUIRED');
    });
  });
});
