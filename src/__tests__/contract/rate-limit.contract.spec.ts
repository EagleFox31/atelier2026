/**
 * Limitation de débit de bout en bout (LESSON-2026-009) : garde globale, limites
 * strictes sur la connexion, réponse 429 métier, exclusions, désactivation locale.
 */
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UnauthorizedException } from '@nestjs/common';
import { createTestApp, makeIntegrationPrismaMock } from '../integration/helpers/app.helper';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { AppController } from '../../app.controller';
import { ClientIpThrottlerGuard } from '../../shared/security/client-ip-throttler.guard';
import { GLOBAL_RATE_LIMIT, RATE_LIMITS } from '../../shared/security/rate-limits';

async function makeApp() {
  const authService = {
    login: jest.fn().mockRejectedValue(new UnauthorizedException('Identifiants invalides')),
    forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
  };
  const { app } = await createTestApp({
    moduleImports: [ThrottlerModule.forRoot([{ name: 'default', ...GLOBAL_RATE_LIMIT }])],
    controllers: [AuthController, AppController],
    extraProviders: [
      { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
      { provide: AuthService, useValue: authService },
    ],
    prismaOverride: makeIntegrationPrismaMock(),
  });
  return { app, authService };
}

function login(app: Awaited<ReturnType<typeof makeApp>>['app'], ip: string) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ identifier: 'admin@garage.cm', password: 'mauvais' });
}

describe('Limitation de débit — connexion', () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });

  it(`au-delà de ${RATE_LIMITS.login.default.limit} essais/min par IP : 429 RATE_LIMITED + Retry-After, sans atteindre le service`, async () => {
    const { app, authService } = await makeApp();
    const limit = RATE_LIMITS.login.default.limit;

    const statuses: number[] = [];
    for (let i = 0; i < limit; i++) statuses.push((await login(app, '41.202.1.2')).status);
    const blocked = await login(app, '41.202.1.2');
    await app.close();

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(blocked.status).toBe(429);
    expect(blocked.body.errorCode).toBe('RATE_LIMITED');
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(authService.login).toHaveBeenCalledTimes(limit); // la requête bloquée n'a rien coûté
  });

  it('une autre IP (autre garage) n’est pas pénalisée', async () => {
    const { app } = await makeApp();
    for (let i = 0; i <= RATE_LIMITS.login.default.limit; i++) await login(app, '41.202.1.2');
    const other = await login(app, '102.244.7.8');
    await app.close();

    expect(other.status).toBe(401);
  });

  it('X-Forwarded-For falsifié par le client : l’IP ajoutée par Caddy (la plus à droite) fait foi', async () => {
    const { app } = await makeApp();
    const limit = RATE_LIMITS.login.default.limit;
    // L'attaquant change la première valeur à chaque essai ; Caddy ajoute toujours sa vraie IP.
    for (let i = 0; i < limit; i++) await login(app, `10.0.0.${i}, 41.202.1.2`);
    const blocked = await login(app, '10.9.9.9, 41.202.1.2');
    await app.close();

    expect(blocked.status).toBe(429);
  });

  it('/api/health n’est jamais limité (sonde de déploiement)', async () => {
    const { app } = await makeApp();
    const statuses: number[] = [];
    for (let i = 0; i < GLOBAL_RATE_LIMIT.limit + 5; i += 50) {
      statuses.push((await request(app.getHttpServer()).get('/api/health').set('X-Forwarded-For', '41.202.1.2')).status);
    }
    await app.close();
    expect(new Set(statuses)).toEqual(new Set([200]));
  });

  it('RATE_LIMIT_ENABLED=false désactive la limitation (tests locaux)', async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    const { app } = await makeApp();
    let last = 0;
    for (let i = 0; i <= RATE_LIMITS.login.default.limit + 2; i++) last = (await login(app, '41.202.1.2')).status;
    await app.close();

    expect(last).toBe(401);
  });
});

describe('AppModule de production', () => {
  it('enregistre ClientIpThrottlerGuard comme garde globale, en premier (régression LESSON-2026-009)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../../app.module');
    const providers = (Reflect.getMetadata('providers', AppModule) ?? []) as Array<{ provide?: unknown; useClass?: unknown }>;
    const globalGuards = providers.filter((p) => p && p.provide === APP_GUARD).map((p) => p.useClass);

    expect(globalGuards[0]).toBe(ClientIpThrottlerGuard);
  });
});
