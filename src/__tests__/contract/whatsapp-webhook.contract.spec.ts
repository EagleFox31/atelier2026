/**
 * Webhook WhatsApp Meta de bout en bout HTTP : parsers de production (corps brut),
 * gardes globales (JWT, permissions, débit), challenge, signature, codes d'erreur.
 * Non-régression : le webhook NotchPay reçoit toujours le corps brut exact.
 */
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { createTestApp, makeIntegrationPrismaMock } from '../integration/helpers/app.helper';
import { WHATSAPP_WEBHOOK_CONFIG, signMetaPayload, type WhatsAppWebhookConfig } from '../../modules/messaging';
import { WhatsAppWebhookController } from '../../modules/customer-notifications/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from '../../modules/customer-notifications/whatsapp-webhook.service';
import { WHATSAPP_WEBHOOK_EVENTS_QUEUE } from '../../modules/customer-notifications/whatsapp-webhook.queue';
import { getQueueToken } from '@nestjs/bullmq';
import { SubscriptionPaymentsController } from '../../modules/subscription/payments/subscription-payments.controller';
import { SubscriptionPaymentsService } from '../../modules/subscription/payments/subscription-payments.service';
import { ClientIpThrottlerGuard } from '../../shared/security/client-ip-throttler.guard';
import { GLOBAL_RATE_LIMIT, RATE_LIMITS } from '../../shared/security/rate-limits';
import { keepsRawBody } from '../../shared/http/body-parsers';

const SECRET = 'app-secret-0123456789abcdef';
const TOKEN = 'verify-token-0123456789';
const ENABLED: WhatsAppWebhookConfig = { enabled: true, verifyToken: TOKEN, appSecret: SECRET };

const PAYLOAD = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA',
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: '123456789012345' },
            statuses: [
              { id: 'wamid.A', status: 'sent', timestamp: '1760000000' },
              { id: 'wamid.A', status: 'delivered', timestamp: '1760000003' },
            ],
          },
        },
      ],
    },
  ],
};

