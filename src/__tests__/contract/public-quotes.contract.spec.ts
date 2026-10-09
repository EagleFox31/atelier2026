import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClientIpThrottlerGuard } from '../../shared/security/client-ip-throttler.guard';
import { PublicQuoteController } from '../../modules/billing/public-quote.controller';
import { PublicQuoteService } from '../../modules/billing/public-quote.service';
import { BillingService } from '../../modules/billing/billing.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';
import { generateOpaqueToken } from '../../shared/security/opaque-token';
import { createTestApp, makeIntegrationPrismaMock } from '../integration/helpers/app.helper';

/**
 * Contrat HTTP du lien public de devis : codes métier dans le corps (LESSON-2026-006),
 * aucune donnée interne exposée, limitation de débit réellement appliquée (LESSON-2026-009).
 */
function makePrisma() {
  const base = makeIntegrationPrismaMock();
  return {
    ...base,
    quoteAccessToken: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    quote: { ...(base as { quote?: object }).quote, updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

function access(overrides: Record<string, unknown> = {}, quote: Record<string, unknown> = {}) {
  return {
    id: 'tok-1',
    garageId: 'g-1',
    quoteId: 'q-1',
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    decidedAt: null,
    lastViewedAt: null,
    garage: { tenantId: 't-1', name: 'Garage Akwa' },
    quote: {
      id: 'q-1',
      garageId: 'g-1',
      reference: 'DEV-2026-0042',
      status: 'SENT',
      serviceOrderId: 'ot-1',
      createdBy: 'u-1',
      createdAt: new Date('2026-10-01T09:00:00Z'),
      sentAt: new Date('2026-10-01T10:00:00Z'),
      validUntil: null,
      approvedByClientAt: null,
      notes: null,
      subtotalXaf: 100000,
      taxRate: 0.1925,
      taxAmountXaf: 19250,
      stampDutyXaf: 0,
      totalXaf: 119250,
      customer: { customerType: 'INDIVIDUAL', companyName: null, firstName: 'Jean', lastName: 'Mbarga' },
      lines: [
        { lineType: 'LABOR', description: 'Vidange', quantity: 1, unitPriceXaf: 100000, discountPct: 0, lineTotalXaf: 100000 },
      ],
      serviceOrder: {
        id: 'ot-1',
        reference: 'OT-2026-0007',
        assignedChef: null,
        vehicle: { plateNumber: 'LT 123 AB', make: { name: 'Toyota' }, model: { name: 'Corolla' } },
      },
      ...quote,
    },
    ...overrides,
  };
}

async function makeApp(prisma: ReturnType<typeof makePrisma>, summary = { blocked: false, readOnly: false }) {
  const billing = { afterQuoteApproved: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    getUserIdsByRoles: jest.fn().mockResolvedValue(['u-2']),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const subscriptions = { getSummary: jest.fn().mockResolvedValue(summary) };
  const { app } = await createTestApp({
    moduleImports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
    controllers: [PublicQuoteController],
    extraProviders: [
      { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
      PublicQuoteService,
      { provide: BillingService, useValue: billing },
      { provide: NotificationsService, useValue: notifications },
      { provide: SubscriptionService, useValue: subscriptions },
    ],
    prismaOverride: prisma,
  });
  return { app, billing, notifications, subscriptions };
}

describe('Lien public de devis — contrat HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makePrisma>;
  let billing: { afterQuoteApproved: jest.Mock };
  let notifications: { createInApp: jest.Mock };
  const token = generateOpaqueToken();
  const url = `/api/public/quotes/${token}`;

  beforeAll(async () => {
    prisma = makePrisma();
    ({ app, billing, notifications } = await makeApp(prisma));
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.quoteAccessToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.quote.updateMany.mockResolvedValue({ count: 1 });
  });

  it('GET 200 sans authentification : devis lisible, sans identifiant interne', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());

    const res = await request(app.getHttpServer()).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      garageName: 'Garage Akwa',
      customerName: 'Jean Mbarga',
      reference: 'DEV-2026-0042',
      totalXaf: 119250,
      vehicle: { plate: 'LT 123 AB', label: 'Toyota Corolla' },
      canDecide: true,
    });
    const body = JSON.stringify(res.body);
    for (const internal of ['q-1', 'g-1', 't-1', 'ot-1', 'u-1', 'tok-1']) expect(body).not.toContain(`"${internal}"`);
    expect(prisma.quoteAccessToken.update).toHaveBeenCalledWith({
      where: { id: 'tok-1' },
      data: { lastViewedAt: expect.any(Date) },
    });
  });

  it.each([
    ['inconnu', null, 404, 'QUOTE_LINK_INVALID'],
    ['révoqué', { revokedAt: new Date() }, 410, 'QUOTE_LINK_EXPIRED'],
    ['expiré', { expiresAt: new Date(Date.now() - 1000) }, 410, 'QUOTE_LINK_EXPIRED'],
  ])('GET lien %s → %i %s', async (_label, override, status, errorCode) => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(override === null ? null : access(override));

    const res = await request(app.getHttpServer()).get(url);

    expect(res.status).toBe(status);
    expect(res.body.errorCode).toBe(errorCode);
  });

  it('GET devis déjà validé : reste consultable, sans décision possible', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(
      access({ decidedAt: new Date(), expiresAt: new Date(Date.now() - 1000) }, { status: 'APPROVED' }),
    );

    const res = await request(app.getHttpServer()).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', canDecide: false });
  });

  it('GET validité du devis dépassée → 410', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access({}, { validUntil: new Date('2026-01-01') }));

    const res = await request(app.getHttpServer()).get(url);

    expect(res.status).toBe(410);
    expect(res.body.errorCode).toBe('QUOTE_LINK_EXPIRED');
  });

  it('GET jeton mal formé → 404 sans requête', async () => {
    const res = await request(app.getHttpServer()).get('/api/public/quotes/abc');
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('QUOTE_LINK_INVALID');
    expect(prisma.quoteAccessToken.findUnique).not.toHaveBeenCalled();
  });

  it('POST approve 200 : prise du jeton puis SENT → APPROVED (DIGITAL), effets de l’approbation', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());

    const res = await request(app.getHttpServer()).post(`${url}/approve`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'APPROVED' });
    expect(prisma.quoteAccessToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'tok-1', decidedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { decidedAt: expect.any(Date) },
    });
    expect(prisma.quote.updateMany).toHaveBeenCalledWith({
      where: { id: 'q-1', garageId: 'g-1', status: 'SENT' },
      data: { status: 'APPROVED', approvedByClientAt: expect.any(Date), clientApprovalMethod: 'DIGITAL' },
    });
    expect(billing.afterQuoteApproved).toHaveBeenCalledWith(expect.objectContaining({ id: 'q-1' }), 'u-1', 'g-1');
  });

  it('POST approve concurrent (jeton déjà pris) → 409, devis intact', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());
    prisma.quoteAccessToken.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app.getHttpServer()).post(`${url}/approve`);

    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('QUOTE_ALREADY_DECIDED');
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
    expect(billing.afterQuoteApproved).not.toHaveBeenCalled();
  });

  it('POST approve sur un devis validé au comptoir entre-temps → 409', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access({}, { status: 'APPROVED' }));

    const res = await request(app.getHttpServer()).post(`${url}/approve`);

    expect(res.status).toBe(409);
    expect(prisma.quoteAccessToken.updateMany).not.toHaveBeenCalled();
  });

  it('POST reject 200 : SENT → REJECTED et motif transmis au garage', async () => {
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());

    const res = await request(app.getHttpServer())
      .post(`${url}/reject`)
      .send({ reason: 'Trop cher,\n je repasse la semaine prochaine' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'REJECTED' });
    expect(prisma.quote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } }),
    );
    expect(notifications.createInApp).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Motif : Trop cher, je repasse la semaine prochaine') }),
    );
    expect(billing.afterQuoteApproved).not.toHaveBeenCalled();
  });

  it('POST reject : champ inconnu refusé (400)', async () => {
    const res = await request(app.getHttpServer()).post(`${url}/reject`).send({ status: 'APPROVED' });
    expect(res.status).toBe(400);
  });
});

