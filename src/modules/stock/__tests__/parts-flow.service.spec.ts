import { BadRequestException } from '@nestjs/common';
import { PartStatus } from '@prisma/client';
import { PartsFlowService } from '../parts-flow.service';

const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeDeps() {
  const prismaMock = {
    quoteLine: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    partsCatalog: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    aSPPurchase: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    serviceOrder: {
      findUnique: jest.fn().mockResolvedValue({ garageId: TEST_GARAGE_ID }),
    },
    quote: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  };
  const notifMock = {
    getUserIdsByRoles: jest.fn().mockResolvedValue(['chef-1']),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const service = new PartsFlowService(prismaMock as any, notifMock as any);
  return { service, prismaMock, notifMock };
}

describe('PartsFlowService.onQuoteApproved()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('réserve le stock quand disponible', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quoteLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        partId: 'part-1',
        quantity: 2,
        unitPriceXaf: 10000,
        description: 'Filtre',
        partStatus: PartStatus.PENDING,
        part: { id: 'part-1', reference: 'FLT-01', nameFr: 'Filtre', qtyInStock: 10, qtyReserved: 0, purchasePriceXaf: 5000 },
      },
    ]);

    const result = await service.onQuoteApproved({
      quoteId: 'q-1',
      serviceOrderId: 'ot-1',
      userId: 'user-1',
    });

    expect(result.reserved).toBe(1);
    expect(prismaMock.partsCatalog.update).toHaveBeenCalledWith({
      where: { id: 'part-1' },
      data: { qtyReserved: { increment: 2 } },
    });
    expect(prismaMock.quoteLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: { partStatus: PartStatus.STOCK_RESERVED },
    });
  });

  it('crée un ASP si stock insuffisant', async () => {
    const { service, prismaMock, notifMock } = makeDeps();
    prismaMock.quoteLine.findMany
      .mockResolvedValueOnce([
        {
          id: 'line-2',
          partId: 'part-2',
          quantity: 5,
          unitPriceXaf: 20000,
          description: 'Plaquettes',
          partStatus: PartStatus.PENDING,
          part: { id: 'part-2', reference: 'BRK-01', nameFr: 'Plaquettes', qtyInStock: 1, qtyReserved: 0, purchasePriceXaf: null },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.onQuoteApproved({
      quoteId: 'q-1',
      serviceOrderId: 'ot-1',
      userId: 'user-1',
      otReference: 'OT-001',
    });

    expect(result.aspCreated).toBe(1);
    expect(prismaMock.aSPPurchase.create).toHaveBeenCalled();
    expect(notifMock.createInApp).toHaveBeenCalled();
  });
});

describe('PartsFlowService.consumeReservedParts()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('déstocke les pièces réservées', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quoteLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        partId: 'part-1',
        quantity: 2,
        partStatus: PartStatus.STOCK_RESERVED,
        part: { id: 'part-1' },
      },
    ]);
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1',
      reference: 'FLT-01',
      qtyInStock: 10,
      qtyReserved: 2,
    });

    const result = await service.consumeReservedParts('ot-1', 'user-1');

    expect(result.consumed).toBe(1);
    expect(prismaMock.stockMovement.create).toHaveBeenCalled();
    expect(prismaMock.quoteLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: { partStatus: PartStatus.CONSUMED },
    });
  });

  it('lève BadRequestException si stock insuffisant', async () => {
    const { service, prismaMock } = makeDeps();
    prismaMock.quoteLine.findMany.mockResolvedValue([
      {
        id: 'line-1',
        partId: 'part-1',
        quantity: 5,
        partStatus: PartStatus.STOCK_RESERVED,
        part: { id: 'part-1' },
      },
    ]);
    prismaMock.partsCatalog.findUnique.mockResolvedValue({
      id: 'part-1',
      reference: 'FLT-01',
      qtyInStock: 2,
      qtyReserved: 5,
    });

    await expect(service.consumeReservedParts('ot-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
