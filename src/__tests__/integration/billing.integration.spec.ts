import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingController } from '../../modules/billing/billing.controller';
import { BillingService } from '../../modules/billing/billing.service';
import { WorkshopService } from '../../modules/workshop/workshop.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { PartsFlowService } from '../../modules/stock/parts-flow.service';
import {
  createTestApp,
  makeDbUser,
  makeIntegrationPrismaMock,
  signTestToken,
} from './helpers/app.helper';

const CAISSIER_PERMS = ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'];
const CAISSIER_USER = makeDbUser('caisse-1', ['CAISSIER'], CAISSIER_PERMS);
const CAISSIER_TOKEN = signTestToken('caisse-1', 1);

const CHEF_PERMS = ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'STK_VIEW', 'STK_CREATE', 'FAC_CREATE', 'FAC_VIEW'];
const CHEF_USER = makeDbUser('chef-1', ['CHEF_ATELIER'], CHEF_PERMS);
const CHEF_TOKEN = signTestToken('chef-1', 1);

const OT_ID = '11111111-1111-4111-8111-111111111111';
const CUST_ID = '22222222-2222-4222-8222-222222222222';
const QUOTE_ID = '55555555-5555-4555-8555-555555555555';
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
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountXaf: 0 } }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    _txMock: txMock,
  };
}

describe('Billing — intégration HTTP', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof makeBillingPrismaMock>;
  let workshopMock: { updateStatusBySystem: jest.Mock; closeServiceOrderAfterFullPayment: jest.Mock };

  beforeAll(async () => {
    prisma = makeBillingPrismaMock();
    workshopMock = {
      updateStatusBySystem: jest.fn(),
      closeServiceOrderAfterFullPayment: jest.fn().mockResolvedValue({ closed: false }),
    };

    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });

    ({ app } = await createTestApp({
      controllers: [BillingController],
      extraProviders: [
        BillingService,
        { provide: WorkshopService, useValue: workshopMock },
        { provide: NotificationsService, useValue: { getUserIdsByRoles: jest.fn().mockResolvedValue([]), createInApp: jest.fn().mockResolvedValue([]) } },
        { provide: PartsFlowService, useValue: { onQuoteApproved: jest.fn(), consumeReservedParts: jest.fn(), releaseReservationsForOrder: jest.fn(), reconcilePartsAtQc: jest.fn() } },
      ],
      prismaOverride: prisma,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'caisse-1') return Promise.resolve(CAISSIER_USER);
      if (where.id === 'chef-1') return Promise.resolve(CHEF_USER);
      return Promise.resolve(null);
    });
  });

  describe('POST /api/billing/quote/compute', () => {
    it('200 — calcule TVA + timbre pour 20000 XAF', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quote/compute')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ subtotal: 20000 });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(24850);
      expect(res.body.stampDuty).toBe(1000);
    });

    it('401 — sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quote/compute')
        .send({ subtotal: 20000 });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/billing/quotes', () => {
    it('201 — crée un devis DRAFT avec montants fiscaux', async () => {
      prisma.quote.create.mockResolvedValue({
        id: QUOTE_ID,
        status: 'DRAFT',
        totalXaf: 24850,
        lines: [],
      });

      const res = await request(app.getHttpServer())
        .post('/api/billing/quotes')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          serviceOrderId: OT_ID,
          customerId: CUST_ID,
          subtotal: 20000,
          lines: [{
            lineType: 'LABOR',
            description: 'Vidange',
            laborCatalogId: LABOR_ID,
            quantity: 1,
            unitPriceXaf: 20000,
          }],
        });

      expect(res.status).toBe(201);
      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            totalXaf: 24850,
            createdBy: 'chef-1',
          }),
        }),
      );
    });

    it('400 — body invalide (subtotal manquant)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/billing/quotes')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ serviceOrderId: OT_ID, customerId: CUST_ID, lines: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/billing/quotes/:id/approve', () => {
    it('200 — passe le devis en APPROVED', async () => {
      prisma.quote.update.mockResolvedValue({ id: QUOTE_ID, status: 'APPROVED' });

      const res = await request(app.getHttpServer())
        .post(`/api/billing/quotes/${QUOTE_ID}/approve`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({ clientApprovalMethod: 'VERBAL_NOTED' });

      expect(res.status).toBe(200);
      expect(prisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });
  });

  describe('POST /api/billing/payment', () => {
    it('403 — TECHNICIEN sans FAC_PAY', async () => {
      const techUser = makeDbUser('tech-1', ['TECHNICIEN'], ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW']);
      prisma.user.findUnique.mockResolvedValue(techUser);
      const techToken = signTestToken('tech-1', 1);

      const res = await request(app.getHttpServer())
        .post('/api/billing/payment')
        .set('Authorization', `Bearer ${techToken}`)
        .send({
          invoiceId: '66666666-6666-4666-8666-666666666666',
          amount: 10000,
          method: 'CASH',
        });

      expect(res.status).toBe(403);
    });
  });

  // ─── Phase 3 : erreurs Prisma → codes HTTP ───────────────────────────────────

  describe('AllExceptionsFilter — erreurs Prisma remontent en HTTP', () => {
    const makePrismaError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('test error', {
        code,
        clientVersion: '0',
        meta: {},
      });

    it('P2003 — createQuote avec serviceOrderId inexistant → 400 DB_FOREIGN_KEY', async () => {
      prisma.quote.create.mockRejectedValue(makePrismaError('P2003'));

      const res = await request(app.getHttpServer())
        .post('/api/billing/quotes')
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({
          serviceOrderId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          customerId: CUST_ID,
          subtotal: 10000,
          lines: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('DB_FOREIGN_KEY');
    });

    it('P2025 — approveQuote sur devis inexistant → 404 DB_NOT_FOUND', async () => {
      prisma.quote.update.mockRejectedValue(makePrismaError('P2025'));

      const res = await request(app.getHttpServer())
        .post(`/api/billing/quotes/${QUOTE_ID}/approve`)
        .set('Authorization', `Bearer ${CHEF_TOKEN}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DB_NOT_FOUND');
    });

    it('P2002 — paiement doublon (idempotence) → 400 + message explicite', async () => {
      const p2002 = makePrismaError('P2002');
      prisma.payment.create.mockRejectedValue(p2002);

      const res = await request(app.getHttpServer())
        .post('/api/billing/payment')
        .set('Authorization', `Bearer ${CAISSIER_TOKEN}`)
        .send({
          invoiceId: '66666666-6666-4666-8666-666666666666',
          amount: 10000,
          method: 'CASH',
          idempotencyKey: 'idem-key-123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Ce paiement a déjà été enregistré');
    });
  });
});
