import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { BillingService } from '../billing.service';

function makePrismaMock() {
  return {
    payment: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    technicianObservation: {
      updateMany: jest.fn(),
    },
  };
}

function makeDeps() {
  const prismaMock = makePrismaMock();
  const workshopMock = {
    updateStatus: jest.fn(),
    updateStatusBySystem: jest.fn(),
    closeServiceOrderAfterFullPayment: jest.fn(),
  };
  const partsFlowMock = { onQuoteApproved: jest.fn() };
  const service = new BillingService(prismaMock as any, workshopMock as any, {} as any, partsFlowMock as any);
  return { service, prismaMock, workshopMock };
}

// ─── recordPayment() ──────────────────────────────────────────────────────────

describe('BillingService.recordPayment()', () => {
  const basePayload = {
    invoiceId: 'inv-1',
    amount: 10000,
    method: PaymentMethod.CASH,
    userId: 'user-1',
    idempotencyKey: 'key-abc123',
  };

  beforeEach(() => jest.clearAllMocks());

  it('lève BadRequestException si le paiement est déjà enregistré (idempotence P2002)', async () => {
    const { service, prismaMock } = makeDeps();
    const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    prismaMock.payment.create.mockRejectedValue(p2002);

    await expect(service.recordPayment(basePayload)).rejects.toThrow(
      new BadRequestException("Ce paiement a déjà été enregistré (clé d'idempotence active)"),
    );
  });

  it('lève NotFoundException si la facture est introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 10000 } });
    prismaMock.invoice.findUnique.mockResolvedValue(null);

    await expect(service.recordPayment(basePayload)).rejects.toThrow(
      new NotFoundException('Facture introuvable'),
    );
  });

  it('statut devient PARTIAL si paiement partiel (solde > 0)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 5000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: 'ot-1',
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment({ ...basePayload, amount: 5000 });

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIAL', amountPaidXaf: 5000 }),
      }),
    );
    expect(prismaMock.invoice.update.mock.calls[0][0].data).not.toHaveProperty('balanceXaf');
  });

  it('statut devient PAID quand la facture est soldée (solde = 0)', async () => {
    const { service, prismaMock, workshopMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 24850 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'PARTIAL',
      serviceOrderId: 'ot-1',
    });
    prismaMock.invoice.update.mockResolvedValue({});
    workshopMock.closeServiceOrderAfterFullPayment.mockResolvedValue({
      closed: true,
      finalStatus: 'CLOSED',
    });

    await service.recordPayment({ ...basePayload, amount: 24850 });

    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', amountPaidXaf: 24850 }),
      }),
    );
    expect(prismaMock.invoice.update.mock.calls[0][0].data).not.toHaveProperty('balanceXaf');
    expect(workshopMock.closeServiceOrderAfterFullPayment).toHaveBeenCalledWith(
      'ot-1',
      'user-1',
      { reason: expect.stringContaining('Soldé automatiquement') },
    );
    expect(workshopMock.updateStatus).not.toHaveBeenCalled();
  });

  it('ne déclenche pas auto-CLOSED si paiement partiel', async () => {
    const { service, prismaMock, workshopMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 5000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: 'ot-1',
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment({ ...basePayload, amount: 5000 });

    expect(workshopMock.closeServiceOrderAfterFullPayment).not.toHaveBeenCalled();
  });

  it('ne déclenche pas auto-CLOSED si facture sans OT lié', async () => {
    const { service, prismaMock, workshopMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 24850 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment({ ...basePayload, amount: 24850 });

    expect(workshopMock.closeServiceOrderAfterFullPayment).not.toHaveBeenCalled();
  });

  it('conserve le paiement si auto-CLOSED échoue (OT état incompatible)', async () => {
    const { service, prismaMock, workshopMock } = makeDeps();
    const createdPayment = { id: 'pay-1', amountXaf: 24850 };
    prismaMock.payment.create.mockResolvedValue(createdPayment);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 24850 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: 'ot-1',
    });
    prismaMock.invoice.update.mockResolvedValue({});
    workshopMock.closeServiceOrderAfterFullPayment.mockRejectedValue(
      new Error('Clôture auto impossible'),
    );

    const result = await service.recordPayment({ ...basePayload, amount: 24850 });

    expect(result).toEqual(createdPayment);
    expect(workshopMock.closeServiceOrderAfterFullPayment).toHaveBeenCalled();
  });

  it('le solde ne descend jamais en négatif (surpaiement → 0)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 99999 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment(basePayload);

    const updateCall = prismaMock.invoice.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('PAID');
    expect(updateCall.data).not.toHaveProperty('balanceXaf');
  });

  it('retourne le paiement créé', async () => {
    const { service, prismaMock } = makeDeps();
    const createdPayment = { id: 'pay-1', amountXaf: 10000 };
    prismaMock.payment.create.mockResolvedValue(createdPayment);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 10000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      totalXaf: 24850,
      status: 'ISSUED',
      serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    const result = await service.recordPayment(basePayload);
    expect(result).toEqual(createdPayment);
  });

  it('payment.create reçoit status CONFIRMED, invoiceId, amount et idempotencyKey', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 10000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', totalXaf: 24850, status: 'ISSUED', serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment(basePayload);

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          amountXaf: 10000,
          method: PaymentMethod.CASH,
          status: 'CONFIRMED',
          idempotencyKey: 'key-abc123',
          recordedBy: 'user-1',
        }),
      }),
    );
  });

  it('aggregate filtre sur status CONFIRMED de la facture', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 10000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', totalXaf: 24850, status: 'ISSUED', serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment(basePayload);

    expect(prismaMock.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amountXaf: true },
        where: { invoiceId: 'inv-1', status: 'CONFIRMED' },
      }),
    );
  });

  it('invoice.findUnique sélectionne id, totalXaf, status et serviceOrderId', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 10000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', totalXaf: 24850, status: 'ISSUED', serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment(basePayload);

    expect(prismaMock.invoice.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        select: expect.objectContaining({
          id: true,
          totalXaf: true,
          status: true,
          serviceOrderId: true,
        }),
      }),
    );
  });

  it('paidAt est défini si solde ≤ 0 (facture soldée)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 24850 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', totalXaf: 24850, status: 'ISSUED', serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment({ ...basePayload, amount: 24850 });

    const updateData = prismaMock.invoice.update.mock.calls[0][0].data;
    expect(updateData.paidAt).toBeInstanceOf(Date);
  });

  it('paidAt est null si solde > 0 (paiement partiel)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1' });
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountXaf: 5000 } });
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', totalXaf: 24850, status: 'ISSUED', serviceOrderId: null,
    });
    prismaMock.invoice.update.mockResolvedValue({});

    await service.recordPayment({ ...basePayload, amount: 5000 });

    const updateData = prismaMock.invoice.update.mock.calls[0][0].data;
    expect(updateData.paidAt).toBeNull();
  });
});

