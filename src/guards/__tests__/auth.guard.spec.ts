import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth.guard';
import { JwtSecretsService } from '../../modules/auth/jwt-secrets.service';
import { setNodeEnv } from '../../test-utils/env';

describe('JwtAuthGuard', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    jest.clearAllMocks();
  });

  function makeGuard(prismaUser: unknown, { isPublic = false } = {}) {
    const jwtSecrets = new JwtSecretsService();
    const jwtService = new JwtService({ secret: jwtSecrets.getSigningSecret() });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(prismaUser) },
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    } as unknown as Reflector;

    return {
      guard: new JwtAuthGuard(jwtService, reflector, prisma as any, jwtSecrets),
      prisma,
      jwtService,
    };
  }

  function mockContext(authHeader?: string) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authHeader ? { authorization: authHeader } : {},
        }),
      }),
    } as any;
  }

  // ── Routes publiques ──────────────────────────────────────────────────────────

  it('laisse passer sans token si la route est @Public()', async () => {
    setNodeEnv('test');
    const { guard } = makeGuard(null, { isPublic: true });

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
  });

  // ── Absence de token ──────────────────────────────────────────────────────────

  it('rejette avec "Token manquant" si aucun header Authorization', async () => {
    setNodeEnv('test');
    const { guard } = makeGuard(null);

    await expect(guard.canActivate(mockContext())).rejects.toThrow(
      new UnauthorizedException('Token manquant'),
    );
  });

  it('rejette avec "Token manquant" si le header n\'utilise pas Bearer', async () => {
    setNodeEnv('test');
    const { guard } = makeGuard(null);

    await expect(guard.canActivate(mockContext('Basic dXNlcjpwYXNz'))).rejects.toThrow(
      new UnauthorizedException('Token manquant'),
    );
  });

  // ── Validation DB post-JWT ────────────────────────────────────────────────────

  it('rejette avec "Session invalide ou expirée" si utilisateur introuvable en DB', async () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters!!';
    const { guard, jwtService } = makeGuard(null); // findUnique → null

    const token = await jwtService.signAsync({ sub: 'ghost-user', email: 'ghost@test.cm', version: 1 });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toThrow(
      new UnauthorizedException('Session invalide ou expirée'),
    );
  });

  it('rejette avec "Session invalide ou expirée" si le compte est INACTIVE', async () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters!!';
    const { guard, jwtService } = makeGuard({
      id: 'user-1',
      status: 'INACTIVE',
      tokenVersion: 1,
      roles: [],
    });

    const token = await jwtService.signAsync({ sub: 'user-1', email: 'a@b.cm', version: 1 });

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toThrow(
      new UnauthorizedException('Session invalide ou expirée'),
    );
  });

  // ── Rotation JWT ──────────────────────────────────────────────────────────────

  it('accepte un token signé avec JWT_SECRET_PREVIOUS (période de grâce)', async () => {
    setNodeEnv('test');
    const previous = 'previous-secret-at-least-32-chars-long!!';
    const current = 'current-secret-at-least-32-characters!!';
    process.env.JWT_SECRET = current;
    process.env.JWT_SECRET_PREVIOUS = previous;

    const jwtService = new JwtService({ secret: previous });
    const token = await jwtService.signAsync(
      { sub: 'user-1', email: 'a@b.cm', version: 3 },
      { secret: previous },
    );

    const user = { id: 'user-1', status: 'ACTIVE', tokenVersion: 3, roles: [] };
    const { guard } = makeGuard(user);

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).resolves.toBe(true);
  });

  // ── Révocation logout ─────────────────────────────────────────────────────────

  it('rejette si tokenVersion ne correspond pas (révocation logout)', async () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters!!';

    const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
    const token = await jwtService.signAsync(
      { sub: 'user-1', version: 1 },
      { secret: process.env.JWT_SECRET },
    );

    const user = { id: 'user-1', status: 'ACTIVE', tokenVersion: 2, roles: [] };
    const { guard } = makeGuard(user);

    await expect(guard.canActivate(mockContext(`Bearer ${token}`))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
