import { JwtService } from '@nestjs/jwt';
import { JwtSecretsService } from '../jwt-secrets.service';
import { setNodeEnv } from '../../../test-utils/env';

describe('JwtSecretsService', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('getSigningSecret() utilise JWT_SECRET', () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters-long';
    const svc = new JwtSecretsService();
    expect(svc.getSigningSecret()).toBe(process.env.JWT_SECRET);
  });

  it('getVerificationSecrets() inclut current et previous sans doublon', () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters-long';
    process.env.JWT_SECRET_PREVIOUS = 'previous-secret-at-least-32-chars-long';
    const svc = new JwtSecretsService();
    expect(svc.getVerificationSecrets()).toEqual([
      process.env.JWT_SECRET,
      process.env.JWT_SECRET_PREVIOUS,
    ]);
  });

  it('verifyAsync() accepte un token signé avec le secret previous', async () => {
    setNodeEnv('test');
    const previous = 'previous-secret-at-least-32-chars-long!!';
    const current = 'current-secret-at-least-32-characters!!';
    process.env.JWT_SECRET = current;
    process.env.JWT_SECRET_PREVIOUS = previous;

    const jwtService = new JwtService({ secret: previous });
    const token = await jwtService.signAsync(
      { sub: 'user-1', version: 2 },
      { secret: previous },
    );

    const svc = new JwtSecretsService();
    const payload = await svc.verifyAsync(jwtService, token);

    expect(payload.sub).toBe('user-1');
    expect(payload.version).toBe(2);
  });

  it('verifyAsync() accepte un token signé avec le secret current', async () => {
    setNodeEnv('test');
    const previous = 'previous-secret-at-least-32-chars-long!!';
    const current = 'current-secret-at-least-32-characters!!';
    process.env.JWT_SECRET = current;
    process.env.JWT_SECRET_PREVIOUS = previous;

    const jwtService = new JwtService({ secret: current });
    const token = await jwtService.signAsync(
      { sub: 'user-2', version: 0 },
      { secret: current },
    );

    const svc = new JwtSecretsService();
    const payload = await svc.verifyAsync(jwtService, token);

    expect(payload.sub).toBe('user-2');
  });

  it('verifyAsync() rejette un token signé avec un secret inconnu', async () => {
    setNodeEnv('test');
    process.env.JWT_SECRET = 'current-secret-at-least-32-characters!!';
    process.env.JWT_SECRET_PREVIOUS = 'previous-secret-at-least-32-chars-long!!';

    const jwtService = new JwtService({ secret: 'totally-unknown-secret-value-32c!' });
    const token = await jwtService.signAsync(
      { sub: 'user-3', version: 1 },
      { secret: 'totally-unknown-secret-value-32c!' },
    );

    const svc = new JwtSecretsService();
    await expect(svc.verifyAsync(jwtService, token)).rejects.toBeDefined();
  });

  it('échoue en production si JWT_SECRET est absent', () => {
    setNodeEnv('production');
    delete process.env.JWT_SECRET;
    delete process.env.JWT_SECRET_PREVIOUS;
    expect(() => new JwtSecretsService()).toThrow('JWT_SECRET est obligatoire en production');
  });
});
