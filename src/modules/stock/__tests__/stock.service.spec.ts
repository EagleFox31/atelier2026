import { StockService } from '../stock.service';
import { NotFoundException } from '@nestjs/common';

function makeDeps() {
  const txMock = {
    stockMovement: { create: jest.fn() },
    aSPPurchase: { create: jest.fn() },
  };
  const prismaMock = {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
    partsCatalog: { findUnique: jest.fn() },
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
      serviceOrderId: 'ot-42',
    });

    expect(txMock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceOrderId: 'ot-42' }),
      }),
    );
  });

  it('déclenche une alerte stock bas si qty ≤ seuil (post-commit)', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1',
      reference: 'REF-001',
      nameFr: 'Filtre huile',
      qtyInStock: 2,
      minThreshold: 5,
    });

    await service.applyMovement({
      partId: 'part-1',
      type: 'OT_CONSUMPTION',
      quantity: -3,
      userId: 'user-1',
    });

    await jest.runAllTimersAsync();

    expect(stockAlertsQueue.add).toHaveBeenCalledWith('low-stock', {
      partId: 'part-1',
      reference: 'REF-001',
      name: 'Filtre huile',
      currentQty: 2,
      threshold: 5,
    });
    jest.useRealTimers();
  });

  it('alerte déclenchée quand qty === seuil (égalité = sous seuil)', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1', reference: 'REF-002', nameFr: 'Courroie',
      qtyInStock: 3, minThreshold: 3,
    });

    await service.applyMovement({ partId: 'part-1', type: 'OT_CONSUMPTION', quantity: -1, userId: 'u-1' });
    await jest.runAllTimersAsync();

    expect(stockAlertsQueue.add).toHaveBeenCalledWith('low-stock', expect.objectContaining({ currentQty: 3 }));
    jest.useRealTimers();
  });

  it('n\'envoie pas d\'alerte si stock au-dessus du seuil', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1',
      reference: 'REF-001',
      nameFr: 'Filtre huile',
      qtyInStock: 10,
      minThreshold: 5,
    });

    await service.applyMovement({
      partId: 'part-1',
      type: 'PURCHASE',
      quantity: 10,
      userId: 'user-1',
    });

    await jest.runAllTimersAsync();
    expect(stockAlertsQueue.add).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('pas d\'alerte si la pièce est introuvable après le mouvement', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    txMock.stockMovement.create.mockResolvedValue({ id: 'mov-1' });
    prismaMock.partsCatalog.findUnique.mockResolvedValue(null);

    await service.applyMovement({ partId: 'part-inexistant', type: 'PURCHASE', quantity: 1, userId: 'u-1' });
    await jest.runAllTimersAsync();

    expect(stockAlertsQueue.add).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('erreur d\'alerte swallowée — le mouvement est quand même retourné', async () => {
    jest.useFakeTimers();
    const { service, txMock, prismaMock, stockAlertsQueue } = makeDeps();
    const movement = { id: 'mov-1' };
    txMock.stockMovement.create.mockResolvedValue(movement);
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1', reference: 'R', nameFr: 'P', qtyInStock: 1, minThreshold: 5,
    });
    stockAlertsQueue.add.mockRejectedValue(new Error('Redis indisponible'));

    const result = await service.applyMovement({ partId: 'part-1', type: 'OT_CONSUMPTION', quantity: -1, userId: 'u-1' });

    await jest.runAllTimersAsync();

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
    });

    expect(result).toEqual(asp);
  });
});

describe('StockService.getPart()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne la pièce avec supplier', async () => {
    const { service, prismaMock } = makeDeps();
    const part = { id: 'part-1', reference: 'FLT-001', supplier: { id: 'sup-1' } };
    prismaMock.partsCatalog.findUnique.mockResolvedValue(part);

    const result = await service.getPart('part-1');

    expect(prismaMock.partsCatalog.findUnique).toHaveBeenCalledWith({
      where: { id: 'part-1' },
      include: { supplier: true },
    });
    expect(result).toEqual(part);
  });

  it('lève NotFoundException si pièce introuvable', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.partsCatalog.findUnique.mockResolvedValue(null);

    await expect(service.getPart('part-inexistant')).rejects.toThrow(NotFoundException);
  });
});
