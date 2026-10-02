const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';
import { NotFoundException } from '@nestjs/common';
import { TeamService } from '../team.service';
import { issueInvitation } from '../../../shared/security/invitation-token';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { hash: jest.Mock };

function makeDeps() {
  const prismaMock = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'u-1', garageId: TEST_GARAGE_ID, deletedAt: null }), // assertion only
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    garage: { findFirst: jest.fn().mockResolvedValue({ name: 'Garage Akwa' }) },
    role: { findUnique: jest.fn() },
    userRole: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const invitationsMock = {
    issue: jest.fn(() => issueInvitation(new Date('2026-10-02T09:00:00.000Z'))),
    deliver: jest.fn().mockResolvedValue('sent'),
  };
  const service = new TeamService(prismaMock as any, invitationsMock as any);
  return { service, prismaMock, invitationsMock };
}

describe('TeamService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('filtre deletedAt: null par défaut', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, TEST_GARAGE_ID);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('filtre textuel : OR sur 4 champs (prénom, nom, email, code employé)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll('Jean', undefined, TEST_GARAGE_ID);

      const where = prismaMock.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(4);
    });

    it('filtre par roleId actif (revokedAt: null)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'role-1', TEST_GARAGE_ID);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { some: { roleId: 'role-1', revokedAt: null } },
          }),
        }),
      );
    });

    it('tri par firstName asc', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, TEST_GARAGE_ID);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { firstName: 'asc' } }),
      );
    });

    it('select contient id, email, status, phone, employeeCode et exclut passwordHash', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, TEST_GARAGE_ID);

      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.select.id).toBe(true);
      expect(call.select.email).toBe(true);
      expect(call.select.status).toBe(true);
      expect(call.select.firstName).toBe(true);
      expect(call.select.lastName).toBe(true);
      expect(call.select.phone).toBe(true);
      expect(call.select.employeeCode).toBe(true);
      expect(call.select.createdAt).toBe(true);
      expect(call.select).not.toHaveProperty('passwordHash');
    });

    it('select.roles inclut uniquement les rôles actifs (revokedAt: null)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, undefined, TEST_GARAGE_ID);

      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.select.roles.where).toEqual({ revokedAt: null });
      expect(call.select.roles.include.role).toBe(true);
    });

    it('OR contient les 4 champs de recherche avec la bonne valeur', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll('Jean', undefined, TEST_GARAGE_ID);

      const where = prismaMock.user.findMany.mock.calls[0][0].where;
      expect(where.OR[0]).toEqual({ firstName: { contains: 'Jean', mode: 'insensitive' } });
      expect(where.OR[1]).toEqual({ lastName: { contains: 'Jean', mode: 'insensitive' } });
      expect(where.OR[2]).toEqual({ email: { contains: 'Jean', mode: 'insensitive' } });
      expect(where.OR[3]).toEqual({ employeeCode: { contains: 'Jean', mode: 'insensitive' } });
    });
  });

  describe('findOne()', () => {
    it('lève NotFoundException si membre introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('inexistant', TEST_GARAGE_ID)).rejects.toThrow(
        new NotFoundException("Membre de l'équipe introuvable"),
      );
    });

    it('retourne le membre avec ses rôles actifs', async () => {
      const { service, prismaMock } = makeDeps();
      const user = { id: 'u-1', firstName: 'Jean', roles: [], assignedOTs: [], workItems: [] };
      prismaMock.user.findFirst
        .mockResolvedValueOnce({ id: 'u-1', garageId: TEST_GARAGE_ID }) // assertion
        .mockResolvedValueOnce(user); // data

      const result = await service.findOne('u-1', TEST_GARAGE_ID);

      expect(result).toEqual(user);
    });

    it('select contient lastLoginAt, rôles actifs, OTs assignés et workItems en cours', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst
        .mockResolvedValueOnce({ id: 'u-1', garageId: TEST_GARAGE_ID }) // assertion
        .mockResolvedValueOnce({ id: 'u-1', roles: [], assignedOTs: [], workItems: [] }); // data

      await service.findOne('u-1', TEST_GARAGE_ID);

      const call = prismaMock.user.findFirst.mock.calls[1][0];
      expect(call.select.id).toBe(true);
      expect(call.select.email).toBe(true);
      expect(call.select.phone).toBe(true);
      expect(call.select.status).toBe(true);
      expect(call.select.employeeCode).toBe(true);
      expect(call.select.lastLoginAt).toBe(true);
      expect(call.select.roles.where).toEqual({ revokedAt: null });
      expect(call.select.roles.include.role).toBe(true);
      expect(call.select.assignedOTs.where.status.notIn).toEqual(
        expect.arrayContaining(['CLOSED', 'CANCELLED']),
      );
      expect(call.select.assignedOTs.include.vehicle).toBe(true);
      expect(call.select.workItems.where).toEqual({ status: 'IN_PROGRESS' });
      expect(call.select.workItems.include.serviceOrder.select.reference).toBe(true);
    });
  });

  describe('create()', () => {
    it('hash le mot de passe et crée l\'utilisateur avec identifiant prenom.nom', async () => {
      const { service, prismaMock } = makeDeps();
      // Pas de doublon → code jean.dupont disponible
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: 'u-1', firstName: 'Jean', lastName: 'Dupont', employeeCode: 'jean.dupont',
      });

      await service.create({ firstName: 'Jean', lastName: 'Dupont', password: 'Secret123!', garageId: TEST_GARAGE_ID });

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 10);
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-password', employeeCode: 'jean.dupont' }),
        }),
      );
    });

    it('génère prenom.nom si aucun doublon existant', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1', employeeCode: 'test.user' });

      await service.create({ firstName: 'Test', lastName: 'User', garageId: TEST_GARAGE_ID });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeCode: 'test.user' }),
        }),
      );
    });

    it('mot de passe auto robuste, jamais stocké en clair, renvoyé une fois, changement imposé', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      const result = await service.create({ firstName: 'Test', lastName: 'User', garageId: TEST_GARAGE_ID });

      // Format « Xk7m-Pq4r-Zt9w » (générateur cryptographique), plus « PrénomNNNN! ».
      const hashed = bcrypt.hash.mock.calls[bcrypt.hash.mock.calls.length - 1][0] as string;
      expect(hashed).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(hashed).not.toMatch(/^Test/);

      const data = prismaMock.user.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('tempPassword');
      expect(data.mustChangePassword).toBe(true);
      expect((result as { tempPassword?: string }).tempPassword).toBe(hashed); // affichage unique côté front
    });

    it('réinitialisation : rien en clair, changement imposé, sessions révoquées, mot de passe renvoyé une fois', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.update.mockResolvedValue({ id: 'u-1', employeeCode: 'test.user', firstName: 'Test', lastName: 'User' });

      const result = await service.resetPassword('u-1', undefined, TEST_GARAGE_ID);

      const { data, select } = prismaMock.user.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('tempPassword');
      expect(select).not.toHaveProperty('tempPassword');
      expect(data).toMatchObject({ mustChangePassword: true, tokenVersion: { increment: 1 }, passwordResetRequestedAt: null });
      expect(result.tempPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    });

    it('assigne le rôle si roleCode fourni', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-tech', code: 'TECHNICIEN' });
      prismaMock.userRole.create.mockResolvedValue({});

      await service.create({
        firstName: 'Paul',
        lastName: 'Tech',
        roleCode: 'TECHNICIEN',
        garageId: TEST_GARAGE_ID,
      });

      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'u-1', roleId: 'role-tech' },
      });
    });

    it('ne crée pas de UserRole si roleCode absent', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      await service.create({ firstName: 'Test', lastName: 'User', garageId: TEST_GARAGE_ID });

      expect(prismaMock.userRole.create).not.toHaveBeenCalled();
    });

    it('select contient id, employeeCode, firstName, lastName, email, phone, status', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      await service.create({ firstName: 'Test', lastName: 'User', garageId: TEST_GARAGE_ID });

      const call = prismaMock.user.create.mock.calls[0][0];
      expect(call.select.id).toBe(true);
      expect(call.select.employeeCode).toBe(true);
      expect(call.select.firstName).toBe(true);
      expect(call.select.lastName).toBe(true);
      expect(call.select.email).toBe(true);
      expect(call.select.phone).toBe(true);
      expect(call.select.status).toBe(true);
    });
  });

  describe('invitations (#15)', () => {
    it('avec e-mail : invitation envoyée, aucun mot de passe renvoyé, compte inutilisable avant acceptation', async () => {
      const { service, prismaMock, invitationsMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1', employeeCode: 'marie.nkolo' });

      const result = await service.create({
        firstName: 'Marie', lastName: 'Nkolo', email: '  Marie@Garage.CM ', roleCode: 'TECHNICIEN',
        garageId: TEST_GARAGE_ID, invitedBy: { firstName: 'Jennifer', lastName: 'Admin' },
      });

      const data = prismaMock.user.create.mock.calls[0][0].data;
      expect(data.email).toBe('marie@garage.cm');
      expect(data.mustChangePassword).toBe(false);
      expect(data.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.inviteExpiresAt.getTime() - data.inviteSentAt.getTime()).toBe(72 * 3600 * 1000);
      expect(data).not.toHaveProperty('tempPassword');
      // Mot de passe de remplissage aléatoire (43 car. base64url), jamais renvoyé.
      expect(bcrypt.hash.mock.calls[bcrypt.hash.mock.calls.length - 1][0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result).not.toHaveProperty('tempPassword');
      expect(result).toMatchObject({ invitation: { status: 'pending', email: 'marie@garage.cm', emailStatus: 'sent' } });
      expect(JSON.stringify(result)).not.toContain(data.inviteTokenHash);

      const [recipient, sent] = invitationsMock.deliver.mock.calls[0];
      expect(recipient).toMatchObject({ userId: 'u-1', email: 'marie@garage.cm', workshopName: 'Garage Akwa', invitedByName: 'Jennifer Admin', roleCode: 'TECHNICIEN' });
      expect(sent.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('sans e-mail : repli sur le mot de passe temporaire affiché une fois', async () => {
      const { service, prismaMock, invitationsMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      const result = await service.create({ firstName: 'Paul', lastName: 'Tech', email: '', garageId: TEST_GARAGE_ID });

      expect(invitationsMock.issue).not.toHaveBeenCalled();
      expect(invitationsMock.deliver).not.toHaveBeenCalled();
      expect(prismaMock.user.create.mock.calls[0][0].data).toMatchObject({ mustChangePassword: true, email: undefined });
      expect(result).toHaveProperty('tempPassword');
    });

    it('findAll expose invitationStatus dérivé et jamais l’empreinte du jeton', async () => {
      const { service, prismaMock } = makeDeps();
      const future = new Date(Date.now() + 3600_000);
      const past = new Date(Date.now() - 3600_000);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'a', inviteTokenHash: null, inviteExpiresAt: null, inviteAcceptedAt: null },
        { id: 'b', inviteTokenHash: 'h1', inviteExpiresAt: future, inviteAcceptedAt: null },
        { id: 'c', inviteTokenHash: 'h2', inviteExpiresAt: past, inviteAcceptedAt: null },
        { id: 'd', inviteTokenHash: 'h3', inviteExpiresAt: past, inviteAcceptedAt: past },
      ]);

      const members = await service.findAll(undefined, undefined, TEST_GARAGE_ID);

      expect(members.map((m: any) => m.invitationStatus)).toEqual(['none', 'pending', 'expired', 'accepted']);
      members.forEach((m: any) => expect(m).not.toHaveProperty('inviteTokenHash'));
    });

    it('réinitialisation du mot de passe : le lien d’invitation en cours devient invalide', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.update.mockResolvedValue({ id: 'u-1' });

      await service.resetPassword('u-1', undefined, TEST_GARAGE_ID);

      expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({ inviteTokenHash: null, inviteExpiresAt: null });
    });

    it('changement d’e-mail : l’invitation envoyée à l’ancienne adresse expire', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u-1', email: 'old@garage.cm' });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1' });

      await service.update('u-1', { email: 'new@garage.cm' }, TEST_GARAGE_ID);

      const { where, data } = prismaMock.user.updateMany.mock.calls[0][0];
      expect(where).toMatchObject({ id: 'u-1', inviteAcceptedAt: null });
      expect(data.inviteExpiresAt).toBeInstanceOf(Date);
    });

    it('e-mail inchangé : aucune invalidation', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue({ id: 'u-1', email: 'same@garage.cm' });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1' });

      await service.update('u-1', { email: 'same@garage.cm', phone: '699' }, TEST_GARAGE_ID);

      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('lève NotFoundException si le membre est introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.update('inexistant', {}, TEST_GARAGE_ID)).rejects.toThrow(NotFoundException);
    });

    it('appelle user.update si le membre existe', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1', firstName: 'Jean' });

      await service.update('u-1', { phone: '699001122' }, TEST_GARAGE_ID);

      const call = prismaMock.user.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'u-1' });
      expect(call.data).toEqual({ phone: '699001122' });
      expect(call.select.id).toBe(true);
      expect(call.select.employeeCode).toBe(true);
      expect(call.select.firstName).toBe(true);
      expect(call.select.lastName).toBe(true);
      expect(call.select.email).toBe(true);
      expect(call.select.phone).toBe(true);
      expect(call.select.status).toBe(true);
    });
  });

  describe('generateEmployeeCode (via create)', () => {
    it('ajoute un suffixe numérique si prenom.nom existe déjà', async () => {
      const { service, prismaMock } = makeDeps();
      // test.user existe → test.user2 libre
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // test.user → doublon
        .mockResolvedValueOnce(null);               // test.user2 → libre
      prismaMock.user.create.mockResolvedValue({ id: 'u-1', employeeCode: 'test.user2' });

      await service.create({ firstName: 'Test', lastName: 'User', garageId: TEST_GARAGE_ID });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeCode: 'test.user2' }),
        }),
      );
    });
  });

  describe('assignRole()', () => {
    it('révoque les rôles actifs puis assigne le nouveau', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst
        .mockResolvedValueOnce({ id: 'u-1', garageId: TEST_GARAGE_ID }) // assertion
        .mockResolvedValueOnce({ id: 'u-1', roles: [], assignedOTs: [], workItems: [] }); // data
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-chef', code: 'CHEF_ATELIER' });
      prismaMock.userRole.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.userRole.create.mockResolvedValue({ role: { code: 'CHEF_ATELIER' } });

      await service.assignRole('u-1', 'CHEF_ATELIER', TEST_GARAGE_ID);

      expect(prismaMock.userRole.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prismaMock.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'u-1', roleId: 'role-chef' },
          include: { role: true },
        }),
      );
    });

    it('lève NotFoundException si rôle inconnu', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst
        .mockResolvedValueOnce({ id: 'u-1', garageId: TEST_GARAGE_ID }) // assertion
        .mockResolvedValueOnce({ id: 'u-1', roles: [], assignedOTs: [], workItems: [] }); // data

      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(service.assignRole('u-1', 'INEXISTANT', TEST_GARAGE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('soft delete avec status DELETED', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1' });

      await service.remove('u-1', TEST_GARAGE_ID);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { deletedAt: expect.any(Date), status: 'DELETED' },
        select: { id: true },
      });
    });
  });
});