describe('Lien public de devis — abonnement du garage', () => {
  const token = generateOpaqueToken();

  it('garage bloqué (expiré, suspendu) → 404, rien n’est révélé', async () => {
    const prisma = makePrisma();
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());
    const { app } = await makeApp(prisma, { blocked: true, readOnly: true });

    const res = await request(app.getHttpServer()).get(`/api/public/quotes/${token}`);
    await app.close();

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('QUOTE_LINK_INVALID');
  });

  it('garage en lecture seule : consultation possible, décision refusée (410)', async () => {
    const prisma = makePrisma();
    prisma.quoteAccessToken.findUnique.mockResolvedValue(access());
    const { app } = await makeApp(prisma, { blocked: false, readOnly: true });

    const view = await request(app.getHttpServer()).get(`/api/public/quotes/${token}`);
    const decision = await request(app.getHttpServer()).post(`/api/public/quotes/${token}/approve`);
    await app.close();

    expect(view.status).toBe(200);
    expect(view.body.canDecide).toBe(false);
    expect(decision.status).toBe(410);
    expect(prisma.quote.updateMany).not.toHaveBeenCalled();
  });
});

describe('Lien public de devis — limitation de débit', () => {
  it('POST approve : la 6e tentative par minute et par IP reçoit 429', async () => {
    const prisma = makePrisma();
    prisma.quoteAccessToken.findUnique.mockResolvedValue(null);
    const { app } = await makeApp(prisma);
    const token = generateOpaqueToken();

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/public/quotes/${token}/approve`)
        .set('X-Forwarded-For', '41.202.1.2');
      statuses.push(res.status);
    }
    const other = await request(app.getHttpServer())
      .post(`/api/public/quotes/${token}/approve`)
      .set('X-Forwarded-For', '41.202.9.9');
    await app.close();

    expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404]);
    expect(statuses[5]).toBe(429);
    expect(other.status).toBe(404);
  });
});