async function makeApp(config: WhatsAppWebhookConfig = ENABLED) {
  const payments = { handleWebhook: jest.fn().mockResolvedValue({ received: true }) };
  const events = {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([{ id: 'ev1' }, { id: 'ev2' }]),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const prisma = Object.assign(makeIntegrationPrismaMock(), { whatsAppWebhookEvent: events });
  const { app } = await createTestApp({
    moduleImports: [ThrottlerModule.forRoot([{ name: 'default', ...GLOBAL_RATE_LIMIT }])],
    controllers: [WhatsAppWebhookController, SubscriptionPaymentsController],
    extraProviders: [
      { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
      { provide: WHATSAPP_WEBHOOK_CONFIG, useValue: config },
      WhatsAppWebhookService,
      { provide: SubscriptionPaymentsService, useValue: payments },
      { provide: getQueueToken(WHATSAPP_WEBHOOK_EVENTS_QUEUE), useValue: queue },
    ],
    prismaOverride: prisma,
    productionBodyParsers: true,
  });
  return { app, payments, events, queue };
}

type App = Awaited<ReturnType<typeof makeApp>>['app'];

function verifyRequest(app: App, query: Record<string, string>, ip = '41.202.1.2') {
  return request(app.getHttpServer()).get('/api/webhooks/whatsapp').query(query).set('X-Forwarded-For', ip);
}

function post(app: App, raw: string, signature?: string) {
  const req = request(app.getHttpServer()).post('/api/webhooks/whatsapp').set('Content-Type', 'application/json');
  if (signature !== undefined) req.set('X-Hub-Signature-256', signature);
  return req.send(raw);
}

describe('Webhook WhatsApp — vérification d’abonnement (GET)', () => {
  it('jeton valide : 200 text/plain, challenge exact, sans JWT', async () => {
    const { app } = await makeApp();
    const res = await verifyRequest(app, { 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': '1158201444' });
    await app.close();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toBe('1158201444');
  });

  it('jeton faux : 403 sans renvoyer le challenge', async () => {
    const { app } = await makeApp();
    const res = await verifyRequest(app, { 'hub.mode': 'subscribe', 'hub.verify_token': 'faux-jeton-0123456789', 'hub.challenge': '42' });
    await app.close();

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('WHATSAPP_WEBHOOK_VERIFICATION_FAILED');
    expect(res.text).not.toContain(TOKEN);
  });

  it(`au-delà de ${RATE_LIMITS.webhookVerify.default.limit} essais/min : 429 RATE_LIMITED (devinette du jeton)`, async () => {
    const { app } = await makeApp();
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMITS.webhookVerify.default.limit; i++) {
      statuses.push((await verifyRequest(app, { 'hub.mode': 'subscribe', 'hub.verify_token': `x${i}`.padEnd(20, 'x'), 'hub.challenge': '1' })).status);
    }
    await app.close();

    expect(statuses.slice(0, -1).every((s) => s === 403)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('secrets absents : 404 WHATSAPP_WEBHOOK_DISABLED (GET et POST)', async () => {
    const { app } = await makeApp({ enabled: false });
    const get = await verifyRequest(app, { 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': '1' });
    const raw = JSON.stringify(PAYLOAD);
    const posted = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect([get.status, posted.status]).toEqual([404, 404]);
    expect(posted.body.errorCode).toBe('WHATSAPP_WEBHOOK_DISABLED');
  });
});

describe('Webhook WhatsApp — notifications signées (POST)', () => {
  it('signature valide sur le corps brut exact : 200 et statuts lus', async () => {
    const { app } = await makeApp();
    // Espacement volontairement non canonique : la signature porte sur les octets reçus.
    const raw = JSON.stringify(PAYLOAD, null, 2);
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: 2, ignored: 0 });
  });

  it('accusés persistés AVANT la réponse, puis mis en file (jobId déterministe), sans numéro du client', async () => {
    const { app, events, queue } = await makeApp();
    const withRecipient = JSON.parse(JSON.stringify(PAYLOAD));
    withRecipient.entry[0].changes[0].value.statuses[0].recipient_id = '237690000001';
    const raw = JSON.stringify(withRecipient);
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(200);
    expect(events.createMany).toHaveBeenCalledTimes(1);
    const { data, skipDuplicates } = events.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data.map((row: { dedupKey: string }) => row.dedupKey)).toEqual([
      'status:123456789012345:wamid.A:sent',
      'status:123456789012345:wamid.A:delivered',
    ]);
    expect(JSON.stringify(data)).not.toContain('237690000001');
    expect(queue.add.mock.calls.map((call) => call[2].jobId)).toEqual(['wwe_ev1', 'wwe_ev2']);
  });

  it('base indisponible : 500, Meta renverra la notification (rien n’est acquitté)', async () => {
    const { app, events, queue } = await makeApp();
    events.createMany.mockRejectedValueOnce(new Error('connexion perdue'));
    const raw = JSON.stringify(PAYLOAD);
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(500);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('Redis indisponible : 200 quand même (accusés en base, repris par le balayeur)', async () => {
    const { app, queue } = await makeApp();
    queue.add.mockRejectedValue(new Error('ECONNREFUSED'));
    const raw = JSON.stringify(PAYLOAD);
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(200);
  });

  it('signature invalide : rien n’est écrit', async () => {
    const { app, events } = await makeApp();
    await post(app, JSON.stringify(PAYLOAD), `sha256=${'a'.repeat(64)}`);
    await app.close();

    expect(events.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ['absente', undefined],
    ['malformée', 'sha256=pas-hex'],
    ['falsifiée', `sha256=${'a'.repeat(64)}`],
    ['d’un autre secret', signMetaPayload(Buffer.from(JSON.stringify(PAYLOAD)), 'autre-secret-0123456789')],
  ])('signature %s : 401 INVALID_WHATSAPP_SIGNATURE', async (_label, signature) => {
    const { app } = await makeApp();
    const res = await post(app, JSON.stringify(PAYLOAD), signature);
    await app.close();

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INVALID_WHATSAPP_SIGNATURE');
  });

  it('corps signé puis modifié en transit : 401', async () => {
    const { app } = await makeApp();
    const raw = JSON.stringify(PAYLOAD);
    const res = await post(app, raw.replace('delivered', 'read'), signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(401);
  });

  it('signé mais pas une notification WhatsApp : 400 INVALID_WHATSAPP_WEBHOOK', async () => {
    const { app } = await makeApp();
    const raw = JSON.stringify({ object: 'page', entry: [] });
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_WHATSAPP_WEBHOOK');
  });

  it('signé mais trop gros : 413', async () => {
    const { app } = await makeApp();
    const raw = JSON.stringify({ ...PAYLOAD, padding: 'x'.repeat(300 * 1024) });
    const res = await post(app, raw, signMetaPayload(Buffer.from(raw), SECRET));
    await app.close();

    expect(res.status).toBe(413);
  });

  it('jamais limité en débit (rafales Meta)', async () => {
    const { app } = await makeApp();
    const raw = JSON.stringify(PAYLOAD);
    const signature = signMetaPayload(Buffer.from(raw), SECRET);
    const statuses: number[] = [];
    for (let i = 0; i < RATE_LIMITS.webhookVerify.default.limit + 5; i++) statuses.push((await post(app, raw, signature)).status);
    await app.close();

    expect(new Set(statuses)).toEqual(new Set([200]));
  });
});

describe('Non-régression — corps brut des webhooks de paiement', () => {
  it('NotchPay reçoit les octets exacts envoyés', async () => {
    const { app, payments } = await makeApp();
    const raw = '{ "event" : "payment.complete",  "data": {"id": "trx.1"} }';
    const res = await request(app.getHttpServer())
      .post('/api/subscription/webhooks/notchpay')
      .set('Content-Type', 'application/json')
      .set('x-notch-signature', 'abc')
      .send(raw);
    await app.close();

    expect(res.status).toBe(200);
    const rawBody = payments.handleWebhook.mock.calls[0][1] as Buffer;
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(rawBody.toString('utf8')).toBe(raw);
  });

  it('le corps brut n’est conservé que sur les routes de webhook', () => {
    expect(keepsRawBody('/api/subscription/webhooks/notchpay')).toBe(true);
    expect(keepsRawBody('/api/webhooks/whatsapp')).toBe(true);
    expect(keepsRawBody('/api/customers')).toBe(false);
    expect(keepsRawBody('/api/settings/workshop/logo')).toBe(false);
  });
});
