/**
 * Sécurité des mots de passe (LESSON-2026-008) :
 * générateur, changement imposé, blocage des routes, validation du nouveau mot de passe.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { generateTempPassword, TEMP_PASSWORD_ALPHABET } from '../../shared/security/temp-password';
import { AuthService } from '../../modules/auth/auth.service';
import { ChangePasswordDto } from '../../modules/auth/dto/change-password.dto';
import { JwtSecretsService } from '../../modules/auth/jwt-secrets.service';
import { JwtAuthGuard } from '../../guards/auth.guard';
import {
  ALLOW_PENDING_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
} from '../../decorators/auth.decorator';
import { setNodeEnv } from '../../test-utils/env';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn().mockResolvedValue('new-hash') }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { compare: jest.Mock; hash: jest.Mock };

describe('generateTempPassword', () => {
  it('format lisible XXXX-XXXX-XXXX, alphabet sans caractères ambigus', () => {
    for (let i = 0; i < 200; i++) {
      const pwd = generateTempPassword();
      expect(pwd).toMatch(/^.{4}-.{4}-.{4}$/);
      for (const ch of pwd.replace(/-/g, '')) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
    }
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it('pas de répétition sur 2 000 tirages (≈ 69 bits d’entropie)', () => {
    const seen = new Set(Array.from({ length: 2000 }, generateTempPassword));
    expect(seen.size).toBe(2000);
  });
});

describe('ChangePasswordDto (politique serveur)', () => {
  async function errors(newPassword: string) {
    return validate(plainToInstance(ChangePasswordDto, { currentPassword: 'x', newPassword }));
  }

  it.each([['court1'], ['sanschiffre-ici'], ['1234567890']])('refuse « %s »', async (pwd) => {
    expect((await errors(pwd)).length).toBeGreaterThan(0);
  });

  it('accepte un mot de passe de 10+ caractères avec lettre et chiffre', async () => {
    expect(await errors('Garage-Akwa-2026')).toHaveLength(0);
  });
});

describe('AuthService.changePassword', () => {
  function makeService() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', passwordHash: 'old-hash', tenantId: 't1', garageId: 'g1', email: 'a@b.cm' }),
        update: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.cm', tokenVersion: 3, tenantId: 't1', garageId: 'g1' }),
      },
    };
    const jwtSecrets = new JwtSecretsService();
    const service = new AuthService(prisma as never, new JwtService({}), jwtSecrets);
    return { service, prisma };
  }

  beforeEach(() => {
    setNodeEnv('test');
    jest.clearAllMocks();
  });

  it('mot de passe actuel incorrect → 400 CURRENT_PASSWORD_INVALID, aucune écriture', async () => {
    const { service, prisma } = makeService();
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(service.changePassword('u1', 'faux', 'Nouveau-mdp-2026')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'CURRENT_PASSWORD_INVALID' }),
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('nouveau = actuel → 400 PASSWORD_UNCHANGED', async () => {
    const { service } = makeService();
    bcrypt.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await expect(service.changePassword('u1', 'meme', 'meme')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('succès : hash, levée de l’obligation, sessions révoquées, nouveau jeton', async () => {
    const { service, prisma } = makeService();
    bcrypt.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await service.changePassword('u1', 'Xk7m-Pq4r-Zt9w', 'Garage-Akwa-2026');

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash', mustChangePassword: false, tokenVersion: { increment: 1 } },
    }));
    expect(res.mustChangePassword).toBe(false);
    expect(typeof res.access_token).toBe('string');
  });
});

describe('JwtAuthGuard — changement de mot de passe imposé', () => {
  async function run(mustChangePassword: boolean, allowed: boolean) {
    setNodeEnv('test');
    const jwtSecrets = new JwtSecretsService();
    const jwtService = new JwtService({ secret: jwtSecrets.getSigningSecret() });
    const token = await jwtService.signAsync({ sub: 'u1', version: 1 });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', status: 'ACTIVE', tokenVersion: 1, mustChangePassword, roles: [] }),
      },
    };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? false : key === ALLOW_PENDING_PASSWORD_CHANGE_KEY ? allowed : undefined)),
    };
    const guard = new JwtAuthGuard(jwtService, reflector as never, prisma as never, jwtSecrets);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
    } as never;
    return guard.canActivate(context);
  }

  it('bloque une route métier tant que le mot de passe n’est pas changé (403 PASSWORD_CHANGE_REQUIRED)', async () => {
    const result = run(true, false);
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run(true, false)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'PASSWORD_CHANGE_REQUIRED' }),
    });
  });

  it('laisse passer profil / déconnexion / changement (@AllowPendingPasswordChange)', async () => {
    await expect(run(true, true)).resolves.toBe(true);
  });

  it('aucun impact pour un utilisateur sans obligation', async () => {
    await expect(run(false, false)).resolves.toBe(true);
  });
});