// ─── createInvoiceFromQuote() ─────────────────────────────────────────────────

describe('BillingService.createInvoiceFromQuote()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lève NotFoundException si le devis est introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue(null);

    await expect(service.createInvoiceFromQuote('quote-inexistant', 'user-1')).rejects.toThrow(
      new NotFoundException('Devis introuvable'),
    );
  });

  it('lève BadRequestException si le devis n\'est pas APPROVED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'PENDING',
      lines: [],
      subtotalXaf: 20000,
      serviceOrder: null,
    });

    await expect(service.createInvoiceFromQuote('q-1', 'user-1')).rejects.toThrow(
      new BadRequestException('Le devis doit être APPROUVÉ'),
    );
  });

  it('crée la facture avec statut ISSUED si devis APPROVED', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'APPROVED',
      customerId: 'cust-1',
      serviceOrderId: 'ot-1',
      subtotalXaf: 20000,
      taxRate: 0.1925,
      taxAmountXaf: 3850,
      stampDutyXaf: 1000,
      totalXaf: 24850,
      lines: [],
      serviceOrder: { observations: [] },
    });
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv-new', status: 'ISSUED' });
    prismaMock.quote.update.mockResolvedValue({});

    const result = await service.createInvoiceFromQuote('q-1', 'user-1');

    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ISSUED', createdBy: 'user-1' }),
      }),
    );
    expect(prismaMock.invoice.create.mock.calls[0][0].data).not.toHaveProperty('balanceXaf');
    expect(result.status).toBe('ISSUED');
    // observations vides → updateMany ne doit PAS être appelé
    expect(prismaMock.technicianObservation.updateMany).not.toHaveBeenCalled();
  });

  it('dueDate est à 7 jours dans le futur', async () => {
    const { service, prismaMock } = makeDeps();
    const before = Date.now();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'APPROVED',
      customerId: 'cust-1',
      serviceOrderId: 'ot-1',
      subtotalXaf: 20000,
      taxRate: 0.1925,
      taxAmountXaf: 3850,
      stampDutyXaf: 1000,
      totalXaf: 24850,
      lines: [],
      serviceOrder: { observations: [] },
    });
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv-new', status: 'ISSUED' });
    prismaMock.quote.update.mockResolvedValue({});

    await service.createInvoiceFromQuote('q-1', 'user-1');

    const dueDate: Date = prismaMock.invoice.create.mock.calls[0][0].data.dueDate;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(dueDate.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(dueDate.getTime()).toBeLessThanOrEqual(before + sevenDaysMs + 5000);
  });

  it('passe le devis en statut BILLED après création de facture', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'APPROVED',
      customerId: 'cust-1',
      serviceOrderId: 'ot-1',
      subtotalXaf: 20000,
      taxRate: 0.1925,
      taxAmountXaf: 3850,
      stampDutyXaf: 1000,
      totalXaf: 24850,
      lines: [],
      serviceOrder: { observations: [] },
    });
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv-new' });
    prismaMock.quote.update.mockResolvedValue({});

    await service.createInvoiceFromQuote('q-1', 'user-1');

    expect(prismaMock.quote.update).toHaveBeenCalledWith({
      where: { id: 'q-1' },
      data: { status: 'BILLED' },
    });
  });

  it('quote.findUnique inclut lines et serviceOrder.observations (includeInQuote:true, quotedAt:null)', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'APPROVED',
      customerId: 'cust-1',
      serviceOrderId: 'ot-1',
      subtotalXaf: 10000,
      taxRate: 0.1925,
      taxAmountXaf: 1925,
      stampDutyXaf: 0,
      totalXaf: 11925,
      lines: [],
      serviceOrder: { observations: [] },
    });
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv-new' });
    prismaMock.quote.update.mockResolvedValue({});

    await service.createInvoiceFromQuote('q-1', 'user-1');

    const call = prismaMock.quote.findUnique.mock.calls[0][0];
    expect(call.include.lines).toBe(true);
    expect(call.include.serviceOrder.include.observations.where.includeInQuote).toBe(true);
    expect(call.include.serviceOrder.include.observations.where.quotedAt).toBeNull();
  });

  it('marque les observations non facturées comme quotedAt', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quote.findUnique.mockResolvedValue({
      id: 'q-1',
      status: 'APPROVED',
      customerId: 'cust-1',
      serviceOrderId: 'ot-1',
      subtotalXaf: 20000,
      taxRate: 0.1925,
      taxAmountXaf: 3850,
      stampDutyXaf: 1000,
      totalXaf: 24850,
      lines: [],
      serviceOrder: {
        observations: [{ id: 'obs-1' }, { id: 'obs-2' }],
      },
    });
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv-new' });
    prismaMock.quote.update.mockResolvedValue({});
    prismaMock.technicianObservation.updateMany.mockResolvedValue({ count: 2 });

    await service.createInvoiceFromQuote('q-1', 'user-1');

    expect(prismaMock.technicianObservation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['obs-1', 'obs-2'] } },
      data: { quotedAt: expect.any(Date) },
    });
  });
});
