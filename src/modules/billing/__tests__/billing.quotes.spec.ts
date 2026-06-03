import { BadRequestException } from '@nestjs/common';
import { BillingService } from '../billing.service';

const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeDeps() {
  const prismaMock = {
    quote: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'q-1', garageId: '52221808-e45d-41a9-9a37-933695560f6c', status: 'SENT' }),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prismaMock)),
  };
  const workshopMock = { updateStatusBySystem: jest.fn() };
  const notifMock = {
    getUserIdsByRoles: jest.fn().mockResolvedValue([]),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const partsFlowMock = {
    onQuoteApproved: jest.fn().mockResolvedValue({ reserved: 0, aspCreated: 0, missingCount: 0 }),
  };
  const service = new BillingService(
    prismaMock as any,
    workshopMock as any,
    notifMock as any,
    partsFlowMock as any,
  );
  return { service, prismaMock, partsFlowMock, notifMock };
}

// ─── listQuotes() ─────────────────────────────────────────────────────────────

describe('BillingService.listQuotes()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('liste tous les devis sans filtre (where vide)', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listQuotes(undefined, TEST_GARAGE_ID);
    expect(prismaMock.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({}) }),
    );
  });

  it('filtre par serviceOrderId quand fourni', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listQuotes('ot-1', TEST_GARAGE_ID);
    expect(prismaMock.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ serviceOrderId: 'ot-1' }) }),
    );
  });

  it('tri par createdAt desc', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listQuotes(undefined, TEST_GARAGE_ID);
    expect(prismaMock.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('include contient customer, lines, serviceOrder.reference et creator.firstName/lastName', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listQuotes(undefined, TEST_GARAGE_ID);
    const call = prismaMock.quote.findMany.mock.calls[0][0];
    expect(call.include.customer).toBe(true);
    expect(call.include.lines).toBe(true);
    expect(call.include.serviceOrder.select.reference).toBe(true);
    expect(call.include.creator.select.firstName).toBe(true);
    expect(call.include.creator.select.lastName).toBe(true);
  });
});

// ─── createQuote() ────────────────────────────────────────────────────────────

describe('BillingService.createQuote()', () => {
  beforeEach(() => jest.clearAllMocks());

  const BASE = {
    serviceOrderId: 'ot-1',
    customerId: 'cust-1',
    subtotal: 20000,
    lines: [] as any[],
  };

  it('crée le devis avec statut DRAFT et createdBy', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new', status: 'DRAFT' });

    await service.createQuote(BASE, 'user-chef', TEST_GARAGE_ID);

    expect(prismaMock.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT', createdBy: 'user-chef' }),
      }),
    );
  });

  it('applique les montants fiscaux sur le subtotal fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new' });

    // subtotal=20000 → tax=3850, stamp=1000 (23850 > 20000), total=24850
    await service.createQuote({ ...BASE, subtotal: 20000, lines: [] }, 'user-1', TEST_GARAGE_ID);

    const data = prismaMock.quote.create.mock.calls[0][0].data;
    expect(data.subtotalXaf).toBe(20000);
    expect(data.taxAmountXaf).toBe(3850);
    expect(data.stampDutyXaf).toBe(1000);
    expect(data.totalXaf).toBe(24850);
  });

  it('ne passe pas lineTotalXaf à Prisma — colonne GENERATED en DB', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new' });

    await service.createQuote(
      {
        ...BASE,
        lines: [
          { lineType: 'LABOR', description: 'Vidange', quantity: 1, unitPriceXaf: 10000, discountPct: 0 },
          { lineType: 'PART',  description: 'Filtre',  quantity: 2, unitPriceXaf: 5000,  discountPct: 10 },
        ],
      }, 'user-1', TEST_GARAGE_ID);

    const lines = prismaMock.quote.create.mock.calls[0][0].data.lines.create;
    expect(lines[0]).not.toHaveProperty('lineTotalXaf');
    expect(lines[1]).not.toHaveProperty('lineTotalXaf');
  });

  it('assigne sortOrder séquentiel à chaque ligne', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new' });

    await service.createQuote({
        ...BASE,
        lines: [
          { lineType: 'LABOR', description: 'A', quantity: 1, unitPriceXaf: 5000 },
          { lineType: 'LABOR', description: 'B', quantity: 1, unitPriceXaf: 3000 },
        ],
      }, 'user-1', TEST_GARAGE_ID);

    const lines = prismaMock.quote.create.mock.calls[0][0].data.lines.create;
    expect(lines[0].sortOrder).toBe(0);
    expect(lines[1].sortOrder).toBe(1);
  });

  it('persiste notes et validUntil quand fournis', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new' });

    await service.createQuote({
        ...BASE,
        notes: 'Forfait diagnostic démarrage',
        validUntil: '2026-06-24T00:00:00.000Z',
        lines: [],
      }, 'user-1', TEST_GARAGE_ID);

    const data = prismaMock.quote.create.mock.calls[0][0].data;
    expect(data.notes).toBe('Forfait diagnostic démarrage');
    expect(data.validUntil).toEqual(new Date('2026-06-24T00:00:00.000Z'));
  });

  it('discountPct par défaut est 0 si non fourni', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.create.mockResolvedValue({ id: 'q-new' });

    await service.createQuote({
        ...BASE,
        lines: [{ lineType: 'LABOR', description: 'Vidange', quantity: 1, unitPriceXaf: 10000 }],
      }, 'user-1', TEST_GARAGE_ID);

    const lines = prismaMock.quote.create.mock.calls[0][0].data.lines.create;
    expect(lines[0].discountPct).toBe(0);
  });
});

