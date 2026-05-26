import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn(), genSalt: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { compare: jest.Mock };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER = makeDbUser('admin-1', ['ADMIN'], []);

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Auth — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeIntegrationPrismaMock>;

  beforeAll(async () => {
    prisma = makeIntegrationPrismaMock();
    ({ app } = await createTestApp({
      controllers: [AuthController],
      extraProviders: [AuthService],
      prismaOverride: prisma,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  // ── POST /api/auth/login ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('200 — credentials valides → retourne access_token', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@atelier.cm',
        status: 'ACTIVE',
        tokenVersion: 1,
        firstName: 'Admin',
        lastName: 'Test',
        passwordHash: '$2b$10$hash',
        employeeCode: 'ADM001',
      });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe('admin@atelier.cm');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('401 — utilisateur introuvable', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'fantome@atelier.cm', password: 'n-importe-quoi' });

      expect(res.status).toBe(401);
    });

    it('401 — mot de passe incorrect', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        status: 'ACTIVE',
        tokenVersion: 1,
        passwordHash: '$2b$10$hash',
      });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'mauvais-mdp' });

      expect(res.status).toBe(401);
    });

    it('401 — compte désactivé → message explicite', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        status: 'INACTIVE',
        tokenVersion: 1,
        passwordHash: '$2b$10$hash',
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Compte désactivé');
    });
  });

  // ── GET /api/auth/profile ─────────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/profile');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Token manquant');
    });

    it('401 — token malformé', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer token-invalide-xyz');

      expect(res.status).toBe(401);
    });

    it('401 — tokenVersion révoqué (session expirée côté serveur)', async () => {
      const token = signTestToken('admin-1', 1);
      // DB retourne version=2 → JWT version=1 → mismatch → 401
      prisma.user.findUnique.mockResolvedValue(
        makeDbUser('admin-1', ['ADMIN'], [], { tokenVersion: 2 }),
      );

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Session invalide ou expirée');
    });

    it('200 — token valide → retourne le profil complet', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(
        makeDbUser('admin-1', ['ADMIN'], ['VEH_VIEW', 'FAC_CREATE']),
      );

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('admin-1');
      expect(res.body.roles).toContain('ADMIN');
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });

    it('200 — logout révoque la session (tokenVersion incrémenté)', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(ADMIN_USER);

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // La DB doit avoir été appelée pour incrémenter tokenVersion
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );
    });
  });
});
