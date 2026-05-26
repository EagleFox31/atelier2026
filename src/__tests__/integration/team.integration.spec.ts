import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TeamController } from '../../modules/team/team.controller';
import { TeamService } from '../../modules/team/team.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

const ADMIN_USER  = makeDbUser('admin-1', ['ADMIN'], []);
const ADMIN_TOKEN = signTestToken('admin-1', 1);

const CHEF_PERMS  = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE'];
const CHEF_USER   = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN  = signTestToken('chef-1', 1);

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function makeTeamPrismaMock() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    // user.findMany requis par TeamService.findAll()
    user: {
      ...base.user,
      findMany: jest.fn().mockResolvedValue([]),
      create:   jest.fn(),
    },
    role:     { findUnique: jest.fn() },
    userRole: {
      create:     jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('Team — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeTeamPrismaMock>;

  const mockUsers = ({ where }: { where: { id: string } }) => {
    if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
    if (where.id === 'chef-1')  return Promise.resolve(CHEF_USER);
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

  // ─── GET /api/team ───────────────────────────────────────────────────────────

  describe('GET /api/team', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/team');
      expect(res.status).toBe(401);
    });

    it('200 — chef a ORD_VIEW → liste', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /api/team/:id ───────────────────────────────────────────────────────

  describe('GET /api/team/:id', () => {
    it('404 — membre introuvable', async () => {
      // MEMBER_ID n'est pas admin-1 ni chef-1 → findUnique retourne null
      const res = await request(app.getHttpServer())
        .get(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(404);
    });

    it('200 — retourne le membre', async () => {
      const member = { id: MEMBER_ID, firstName: 'Jean', roles: [], assignedOTs: [], workItems: [] };
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'chef-1')    return Promise.resolve(CHEF_USER);
        if (where.id === MEMBER_ID)   return Promise.resolve(member);
        return Promise.resolve(null);
      });

      const res = await request(app.getHttpServer())
        .get(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(MEMBER_ID);
    });
  });

  // ─── POST /api/team ──────────────────────────────────────────────────────────

  describe('POST /api/team', () => {
    it('403 — TECHNICIEN (pas ADMIN ni CHEF_ATELIER)', async () => {
      const techUser  = makeDbUser('tech-1', ['TECHNICIEN'], ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW']);
      const techToken = signTestToken('tech-1', 1);
      prisma.user.findUnique.mockResolvedValue(techUser);

      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${techToken}`)
        .send({ firstName: 'Jean', lastName: 'Dupont' });
      expect(res.status).toBe(403);
    });

    it('400 — firstName manquant (ValidationPipe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ lastName: 'Dupont' });
      expect(res.status).toBe(400);
    });

    it('201 — crée un membre (chef)', async () => {
      prisma.user.create.mockResolvedValue({ id: MEMBER_ID, firstName: 'Jean', status: 'ACTIVE' });

      const res = await request(app.getHttpServer())
        .post('/api/team')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ firstName: 'Jean', lastName: 'Dupont' });

      expect(res.status).toBe(201);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'Jean',
            lastName: 'Dupont',
            passwordHash: 'hashed-password',
          }),
        }),
      );
    });
  });

  // ─── PATCH /api/team/:id/role — RequireRole('ADMIN') ─────────────────────────

  describe('PATCH /api/team/:id/role', () => {
    it('403 — CHEF_ATELIER (pas ADMIN)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/team/${MEMBER_ID}/role`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ roleCode: 'TECHNICIEN' });
      expect(res.status).toBe(403);
    });

    it('200 — ADMIN assigne un rôle', async () => {
      const member = { id: MEMBER_ID, deletedAt: null };
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1')  return Promise.resolve(ADMIN_USER);
        if (where.id === MEMBER_ID)  return Promise.resolve(member);
        return Promise.resolve(null);
      });
      prisma.role.findUnique.mockResolvedValue({ id: 'role-tech', code: 'TECHNICIEN' });
      prisma.userRole.create.mockResolvedValue({ role: { code: 'TECHNICIEN' } });

      const res = await request(app.getHttpServer())
        .patch(`/api/team/${MEMBER_ID}/role`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ roleCode: 'TECHNICIEN' });

      expect(res.status).toBe(200);
      expect(prisma.userRole.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: MEMBER_ID, revokedAt: null } }),
      );
    });
  });

  // ─── DELETE /api/team/:id — RequireRole('ADMIN') ─────────────────────────────

  describe('DELETE /api/team/:id', () => {
    it('403 — CHEF_ATELIER ne peut pas supprimer', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`);
      expect(res.status).toBe(403);
    });

    it('200 — ADMIN soft-delete le membre', async () => {
      const member = { id: MEMBER_ID, deletedAt: null };
      prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'admin-1') return Promise.resolve(ADMIN_USER);
        if (where.id === MEMBER_ID) return Promise.resolve(member);
        return Promise.resolve(null);
      });
      prisma.user.update.mockResolvedValue({ id: MEMBER_ID });

      const res = await request(app.getHttpServer())
        .delete(`/api/team/${MEMBER_ID}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date), status: 'DELETED' }),
        }),
      );
    });
  });
});