// ─── approveQuote() ───────────────────────────────────────────────────────────

describe('BillingService.approveQuote()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passe le devis en APPROVED avec approvedByClientAt', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.update.mockResolvedValue({ id: 'q-1', status: 'APPROVED' });

    await service.approveQuote('q-1', {}, 'user-1', TEST_GARAGE_ID);

    expect(prismaMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'q-1' }),
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedByClientAt: expect.any(Date),
        }),
      }),
    );
  });

  it('clientApprovalMethod par défaut est VERBAL_NOTED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.update.mockResolvedValue({ id: 'q-1' });

    await service.approveQuote('q-1', {}, 'user-1', TEST_GARAGE_ID);

    const data = prismaMock.quote.update.mock.calls[0][0].data;
    expect(data.clientApprovalMethod).toBe('VERBAL_NOTED');
  });

  it('clientApprovalMethod est surchargeable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.update.mockResolvedValue({ id: 'q-1' });

    await service.approveQuote('q-1', { clientApprovalMethod: 'DIGITAL' }, 'user-1', TEST_GARAGE_ID);

    const data = prismaMock.quote.update.mock.calls[0][0].data;
    expect(data.clientApprovalMethod).toBe('DIGITAL');
  });

  it('rejette une méthode hors contrainte SQL', async () => {
    const { service } = makeDeps();

    await expect(
      service.approveQuote('q-1', { clientApprovalMethod: 'SIGNATURE' }, 'user-1', TEST_GARAGE_ID),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── listInvoices() ───────────────────────────────────────────────────────────

describe('BillingService.listInvoices()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('liste toutes les factures sans filtre', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listInvoices(undefined, undefined, TEST_GARAGE_ID);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({}) }),
    );
  });

  it('filtre par customerId', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listInvoices('cust-1', undefined, TEST_GARAGE_ID);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ customerId: 'cust-1' }) }),
    );
  });

  it('filtre par status', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listInvoices(undefined, 'PAID', TEST_GARAGE_ID);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PAID' }) }),
    );
  });

  it('filtre par customerId et status combinés', async () => {
    const { service, prismaMock } = makeDeps();
    await service.listInvoices('cust-1', 'PARTIAL', TEST_GARAGE_ID);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ customerId: 'cust-1', status: 'PARTIAL' }) }),
    );
  });
});

// ─── getQuote() ───────────────────────────────────────────────────────────────

describe('BillingService.getQuote()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le devis avec include customer, lines (part+laborCatalog) et serviceOrder.reference', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({ id: 'q-1' });

    await service.getQuote('q-1', TEST_GARAGE_ID);

    const call = prismaMock.quote.findUnique.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'q-1' });
    expect(call.include.customer).toBe(true);
    expect(call.include.lines.include.part).toBe(true);
    expect(call.include.lines.include.laborCatalog).toBe(true);
    expect(call.include.serviceOrder.select.reference).toBe(true);
    expect(call.include.serviceOrder.select.vehicle.select.plateNumber).toBe(true);
    expect(call.include.creator.select.firstName).toBe(true);
    expect(call.include.creator.select.lastName).toBe(true);
  });
});

// ─── getInvoice() ─────────────────────────────────────────────────────────────

describe('BillingService.getInvoice()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la facture avec include customer, lines, payments et OT + véhicule', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.invoice.findUnique.mockResolvedValue({ id: 'inv-1' });

    await service.getInvoice('inv-1', TEST_GARAGE_ID);

    const call = prismaMock.invoice.findUnique.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'inv-1' });
    expect(call.include.customer).toBe(true);
    expect(call.include.lines).toBe(true);
    expect(call.include.payments).toBe(true);
    expect(call.include.serviceOrder.select.reference).toBe(true);
    expect(call.include.serviceOrder.select.vehicle.select.plateNumber).toBe(true);
    expect(call.include.serviceOrder.select.vehicle.select.make).toEqual({ select: { name: true } });
  });
});
