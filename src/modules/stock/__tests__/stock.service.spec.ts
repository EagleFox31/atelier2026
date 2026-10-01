import { StockService } from '../stock.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeDeps() {
  const txMock = {
    stockMovement: { create: jest.fn() },
    aSPPurchase: { create: jest.fn() },
    partsCatalog: { findFirst: jest.fn().mockResolvedValue({ id: 'part-1', garageId: TEST_GARAGE_ID }) },
  };
  const prismaMock = {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    partsCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'part-1', garageId: TEST_GARAGE_ID }),
    },
    serviceOrder: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ot-1', garageId: TEST_GARAGE_ID }),
    },
  };
  const stockAlertsQueue = { add: jest.fn() };
  const notifMock = {
    getUserIdsByRoles: jest.fn().mockResolvedValue(['chef-1']),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const service = new StockService(prismaMock as any, notifMock as any, stockAlertsQueue as any);
  return { service, prismaMock, txMock, stockAlertsQueue, notifMock };
}

describe('StockService.applyMovement()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un mouvement de stock dans une transaction', async () => {
    const { service, txMock } = makeDeps();
    const movement = { id: 'mov-1', partId: 'part-1', quantity: 5 };
    txMock.stockMovement.create.mockResolvedValue(movement);

    const result = await service.applyMovement({
      partId: 'part-1',
      type: 'PURCHASE',
      quantity: 5,
      userId: 'user-1',
      garageId: TEST_GARAGE_ID,
      referenceDoc: 'PO-001',
    });

    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partId: 'part-1',
          movementType: 'PURCHASE',
          quantity: 5,
          performedBy: 'user-1',
        }),
      }),
    );
    expect(result).toEqual(movement);
  });

  it('transmet referenceDoc et unitPriceXaf quand fournis', async () => {
    const { service, txMock } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });

    await service.applyMovement({
      partId: 'part-1',
      type: 'PURCHASE',
      quantity: 3,
      userId: 'user-1',
      garageId: TEST_GARAGE_ID,
      referenceDoc: 'BL-2026-001',
      unitPriceXaf: 8000,
    });

    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceDoc: 'BL-2026-001',
          unitPriceXaf: 8000,
        }),
      }),
    );
  });

  it('transmet serviceOrderId quand fourni', async () => {
    const { service, txMock } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });

    await service.applyMovement({
      partId: 'part-1',
      type: 'OT_CONSUMPTION',
      quantity: -1,
      userId: 'user-1',
      garageId: TEST_GARAGE_ID,
      serviceOrderId: 'ot-42',
    });

    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceOrderId: 'ot-42' }),
      }),
    );
  });

  // Les quantités sont des Decimal Prisma : les tests utilisent de vrais Decimal
  // (des nombres masquaient la comparaison de chaînes de `<=`).
  function partStock(qtyInStock: string, minThreshold: string) {
    return { qtyInStock: new Prisma.Decimal(qtyInStock), minThreshold: new Prisma.Decimal(minThreshold) };
  }

  async function moveAndFlush(service: StockService) {
    const result = await service.applyMovement({
      partId: 'part-1',
      type: 'OT_CONSUMPTION',
      quantity: -1,
      userId: 'user-1',
      garageId: TEST_GARAGE_ID,
    });
    await jest.runAllTimersAsync();
    return result;
  }

  it.each([
    ['2 pour un seuil de 5', '2.000', '5.000'],
    ['égalité 3 = 3 (égalité = sous seuil)', '3.000', '3.000'],
    ['9 pour un seuil de 10 (raté par « <= » sur Decimal)', '9.000', '10.000'],
    ['2 pour un seuil de 10 (raté par « <= » sur Decimal)', '2.000', '10.000'],
  ])('met en file une alerte stock bas après commit : %s', async (_label, qty, min) => {
    jest.useFakeTimers({ now: new Date('2026-10-01T10:00:00.000Z') });
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue(partStock(qty, min));

    await moveAndFlush(service);

    expect(stockAlertsQueue.add).toHaveBeenCalledWith(
      'low-stock',
      { partId: 'part-1', garageId: TEST_GARAGE_ID },
      expect.objectContaining({
        jobId: 'low-stock_part-1_2026-10-01',
        attempts: 3,
        removeOnComplete: { age: 2 * 24 * 60 * 60 },
      }),
    );
    jest.useRealTimers();
  });

  it.each([
    ['10 pour un seuil de 5', '10.000', '5.000'],
    ['10 pour un seuil de 9 (faux positif de « <= » sur Decimal)', '10.000', '9.000'],
  ])('n’envoie pas d’alerte au-dessus du seuil : %s', async (_label, qty, min) => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue(partStock(qty, min));

    await moveAndFlush(service);

    expect(stockAlertsQueue.add).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('pas d\'alerte si la pièce est introuvable après le mouvement', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue(null);

    await moveAndFlush(service);

    expect(stockAlertsQueue.add).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('erreur d\'alerte swallowée — le mouvement est quand même retourné', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    const movement = { id: 'mov-1' };
    txMock.stockMovement.create.mockResolvedValue(movement);
    prismaMock.partsCatalog.findUnique.mockResolvedValue(partStock('1.000', '5.000'));
    stockAlertsQueue.add.mockRejectedValue(new Error('Redis indisponible'));

    const result = await moveAndFlush(service);

    // Le mouvement a bien été retourné malgré l'échec de l'alerte
    expect(result).toEqual(movement);
    jest.useRealTimers();
  });
});

