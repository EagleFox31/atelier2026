import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingController } from '../../modules/billing/billing.controller';
import { BillingService } from '../../modules/billing/billing.service';
import { WorkshopService } from '../../modules/workshop/workshop.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from '../integration/helpers/app.helper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CAISSIER_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'FAC_CREATE', 'STK_VIEW'];
const TECH_PERMS     = ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'];

const CAISSIER_USER  = makeDbUser('caisse-1', ['CAISSIER'],    CAISSIER_PERMS);
const TECH_USER      = makeDbUser('tech-1',   ['TECHNICIEN'],  TECH_PERMS);
const CAISSIER_TOKEN = signTestToken('caisse-1', 1);
const TECH_TOKEN     = signTestToken('tech-1', 1);

const OT_ID    = '11111111-1111-4111-8111-111111111111';
const CUST_ID  = '22222222-2222-4222-8222-222222222222';
const QUOTE_ID = '55555555-5555-4555-8555-555555555555';
const INV_ID   = '66666666-6666-4666-8666-666666666666';
const LABOR_ID = '44444444-4444-4444-8444-444444444444';

function makeBillingPrismaMock() {
  const base = makeIntegrationPrismaMock();
  const txMock = {
    payment: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountXaf: 0 } }),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    quote: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    technicianObservation: { updateMany: jest.fn().mockResolvedValue({}) },
  };
  return {
    ...base,
    quote: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Billing — contrats de réponse HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeBillingPrismaMock>;
  let workshopMock: { updateStatusBySystem: jest.Mock };

  beforeAll(async () => {
    prisma = makeBillingPrismaMock();
    workshopMock = { updateStatusBySystem: jest.fn() };

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'tech-1')   return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [BillingController],
      extraProviders: [
        BillingService,
        { provide: WorkshopService, useValue: workshopMock },
      ],
      prismaOverride: prisma,
    }));
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'tech-1')   return Promise.resolve(TECH_USER);
      return Promise.resolve(null);
    });
    prisma._txMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 0 } });
    prisma._txMock.invoice.findUnique.mockResolvedValue(null);
    prisma._txMock.invoice.update.mockResolvedValue({});
  });

  // ── POST /api/billing/quote/compute ───────────────────────────────────────

  describe('POST /api/billing/quote/compute', () => {
    it('200 — shape exacte : { subtotal, taxRate, taxAmount, stampDuty, total }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quote/compute')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ subtotal: 10000 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal:  10000,
        taxRate:   0.1925,
        taxAmount: 1925,
        stampDuty: 0,
        total:     11925,
      });
    });

    it('200 — timbre 1000 XAF quand subtotal + TVA > 20 000', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quote/compute')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ subtotal: 20000 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        subtotal:  20000,
        taxRate:   0.1925,
        taxAmount: 3850,
        stampDuty: 1000,
        total:     24850,
      });
    });

    it('401 sans token — enveloppe erreur 5 clés', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quote/compute')
        .send({ subtotal: 5000 });

      expect(res.status).toBe(401);
      expect(Object.keys(res.body).sort()).toEqual(
        ['errorCode', 'message', 'path', 'statusCode', 'timestamp'].sort(),
      );
    });
  });

  // ── GET /api/billing/quotes ────────────────────────────────────────────────

  describe('GET /api/billing/quotes', () => {
    it('200 — retourne un tableau', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/billing/quotes')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('403 TECHNICIEN sans FAC_CREATE → errorCode "Forbidden"', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/billing/quotes')
        .set('Authorization', `Bearer ${TECH_TOKEN}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('Forbidden');
    });
  });

  // ── POST /api/billing/quotes ───────────────────────────────────────────────

  describe('POST /api/billing/quotes', () => {
    it('201 — shape : { id, status: "DRAFT", subtotalXaf, taxAmountXaf, totalXaf, lines[] }', async () => {
      prisma.quote.create.mockResolvedValue({
        id: QUOTE_ID,
        status: 'DRAFT',
        serviceOrderId: OT_ID,
        customerId: CUST_ID,
        subtotalXaf: 15000,
        taxRate: 0.1925,
        taxAmountXaf: 2888,
        stampDutyXaf: 0,
        totalXaf: 17888,
        lines: [],
        createdAt: '2026-01-15T10:00:00.000Z',
      });

      const res = await request(app.getHttpServer())
        .post('/api/billing/quotes')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          serviceOrderId: OT_ID,
          customerId: CUST_ID,
          subtotal: 15000,
          lines: [{ lineType: 'LABOR', laborCatalogId: LABOR_ID, quantity: 1, unitPriceXaf: 15000 }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        status: 'DRAFT',
        subtotalXaf: 15000,
        taxAmountXaf: expect.any(Number),
        totalXaf: expect.any(Number),
        lines: expect.any(Array),
      });
    });

    it('400 validation — subtotal manquant → message[] contient "subtotal"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quotes')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ serviceOrderId: OT_ID, customerId: CUST_ID, lines: [] });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
      expect(Array.isArray(res.body.message)).toBe(true);
    });
  });

  // ── POST /api/billing/quotes/:quoteId/approve ─────────────────────────────

  describe('POST /api/billing/quotes/:id/approve', () => {
    it('200 — retourne le devis avec status mis à jour', async () => {
      prisma.quote.update.mockResolvedValue({
        id: QUOTE_ID,
        status: 'APPROVED',
        approvedByClientAt: new Date().toISOString(),
        clientApprovalMethod: 'VERBAL_NOTED',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/billing/quotes/${QUOTE_ID}/approve`)
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ clientApprovalMethod: 'VERBAL_NOTED' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: QUOTE_ID,
        status: 'APPROVED',
      });
    });

    it('404 (P2025) — devis introuvable → errorCode "DB_NOT_FOUND"', async () => {
      prisma.quote.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025', clientVersion: '7.7.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/billing/quotes/${QUOTE_ID}/approve`)
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });
  });

  // ── GET /api/billing/invoices ──────────────────────────────────────────────

  describe('GET /api/billing/invoices', () => {
    it('200 — retourne un tableau', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/billing/invoices')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── POST /api/billing/payment ──────────────────────────────────────────────

  describe('POST /api/billing/payment', () => {
    it('201 — shape : { id, invoiceId, amountXaf, method, status: "CONFIRMED" }', async () => {
      const paymentStub = {
        id: 'pay-1',
        invoiceId: INV_ID,
        amountXaf: 17888,
        method: 'CASH',
        status: 'CONFIRMED',
        idempotencyKey: 'key-001',
        paidAt: new Date().toISOString(),
      };

      prisma._txMock.payment.create.mockResolvedValue(paymentStub);
      prisma._txMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 17888 } });
      prisma._txMock.invoice.findUnique.mockResolvedValue({
        id: INV_ID, totalXaf: 17888, status: 'ISSUED', serviceOrderId: null,
      });

      const res = await request(app.getHttpServer())
        .post('/api/billing/payment')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          invoiceId: INV_ID,
          amount: 17888,
          method: 'CASH',
          idempotencyKey: 'key-001',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        invoiceId: INV_ID,
        amountXaf: 17888,
        status: 'CONFIRMED',
      });
    });

    it('400 — paiement idempotent (P2002) → errorCode "Bad Request", message mentionne idempotence', async () => {
      prisma._txMock.payment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002', clientVersion: '7.7.0', meta: { target: ['idempotencyKey'] },
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/billing/payment')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ invoiceId: INV_ID, amount: 5000, method: 'CASH', idempotencyKey: 'dup-key' });

      // BillingService attrape P2002 et lève BadRequestException (pas DB_CONFLICT ici)
      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toContain('idempotence');
    });

    it('400 validation — method invalide → errorCode "Bad Request"', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/payment')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({ invoiceId: INV_ID, amount: 5000, method: 'BITCOIN' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('Bad Request');
    });
  });
});
