import { NotFoundException } from '@nestjs/common';
import { TeamService } from '../team.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { hash: jest.Mock };

function makeDeps() {
  const prismaMock = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: { findUnique: jest.fn() },
    userRole: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const service = new TeamService(prismaMock as any);
  return { service, prismaMock };
}

describe('TeamService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('filtre deletedAt: null par défaut', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('filtre textuel : OR sur 4 champs (prénom, nom, email, code employé)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll('Jean');

      const where = prismaMock.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(4);
    });

    it('filtre par roleId actif (revokedAt: null)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'role-1');

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

      await service.findAll();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { firstName: 'asc' } }),
      );
    });

    it('select contient id, email, status, phone, employeeCode et exclut passwordHash', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll();

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

      await service.findAll();

      const call = prismaMock.user.findMany.mock.calls[0][0];
      expect(call.select.roles.where).toEqual({ revokedAt: null });
      expect(call.select.roles.include.role).toBe(true);
    });

    it('OR contient les 4 champs de recherche avec la bonne valeur', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.findAll('Jean');

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
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('inexistant')).rejects.toThrow(
        new NotFoundException("Membre de l'équipe introuvable"),
      );
    });

    it('retourne le membre avec ses rôles actifs', async () => {
      const { service, prismaMock } = makeDeps();
      const user = { id: 'u-1', firstName: 'Jean', roles: [], assignedOTs: [], workItems: [] };
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('u-1');

      expect(result).toEqual(user);
    });

    it('select contient lastLoginAt, rôles actifs, OTs assignés et workItems en cours', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', roles: [], assignedOTs: [], workItems: [] });

      await service.findOne('u-1');

      const call = prismaMock.user.findUnique.mock.calls[0][0];
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
    it('hash le mot de passe et crée l\'utilisateur', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({
        id: 'u-1',
        firstName: 'Jean',
        lastName: 'Dupont',
        employeeCode: 'EMP-006',
      });

      await service.create({ firstName: 'Jean', lastName: 'Dupont', password: 'Secret123!' });

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 10);
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-password', employeeCode: 'EMP-006' }),
        }),
      );
    });

    it('génère EMP-001 si aucun code employé existant', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1', employeeCode: 'EMP-001' });

      await service.create({ firstName: 'Test', lastName: 'User' });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeCode: 'EMP-001' }),
        }),
      );
    });

    it('utilise le mot de passe par défaut (Atelier2026!) si aucun fourni', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-002' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      await service.create({ firstName: 'Test', lastName: 'User' });

      expect(bcrypt.hash).toHaveBeenCalledWith('Atelier2026!', 10);
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
      });

      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'u-1', roleId: 'role-tech' },
      });
    });

    it('ne crée pas de UserRole si roleCode absent', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      await service.create({ firstName: 'Test', lastName: 'User' });

      expect(prismaMock.userRole.create).not.toHaveBeenCalled();
    });

    it('select contient id, employeeCode, firstName, lastName, email, phone, status', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-005' }]);
      prismaMock.user.create.mockResolvedValue({ id: 'u-1' });

      await service.create({ firstName: 'Test', lastName: 'User' });

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

  describe('update()', () => {
    it('lève NotFoundException si le membre est introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.update('inexistant', {})).rejects.toThrow(NotFoundException);
    });

    it('appelle user.update si le membre existe', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1', firstName: 'Jean' });

      await service.update('u-1', { phone: '699001122' });

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
    it('lève une erreur si le code employé en base est invalide', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.$queryRaw.mockResolvedValue([{ employee_code: 'EMP-abc' }]);

      await expect(
        service.create({ firstName: 'Test', lastName: 'User' }),
      ).rejects.toThrow('Code employé invalide en base');
    });
  });

  describe('assignRole()', () => {
    it('révoque les rôles actifs puis assigne le nouveau', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-chef', code: 'CHEF_ATELIER' });
      prismaMock.userRole.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.userRole.create.mockResolvedValue({ role: { code: 'CHEF_ATELIER' } });

      await service.assignRole('u-1', 'CHEF_ATELIER');

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
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(service.assignRole('u-1', 'INEXISTANT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('soft delete avec status DELETED', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u-1', deletedAt: null });
      prismaMock.user.update.mockResolvedValue({ id: 'u-1' });

      await service.remove('u-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { deletedAt: expect.any(Date), status: 'DELETED' },
        select: { id: true },
      });
    });
  });
});
