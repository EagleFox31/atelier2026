import request from 'supertest';
import helmet from 'helmet';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiHelmetOptions } from '../http-security';

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class PingModule {}

/** Reproduit l'ordre de `main.ts` : Helmet → préfixe `api` → Swagger `api/docs`. */
async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(PingModule, { logger: false });
  app.use(helmet(apiHelmetOptions()));
  app.setGlobalPrefix('api');
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('t').build());
  SwaggerModule.setup('api/docs', app, document);
  await app.init();
  return app;
}

function directives(header: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values.join(' '));
  }
  return map;
}

describe('En-têtes de sécurité de l\'API (Helmet / CSP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(() => app.close());

  it('envoie une CSP bloquante (pas report-only) sur les routes JSON', async () => {
    const res = await request(app.getHttpServer()).get('/api/ping').expect(200);

    expect(res.body).toEqual({ ok: true });
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
    const csp = directives(res.headers['content-security-policy']);
    expect(csp.get('default-src')).toBe("'self'");
    expect(csp.get('script-src')).toBe("'self'");
    expect(csp.get('object-src')).toBe("'none'");
    expect(csp.get('frame-ancestors')).toBe("'self'");
    // Retiré volontairement : casserait Swagger servi en HTTP (dev, IP brute).
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });

  it('garde Swagger UI compatible : aucun script inline, ressources sur la même origine', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs/').expect(200);

    expect(res.headers['content-security-policy']).toBeDefined();
    const html = res.text;
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes, body] of scripts) {
      // script-src 'self' n'autorise que des fichiers, jamais du code inline.
      expect(attributes).toMatch(/\ssrc="(?!https?:|\/\/)[^"]+"/);
      expect(body.trim()).toBe('');
    }
    expect(html).not.toMatch(/<(script|link)\b[^>]*(src|href)="(https?:)?\/\//i);

    await request(app.getHttpServer()).get('/api/docs/swagger-ui-init.js').expect(200);
    await request(app.getHttpServer()).get('/api/docs/swagger-ui-bundle.js').expect(200);
    await request(app.getHttpServer()).get('/api/docs/swagger-ui.css').expect(200);
  });
});
