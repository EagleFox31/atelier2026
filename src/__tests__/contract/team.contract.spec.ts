import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TeamController } from '../../modules/team/team.controller';
import { TeamService } from '../../modules/team/team.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('$2b$10$hashed') }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER  = makeDbUser('admin-1', ['ADMIN'],         []);
const CHEF_PERMS  = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER   = makeDbUser('chef-1',  ['CHEF_ATELIER'], CHEF_PERMS);
const TECH_PERMS  = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];
const TECH_USER   = makeDbUser('tech-1',  ['TECHNICIEN'],   TECH_PERMS);

const ADMIN_TOKEN = signTestToken('admin-1', 1);
const CHEF_TOKEN  = signTestToken('chef-1', 1);
const TECH_TOKEN  = signTestToken('tech-1', 1);

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID   = 'role-technicien';

const MEMBER_STUB = {
  id: MEMBER_ID, employeeCode: 'TECH001',
  firstName: 'Jean', lastName: 'Tech',
  email: 'jean.tech@atelier.cm', phone: '+237699000001',
  status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z',
  roles: [{ role: { id: ROLE_ID, code: 'TECHNICIEN' } }],
};

function makeTeamPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    user: {
      ...base.user,
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    role:     { findUnique: jest.fn() },
    userRole: {
      create:     jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Team — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeTeamPrismaMock>;

  const mockUsers = ({ where }: { where: { id: string } }) => {
    if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
    if (where.id === 'chef-1')  return Promise.resolve(CHEF_USER);
    if (where.id === 'tech-1')  return Promise.resolve(TECH_USER);
    return Promise.resolve(null);
  };

  beforeAll(async () => {
    prisma = makeTeamPrismaMock();
    prisma.user.findUnique.mockImplementation(mockUsers);
    ({ app } = await createTestApp({
      controllers: [TeamController],
      extraProviders: [TeamService],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(mockUsers);
  });

  // ── GET /api/team ──────────────────────────────────────────────────────────

  describe('GET /api/team', () => {
    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer()).get('/api/team');

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });

    it('200 — tableau avec { id, firstName, lastName, status, roles }', async () => {
      prisma.user.findMany.mockResolvedValue([MEMBER_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        status: expect.any(String),
        roles: expect.any(Array),
      });
    });

    it('200 — aucun passwordHash dans la liste', async () => {
      prisma.user.findMany.mockResolvedValue([MEMBER_STUB]);

      const res = await request(app.getHttpServer())
        .get('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);

      expect(res.body[0]).not.toHaveProperty('passwordHash');
    });
  });

  // ── GET /api/team/:id ──────────────────────────────────────────────────────

  describe('GET /api/team/:id', () => {
    it('200 — shape : { id, firstName, lastName, email, status, roles, assignedOTs, workItems }', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
        if (where.id === MEMBER_ID) return Promise.resolve({
          ...MEMBER_STUB, assignedOTs: [], workItems: [], lastLoginAt: null,
        });
        return Promise.resolve(null);
      });

      const res = await request(app.getHttpServer())
        .get(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: MEMBER_ID,
        firstName: 'Jean',
        lastName: 'Tech',
        status: 'ACTIVE',
        roles: expect.any(Array),
        assignedOTs: expect.any(Array),
        workItems: expect.any(Array),
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('404 — membre inexistant → errorCode "Not Found", message contient "introuvable"', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
        return Promise.resolve(null);
      });

      const res = await request(app.getHttpServer())
        .get('/api/team/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        statusCode: 404,
        errorCode: 'Not Found',
        message: expect.stringContaining('introuvable'),
      });
    });
  });

  // ── POST /api/team ─────────────────────────────────────────────────────────

  describe('POST /api/team', () => {
    it('403 TECHNICIEN (pas ADMIN/CHEF_ATELIER) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${TECH_TOKEN}`)
        .send({ firstName: 'Test', lastName: 'User' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });

    it('201 — shape : { id, employeeCode, firstName, lastName, email, phone, status } — pas de passwordHash', async () => {
      prisma.user.create.mockResolvedValue({
        id: MEMBER_ID, employeeCode: 'T001',
        firstName: 'Marie', lastName: 'Nkolo',
        email: 'marie@atelier.cm', phone: null, status: 'ACTIVE',
      });

      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Marie', lastName: 'Nkolo', email: 'marie@atelier.cm' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        firstName: 'Marie',
        lastName: 'Nkolo',
        status: 'ACTIVE',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('400 validation — firstName manquant → message[] contient "firstName"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ lastName: 'Ngono' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.some((m: string) => m.includes('firstName'))).toBe(true);
    });
  });

  // ── PATCH /api/team/:id ────────────────────────────────────────────────────

  describe('PATCH /api/team/:id', () => {
    it('200 — shape : { id, firstName, lastName, email }', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'chef-1')  return Promise.resolve(CHEF_USER);
        if (where.id === MEMBER_ID) return Promise.resolve({ ...MEMBER_STUB, assignedOTs: [], workItems: [] });
        return Promise.resolve(null);
      });
      prisma.user.update.mockResolvedValue({
        id: MEMBER_ID, firstName: 'Jean-Claude', lastName: 'Tech', email: 'jean.tech@atelier.cm',
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Jean-Claude' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: MEMBER_ID,
        firstName: 'Jean-Claude',
        lastName: 'Tech',
        email: 'jean.tech@atelier.cm',
      });
    });

    it('404 — membre inexistant → errorCode "Not Found"', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
        return Promise.resolve(null);
      });

      const res = await request(app.getHttpServer())
        .patch('/api/team/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('Not Found');
    });
  });

  // ── PATCH /api/team/:id/role ───────────────────────────────────────────────

  describe('PATCH /api/team/:id/role', () => {
    it('200 — shape : { id, userId, roleId, role }', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
        if (where.id === MEMBER_ID) return Promise.resolve({ ...MEMBER_STUB, assignedOTs: [], workItems: [] });
        return Promise.resolve(null);
      });
      prisma.role.findUnique.mockResolvedValue({ id: ROLE_ID, code: 'CHEF_ATELIER' });
      prisma.userRole.updateMany.mockResolvedValue({ count: 1 });
      prisma.userRole.create.mockResolvedValue({
        id: 'ur-new', userId: MEMBER_ID, roleId: ROLE_ID,
        role: { id: ROLE_ID, code: 'CHEF_ATELIER' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/team/${MEMBER_ID}/role`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ roleCode: 'CHEF_ATELIER' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: MEMBER_ID,
        role: expect.objectContaining({ code: 'CHEF_ATELIER' }),
      });
    });

    it('403 CHEF_ATELIER sur /role (RequireRole ADMIN only) → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/team/${MEMBER_ID}/role`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ roleCode: 'TECHNICIEN' });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });
  });

  // ── DELETE /api/team/:id ───────────────────────────────────────────────────

  describe('DELETE /api/team/:id', () => {
    it('200 — soft delete : retourne { id }', async () => {
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
        if (where.id === MEMBER_ID) return Promise.resolve({ ...MEMBER_STUB, assignedOTs: [], workItems: [] });
        return Promise.resolve(null);
      });
      prisma.user.update.mockResolvedValue({ id: MEMBER_ID });

      const res = await request(app.getHttpServer())
        .delete(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: MEMBER_ID });
    });
  });
});
