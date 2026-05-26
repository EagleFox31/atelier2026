import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { JwtSecretsService } from '../jwt-secrets.service';

// bcrypt est une extension native — ses propriétés sont non-configurables,
// jest.spyOn ne peut pas les redéfinir. On mock le module entier.
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { compare: jest.Mock };

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'chef@atelier.cm',
    employeeCode: 'EMP001',
    passwordHash: '$2b$10$hashedpassword',
    status: 'ACTIVE',
    tokenVersion: 1,
    firstName: 'Jean',
    lastName: 'Dupont',
    ...overrides,
  };
}

function makeDeps() {
  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const jwtMock = {
    signAsync: jest.fn().mockResolvedValue('jwt-token-signed'),
  } as unknown as JwtService;

  const jwtSecrets = new JwtSecretsService();
  const service = new AuthService(prismaMock as any, jwtMock, jwtSecrets);
  return { service, prismaMock, jwtMock, jwtSecrets };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login()', () => {
    it('lève UnauthorizedException si l\'utilisateur n\'existe pas', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.login('inconnu@test.cm', 'motdepasse')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('lève UnauthorizedException si le compte est INACTIVE', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(makeUser({ status: 'INACTIVE' }));

      await expect(service.login('chef@atelier.cm', 'Atelier2026!')).rejects.toThrow(
        new UnauthorizedException('Compte désactivé'),
      );
    });

    it('lève UnauthorizedException si le mot de passe est incorrect', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(false);

      await expect(service.login('chef@atelier.cm', 'mauvais-mdp')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('retourne access_token + profil minimal si credentials valides', async () => {
      const { service, prismaMock, jwtMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login('chef@atelier.cm', 'Atelier2026!');

      expect(result.access_token).toBe('jwt-token-signed');
      expect(jwtMock.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', version: 1 }),
        expect.objectContaining({ secret: expect.any(String), expiresIn: expect.any(String) }),
      );
      expect(result.user.email).toBe('chef@atelier.cm');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('met à jour lastLoginAt après une connexion réussie', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(true);

      await service.login('chef@atelier.cm', 'Atelier2026!');

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });

    it('accepte le code employé en plus de l\'email', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.findFirst.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(true);

      await service.login('EMP001', 'Atelier2026!');

      const call = prismaMock.user.findFirst.mock.calls[0][0];
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ employeeCode: 'EMP001' }),
        ]),
      );
    });
  });

  describe('logout()', () => {
    it('incrémente tokenVersion pour invalider tous les JWT existants', async () => {
      const { service, prismaMock } = makeDeps();

      await service.logout('user-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    it('retourne { success: true }', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.logout('user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('completeOnboarding()', () => {
    it('enregistre onboardingCompletedAt en base', async () => {
      const { service, prismaMock } = makeDeps();
      const completedAt = new Date('2026-05-25T10:00:00.000Z');
      prismaMock.user.update.mockResolvedValue({ onboardingCompletedAt: completedAt });

      const result = await service.completeOnboarding('user-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { onboardingCompletedAt: expect.any(Date) },
        select: { onboardingCompletedAt: true },
      });
      expect(result.onboardingCompletedAt).toBe(completedAt.toISOString());
    });
  });
});