describe('StockService.recordASP()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée ASP + entrée PURCHASE + sortie OT_CONSUMPTION', async () => {
    const { service, txMock } = makeDeps();
    txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-2026-001' });
    txMock.stockMovement.create.mockResolvedValue({});

    await service.recordASP({
      partId: 'part-1',
      serviceOrderId: 'ot-1',
      quantity: 2,
      purchasePrice: 5000,
      salePrice: 7500,
      userId: 'user-1',
      supplierName: 'Garage Express',
      garageId: TEST_GARAGE_ID,
    });

    expect(txMock.aSPPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceOrderId: 'ot-1',
          partId: 'part-1',
          quantity: 2,
          status: 'RECEIVED',
          supplierName: 'Garage Express',
        }),
      }),
    );

    expect(txMock.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(txMock.stockMovement.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ movementType: 'PURCHASE', quantity: 2 }),
      }),
    );
    expect(txMock.stockMovement.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ movementType: 'OT_CONSUMPTION', quantity: -2 }),
      }),
    );
  });

  it('enregistre purchasePriceXaf et salePriceXaf dans l\'ASP', async () => {
    const { service, txMock } = makeDeps();
    txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' });
    txMock.stockMovement.create.mockResolvedValue({});

    await service.recordASP({
      partId: 'part-1', serviceOrderId: 'ot-1', quantity: 1,
      purchasePrice: 5000, salePrice: 7500, userId: 'user-1', supplierName: 'S',
      garageId: TEST_GARAGE_ID,
    });

    expect(txMock.aSPPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purchasePriceXaf: 5000, salePriceXaf: 7500 }),
      }),
    );
  });

  it('les deux mouvements référencent l\'ASP via referenceDoc', async () => {
    const { service, txMock } = makeDeps();
    txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-2026-099' });
    txMock.stockMovement.create.mockResolvedValue({});

    await service.recordASP({
      partId: 'part-1', serviceOrderId: 'ot-1', quantity: 1,
      purchasePrice: 3000, salePrice: 4000, userId: 'user-1', supplierName: 'S',
      garageId: TEST_GARAGE_ID,
    });

    const calls = txMock.stockMovement.create.mock.calls;
    expect(calls[0][0].data.referenceDoc).toBe('ASP-ASP-2026-099');
    expect(calls[1][0].data.referenceDoc).toBe('ASP-ASP-2026-099');
  });

  it('les deux mouvements héritent du serviceOrderId et de performedBy', async () => {
    const { service, txMock } = makeDeps();
    txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' });
    txMock.stockMovement.create.mockResolvedValue({});

    await service.recordASP({
      partId: 'part-1', serviceOrderId: 'ot-99', quantity: 1,
      purchasePrice: 1000, salePrice: 1500, userId: 'chef-7', supplierName: 'S',
      garageId: TEST_GARAGE_ID,
    });

    const calls = txMock.stockMovement.create.mock.calls;
    for (const call of calls) {
      expect(call[0].data.serviceOrderId).toBe('ot-99');
      expect(call[0].data.performedBy).toBe('chef-7');
    }
  });

  it('authorizedBy et createdBy de l\'ASP = userId', async () => {
    const { service, txMock } = makeDeps();
    txMock.aSPPurchase.create.mockResolvedValue({ id: 'asp-1', reference: 'ASP-001' });
    txMock.stockMovement.create.mockResolvedValue({});

    await service.recordASP({
      partId: 'part-1', serviceOrderId: 'ot-1', quantity: 1,
      purchasePrice: 1000, salePrice: 1500, userId: 'chef-5', supplierName: 'S',
      garageId: TEST_GARAGE_ID,
    });

    expect(txMock.aSPPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorizedBy: 'chef-5',
          createdBy:    'chef-5',
          receivedAt:   expect.any(Date),
        }),
      }),
    );
  });

  it('retourne l\'ASP créé (pas les mouvements)', async () => {
    const { service, txMock } = makeDeps();
    const asp = { id: 'asp-1', reference: 'ASP-2026-001', quantity: 2 };
    txMock.aSPPurchase.create.mockResolvedValue(asp);
    txMock.stockMovement.create.mockResolvedValue({});

    const result = await service.recordASP({
      partId: 'part-1', serviceOrderId: 'ot-1', quantity: 2,
      purchasePrice: 5000, salePrice: 7000, userId: 'u-1', supplierName: 'S',
      garageId: TEST_GARAGE_ID,
    });

    expect(result).toEqual(asp);
  });
});

describe('StockService.getPart()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la pièce avec supplier', async () => {
    const { service, prismaMock } = makeDeps();
    const part = { id: 'part-1', reference: 'FLT-001', supplier: { id: 'sup-1' } };
    prismaMock.partsCatalog.findFirst.mockResolvedValue(part);

    const result = await service.getPart('part-1', TEST_GARAGE_ID);

    expect(prismaMock.partsCatalog.findFirst).toHaveBeenCalledWith({
      where: { id: 'part-1', garageId: TEST_GARAGE_ID },
      include: { supplier: true },
    });
    expect(result).toEqual(part);
  });

  it('lève NotFoundException si pièce introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.partsCatalog.findFirst.mockResolvedValue(null);

    await expect(service.getPart('part-inexistant', TEST_GARAGE_ID)).rejects.toThrow(NotFoundException);
  });
});
