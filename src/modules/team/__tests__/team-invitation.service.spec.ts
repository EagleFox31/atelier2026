import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { TeamInvitationService } from '../team-invitation.service';
import { hashInvitationToken, issueInvitation } from '../../../shared/security/invitation-token';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

const GARAGE = '52221808-e45d-41a9-9a37-933695560f6c';
const ENV = { ...process.env };

function makeDeps() {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'u-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const email = { send: jest.fn().mockResolvedValue('sent') };
  const auth = { signAccessToken: jest.fn().mockResolvedValue('jwt-token') };
  const service = new TeamInvitationService(prisma as any, email as any, auth as any);
  return { service, prisma, email, auth };
}

/** Utilisateur invité tel que lu par la recherche par empreinte. */
function invitedRow(token: string, overrides: Record<string, unknown> = {}) {
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

describe('TeamInvitationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ENV, APP_PUBLIC_URL: 'https://atelier.exemple.cm' };
    delete process.env.TEAM_INVITE_EMAIL_FROM;
  });
  afterAll(() => {
    process.env = ENV;
  });

  describe('describe() — page publique', () => {
    it('recherche par empreinte (jamais le jeton brut) et renvoie le strict minimum', async () => {
      const { service, prisma } = makeDeps();
      const { token } = issueInvitation();
      prisma.user.findFirst.mockResolvedValue(invitedRow(token));

      const info = await service.describe(token);

      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
        inviteTokenHash: hashInvitationToken(token),
        deletedAt: null,
      });
      expect(JSON.stringify(prisma.user.findFirst.mock.calls)).not.toContain(token);
      expect(info).toEqual({
        firstName: 'Marie',
        employeeCode: 'marie.nkolo',
        workshopName: 'Garage Akwa',
        expiresAt: expect.any(String),
      });
    });

    it('jeton mal formé : INVITATION_INVALID sans requête en base', async () => {
      const { service, prisma } = makeDeps();
      await expect(service.describe('pas-un-jeton')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it.each([
      ['inconnu', null, NotFoundException, 'INVITATION_INVALID'],
      ['expiré', { inviteExpiresAt: new Date(Date.now() - 1000) }, GoneException, 'INVITATION_EXPIRED'],
      ['déjà utilisé', { inviteAcceptedAt: new Date() }, ConflictException, 'INVITATION_USED'],
      ['compte suspendu', { status: 'SUSPENDED' }, NotFoundException, 'INVITATION_INVALID'],
    ])('%s → %s (%s)', async (_label, override, Exception, errorCode) => {
      const { service, prisma } = makeDeps();
      const { token } = issueInvitation();
      prisma.user.findFirst.mockResolvedValue(override === null ? null : invitedRow(token, override));

      const error = await service.describe(token).catch((e) => e);
      expect(error).toBeInstanceOf(Exception);
      expect(error.getResponse()).toMatchObject({ errorCode });
    });
  });

  describe('accept()', () => {
    it('définit le mot de passe, consomme le jeton atomiquement et ouvre la session', async () => {
      const { service, prisma, auth } = makeDeps();
      const { token } = issueInvitation();
      prisma.user.findFirst
        .mockResolvedValueOnce(invitedRow(token))
        .mockResolvedValueOnce({
          id: 'u-1', email: 'marie@garage.cm', firstName: 'Marie', lastName: 'Nkolo',
          employeeCode: 'marie.nkolo', tokenVersion: 3, tenantId: 't-1', garageId: GARAGE,
        });

      const result = await service.accept(token, 'Garage-Akwa-2026');

      const { where, data } = prisma.user.updateMany.mock.calls[0][0];
      expect(where).toMatchObject({
        id: 'u-1',
        inviteTokenHash: hashInvitationToken(token),
        inviteAcceptedAt: null,
        status: 'ACTIVE',
        inviteExpiresAt: { gt: expect.any(Date) },
      });
      expect(data).toMatchObject({
        passwordHash: 'hashed-password',
        mustChangePassword: false,
        inviteAcceptedAt: expect.any(Date),
        tokenVersion: { increment: 1 },
      });
      expect(data).not.toHaveProperty('tempPassword');
      expect(auth.signAccessToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-1', tokenVersion: 3, garageId: GARAGE }));
      expect(result).toMatchObject({ access_token: 'jwt-token', user: { id: 'u-1', mustChangePassword: false } });
    });

    it('usage unique : une seconde acceptation concurrente (0 ligne modifiée) → INVITATION_USED', async () => {
      const { service, prisma, auth } = makeDeps();
      const { token } = issueInvitation();
      prisma.user.findFirst.mockResolvedValue(invitedRow(token));
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      const error = await service.accept(token, 'Garage-Akwa-2026').catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ errorCode: 'INVITATION_USED' });
      expect(auth.signAccessToken).not.toHaveBeenCalled();
    });

    it('jeton expiré : refus, aucun mot de passe écrit', async () => {
      const { service, prisma } = makeDeps();
      const { token } = issueInvitation();
      prisma.user.findFirst.mockResolvedValue(invitedRow(token, { inviteExpiresAt: new Date(Date.now() - 1) }));

      await expect(service.accept(token, 'Garage-Akwa-2026')).rejects.toBeInstanceOf(GoneException);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('resend()', () => {
    const member = {
      id: 'u-1', email: 'marie@garage.cm', firstName: 'Marie', employeeCode: 'marie.nkolo',
      status: 'ACTIVE', inviteAcceptedAt: null, garage: { name: 'Garage Akwa' },
      roles: [{ role: { code: 'TECHNICIEN' } }],
    };

    it('nouveau jeton à chaque renvoi : l’empreinte précédente est remplacée', async () => {
      const { service, prisma, email } = makeDeps();
      prisma.user.findFirst.mockResolvedValue(member);

      await service.resend('u-1', GARAGE, { firstName: 'Jennifer', lastName: 'Admin' });
      await service.resend('u-1', GARAGE, { firstName: 'Jennifer', lastName: 'Admin' });

      const first = prisma.user.update.mock.calls[0][0].data;
      const second = prisma.user.update.mock.calls[1][0].data;
      expect(first.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(second.inviteTokenHash).not.toBe(first.inviteTokenHash);
      expect(second).toMatchObject({ inviteAcceptedAt: null, inviteExpiresAt: expect.any(Date) });

      // Le lien envoyé correspond bien à l'empreinte stockée, et seulement elle.
      const html = email.send.mock.calls[1][0].html as string;
      const token = /\/invitation\/([A-Za-z0-9_-]{43})/.exec(html)![1];
      expect(hashInvitationToken(token)).toBe(second.inviteTokenHash);
      expect(hashInvitationToken(token)).not.toBe(first.inviteTokenHash);
    });

    it('membre d’un autre garage : 404 (IDOR masqué), rien n’est écrit ni envoyé', async () => {
      const { service, prisma, email } = makeDeps();
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.resend('u-1', 'autre-garage')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });

    it('refuse sans e-mail ou si déjà acceptée', async () => {
      const { service, prisma } = makeDeps();
      prisma.user.findFirst.mockResolvedValue({ ...member, email: null });
      await expect(service.resend('u-1', GARAGE)).rejects.toMatchObject({ response: { errorCode: 'INVITATION_NO_EMAIL' } });

      prisma.user.findFirst.mockResolvedValue({ ...member, inviteAcceptedAt: new Date() });
      await expect(service.resend('u-1', GARAGE)).rejects.toMatchObject({ response: { errorCode: 'INVITATION_ALREADY_ACCEPTED' } });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deliver()', () => {
    const recipient = {
      userId: 'u-1', email: 'marie@garage.cm', firstName: 'Marie', roleCode: 'TECHNICIEN',
      employeeCode: 'marie.nkolo', workshopName: 'Garage Akwa',
    };

    it('clé d’idempotence par utilisateur et par envoi, expéditeur configurable', async () => {
      const { service, email } = makeDeps();
      process.env.TEAM_INVITE_EMAIL_FROM = 'Équipe <equipe@exemple.cm>';
      const { token, data } = issueInvitation(new Date('2026-10-02T09:00:00.000Z'));

      await expect(
        service.deliver(recipient, { token, expiresAt: data.inviteExpiresAt, sentAt: data.inviteSentAt }),
      ).resolves.toBe('sent');

      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'marie@garage.cm',
        idempotencyKey: `team-invite/u-1/${Date.parse('2026-10-02T09:00:00.000Z')}`,
        category: 'team_invitation',
        from: 'Équipe <equipe@exemple.cm>',
      }));
      const { logLabel } = email.send.mock.calls[0][0];
      expect(logLabel).not.toContain(token);
    });

    it('sans URL publique : pas d’envoi (lien inutilisable), résultat « skipped »', async () => {
      const { service, email } = makeDeps();
      delete process.env.APP_PUBLIC_URL;
      delete process.env.APP_DOMAIN;
      const { token, data } = issueInvitation();

      await expect(
        service.deliver(recipient, { token, expiresAt: data.inviteExpiresAt, sentAt: data.inviteSentAt }),
      ).resolves.toBe('skipped');
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
