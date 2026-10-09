import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClientIpThrottlerGuard } from '../../shared/security/client-ip-throttler.guard';
import { WhatsAppTestController } from '../../modules/notifications/whatsapp-test.controller';
import { WhatsAppTestService } from '../../modules/notifications/whatsapp-test.service';
import { PermanentMessagingError, WHATSAPP_PROVIDER } from '../../modules/messaging';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

const ALLOWED = '+237699000001';
const SUPER_TOKEN = signTestToken('super-1');
const ADMIN_TOKEN = signTestToken('admin-1');

function makeProvider() {
  return {
    name: 'whatsapp-cloud',
    sendWhatsAppMessage: jest.fn(),
    sendTemplate: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.TEST', status: 'QUEUED' }),
  };
}

async function makeApp(provider: ReturnType<typeof makeProvider>) {
  const prisma = makeIntegrationPrismaMock();
  prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(
      where.id === 'super-1'
        ? makeDbUser('super-1', ['SUPER_ADMIN'], [])
        : makeDbUser('admin-1', ['ADMIN'], []),
    ),
  );
  return createTestApp({
    moduleImports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
    controllers: [WhatsAppTestController],
    extraProviders: [
      { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
      WhatsAppTestService,
      { provide: WHATSAPP_PROVIDER, useValue: provider },
    ],
    prismaOverride: prisma,
  });
}

describe('POST /api/notifications/whatsapp/test — contrat HTTP', () => {
  const previous = process.env.WHATSAPP_TEST_RECIPIENTS;
  let app: INestApplication;
  let provider: ReturnType<typeof makeProvider>;
  let ip = 0;

  const post = (body: object, token = SUPER_TOKEN) =>
    request(app.getHttpServer())
      .post('/api/notifications/whatsapp/test')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', `41.202.0.${++ip}`)
      .send(body);

  beforeAll(async () => {
    process.env.WHATSAPP_TEST_RECIPIENTS = `${ALLOWED}, 677 00 00 02`;
    provider = makeProvider();
    ({ app } = await makeApp(provider));
  });
  afterAll(async () => {
    process.env.WHATSAPP_TEST_RECIPIENTS = previous;
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('envoie hello_world (en_US) par défaut à un destinataire autorisé', async () => {
    const res = await post({ to: '699 00 00 01' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      provider: 'whatsapp-cloud',
      templateName: 'hello_world',
      language: 'en_US',
      providerMessageId: 'wamid.TEST',
      status: 'QUEUED',
    });
    expect(res.body.to).not.toContain('699000001');
    expect(provider.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: ALLOWED, templateName: 'hello_world', language: 'en_US', variables: [] }),
    );
  });

  it('refuse un destinataire hors de WHATSAPP_TEST_RECIPIENTS (403), sans appel fournisseur', async () => {
    const res = await post({ to: '+237690000009' });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('WHATSAPP_TEST_RECIPIENT_NOT_ALLOWED');
    expect(provider.sendTemplate).not.toHaveBeenCalled();
  });

  it('refuse un ADMIN de garage : route réservée à la plateforme', async () => {
    const res = await post({ to: ALLOWED }, ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(provider.sendTemplate).not.toHaveBeenCalled();
  });

  it('rejette un numéro invalide (400) et un nom de modèle non conforme (400)', async () => {
    expect((await post({ to: 'abc' })).body.errorCode).toBe('WHATSAPP_INVALID_RECIPIENT');
    expect((await post({ to: ALLOWED, templateName: 'Hello World' })).status).toBe(400);
    expect(provider.sendTemplate).not.toHaveBeenCalled();
  });

  it('transmet le refus Meta en 502 avec le code fournisseur', async () => {
    provider.sendTemplate.mockRejectedValueOnce(
      new PermanentMessagingError('INVALID_RECIPIENT', "WhatsApp a refusé l'envoi (HTTP 400, code 131030, INVALID_RECIPIENT).", 'whatsapp-cloud'),
    );

    const res = await post({ to: ALLOWED });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      errorCode: 'WHATSAPP_SEND_FAILED',
      providerErrorCode: 'INVALID_RECIPIENT',
      permanent: true,
    });
    expect(res.body.message).toContain('131030');
  });

  it('limite à 5 envois par minute et par IP (429)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/notifications/whatsapp/test')
        .set('Authorization', `Bearer ${SUPER_TOKEN}`)
        .set('X-Forwarded-For', '41.202.9.9')
        .send({ to: ALLOWED });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });
});
