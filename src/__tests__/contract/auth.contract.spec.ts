import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn(), genSalt: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { compare: jest.Mock };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DB_AUTH_USER = {
  id: 'admin-1',
  email: 'admin@atelier.cm',
  status: 'ACTIVE',
  tokenVersion: 1,
  firstName: 'Admin',
  lastName: 'Moukoury',
  passwordHash: '$2b$10$fakehash',
  employeeCode: 'ADM001',
};

const DB_PROFILE_USER = makeDbUser('admin-1', ['ADMIN'], ['VEH_VIEW', 'FAC_CREATE'], {
  email: 'admin@atelier.cm',
  firstName: 'Admin',
  lastName: 'Moukoury',
  employeeCode: 'ADM001',
  onboardingCompletedAt: null,
});

/** Enveloppe d'erreur produite par AllExceptionsFilter */
const ERROR_ENVELOPE = {
  statusCode: expect.any(Number),
  errorCode: expect.any(String),
  message: expect.anything(),
  timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  path: expect.any(String),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Auth — contrats de réponse HTTP', () => {
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

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ── POST /api/auth/login ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('200 — shape exacte : { access_token: string, user: { id, firstName, lastName, email, employeeCode } }', async () => {
      prisma.user.findFirst.mockResolvedValue(DB_AUTH_USER);
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.status).toBe(200);
      // toEqual (pas toMatchObject) → aucun champ supplémentaire autorisé
      expect(res.body).toEqual({
        access_token: expect.any(String),
        user: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'Moukoury',
          email: 'admin@atelier.cm',
          employeeCode: 'ADM001',
        },
      });
    });

    it('200 — access_token est un JWT valide (3 segments séparés par ".")', async () => {
      prisma.user.findFirst.mockResolvedValue(DB_AUTH_USER);
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.body.access_token.split('.')).toHaveLength(3);
    });

    it('200 — user ne contient pas passwordHash ni tokenVersion ni status', async () => {
      prisma.user.findFirst.mockResolvedValue(DB_AUTH_USER);
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('tokenVersion');
      expect(res.body.user).not.toHaveProperty('status');
      expect(res.body.user).not.toHaveProperty('roles');
    });

    it('401 — utilisateur introuvable → enveloppe erreur complète', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'fantome@test.cm', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        ...ERROR_ENVELOPE,
        statusCode: 401,
        errorCode: 'Unauthorized',
        path: '/api/auth/login',
      });
    });

    it('401 — mot de passe incorrect → même enveloppe errorCode Unauthorized', async () => {
      prisma.user.findFirst.mockResolvedValue(DB_AUTH_USER);
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'mauvais' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ statusCode: 401, errorCode: 'Unauthorized' });
    });

    it('401 — compte désactivé → message "Compte désactivé"', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...DB_AUTH_USER, status: 'INACTIVE' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Compte désactivé');
    });

    it('enveloppe erreur — exactement 5 clés (pas de fuite interne)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'x@x.cm', password: 'wrong' });

      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });
  });

  // ── GET /api/auth/profile ──────────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    it('200 — shape exacte : { id, firstName, lastName, email, employeeCode, status, roles, permissions }', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(DB_PROFILE_USER);

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'admin-1',
        firstName: 'Admin',
        lastName: 'Moukoury',
        email: 'admin@atelier.cm',
        employeeCode: 'ADM001',
        status: 'ACTIVE',
        roles: ['ADMIN'],
        permissions: ['VEH_VIEW', 'FAC_CREATE'],
        onboardingCompletedAt: null,
      });
    });

    it('200 — profile ne contient pas passwordHash ni tokenVersion', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(DB_PROFILE_USER);

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('tokenVersion');
      expect(res.body).not.toHaveProperty('deletedAt');
    });

    it('200 — roles et permissions sont des tableaux de strings', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(DB_PROFILE_USER);

      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(Array.isArray(res.body.roles)).toBe(true);
      expect(Array.isArray(res.body.permissions)).toBe(true);
      res.body.roles.forEach((r: unknown) => expect(typeof r).toBe('string'));
      res.body.permissions.forEach((p: unknown) => expect(typeof p).toBe('string'));
    });

    it('401 sans token → enveloppe erreur avec path correct', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        ...ERROR_ENVELOPE,
        statusCode: 401,
        errorCode: 'Unauthorized',
        path: '/api/auth/profile',
      });
    });

    it('401 token malformé → enveloppe erreur', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer token.invalide.xyz');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ statusCode: 401, errorCode: 'Unauthorized' });
    });
  });

  // ── POST /api/auth/logout ──────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('200 — shape exacte : { success: true, message: "Déconnecté avec succès (sessions invalidées)" }', async () => {
      const token = signTestToken('admin-1', 1);
      prisma.user.findUnique.mockResolvedValue(DB_PROFILE_USER);

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Déconnecté avec succès (sessions invalidées)',
      });
    });

    it('401 sans token → enveloppe erreur', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        statusCode: 401,
        errorCode: 'Unauthorized',
        path: '/api/auth/logout',
      });
    });
  });
});
