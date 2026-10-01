import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicInvitationController } from '../../modules/team/public-invitation.controller';
import { TeamInvitationService } from '../../modules/team/team-invitation.service';
import { AuthService } from '../../modules/auth/auth.service';
import { TransactionalEmailService } from '../../shared/email/transactional-email.service';
import { hashInvitationToken, issueInvitation } from '../../shared/security/invitation-token';
import { createTestApp, makeIntegrationPrismaMock } from '../integration/helpers/app.helper';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('$2b$10$hashed') }));

/**
 * Contrat HTTP des routes publiques d'invitation (#15) : les codes métier doivent
 * atteindre le corps de la réponse (LESSON-2026-006) et la limitation de débit doit
 * réellement s'appliquer.
 */
function makePrisma() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    user: { ...base.user, updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

async function makeApp(prisma: ReturnType<typeof makePrisma>, limit = 1000) {
  return createTestApp({
    // Limite globale haute : seuls les @Throttle des routes publiques s'appliquent.
    moduleImports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit }])],
    controllers: [PublicInvitationController],
    extraProviders: [
      TeamInvitationService,
      AuthService,
      { provide: TransactionalEmailService, useValue: { send: jest.fn() } },
    ],
    prismaOverride: prisma,
  });
}

function invited(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'u-1',
    firstName: 'Marie',
    employeeCode: 'marie.nkolo',
    status: 'ACTIVE',
    inviteTokenHash: hashInvitationToken(token),
    inviteExpiresAt: new Date(Date.now() + 3600_000),
    inviteAcceptedAt: null,
    garage: { name: 'Garage Akwa' },
    ...overrides,
  };
}

describe('Invitations publiques — contrat HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makePrisma>;
  const { token } = issueInvitation();

  beforeAll(async () => {
    prisma = makePrisma();
    ({ app } = await makeApp(prisma));
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('GET 200 sans authentification : informations minimales seulement', async () => {
    prisma.user.findFirst.mockResolvedValue(invited(token));

    const res = await request(app.getHttpServer()).get(`/api/public/invitations/${token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['employeeCode', 'expiresAt', 'firstName', 'workshopName']);
  });

  it.each([
    ['inconnu', null, 404, 'INVITATION_INVALID'],
    ['expiré', { inviteExpiresAt: new Date(Date.now() - 1000) }, 410, 'INVITATION_EXPIRED'],
    ['utilisé', { inviteAcceptedAt: new Date() }, 409, 'INVITATION_USED'],
  ])('GET jeton %s → %i %s', async (_label, override, status, errorCode) => {
    prisma.user.findFirst.mockResolvedValue(override === null ? null : invited(token, override));

    const res = await request(app.getHttpServer()).get(`/api/public/invitations/${token}`);

    expect(res.status).toBe(status);
    expect(res.body.errorCode).toBe(errorCode);
  });

  it('GET jeton mal formé → 404 INVITATION_INVALID', async () => {
    const res = await request(app.getHttpServer()).get('/api/public/invitations/abc');
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('INVITATION_INVALID');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('POST accept : politique de mot de passe serveur (même règles que le changement)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/public/invitations/${token}/accept`)
      .send({ password: 'court1' });

    expect(res.status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('POST accept 200 : jeton de session renvoyé, connecté directement', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(invited(token))
      .mockResolvedValueOnce({
        id: 'u-1', email: 'marie@garage.cm', firstName: 'Marie', lastName: 'Nkolo',
        employeeCode: 'marie.nkolo', tokenVersion: 1, tenantId: 't-1', garageId: 'g-1',
      });

    const res = await request(app.getHttpServer())
      .post(`/api/public/invitations/${token}/accept`)
      .send({ password: 'Garage-Akwa-2026' });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: 'u-1', mustChangePassword: false });
  });

  it('POST accept sur une invitation déjà utilisée → 409 INVITATION_USED', async () => {
    prisma.user.findFirst.mockResolvedValue(invited(token, { inviteAcceptedAt: new Date() }));

    const res = await request(app.getHttpServer())
      .post(`/api/public/invitations/${token}/accept`)
      .send({ password: 'Garage-Akwa-2026' });

    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('INVITATION_USED');
  });
});

describe('Invitations publiques — limitation de débit', () => {
  it('POST accept : la 6e tentative par minute et par IP reçoit 429', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const { app } = await makeApp(prisma);
    const { token } = issueInvitation();

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/public/invitations/${token}/accept`)
        .set('X-Forwarded-For', '41.202.1.2')
        .send({ password: 'Garage-Akwa-2026' });
      statuses.push(res.status);
    }
    // Une autre IP n'est pas pénalisée.
    const other = await request(app.getHttpServer())
      .post(`/api/public/invitations/${token}/accept`)
      .set('X-Forwarded-For', '41.202.9.9')
      .send({ password: 'Garage-Akwa-2026' });
    await app.close();

    expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(statuses[5]).toBe(429);
    expect(other.status).toBe(404);
  });
});
