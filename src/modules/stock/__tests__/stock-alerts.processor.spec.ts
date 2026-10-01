import { Prisma } from '@prisma/client';
import {
  LOW_STOCK_JOB_MAX_AGE_MS,
  StockAlertsProcessor,
  lowStockJobId,
} from '../stock-alerts.processor';

const GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeProcessor(part: Record<string, unknown> | null) {
  const prisma = { partsCatalog: { findUnique: jest.fn().mockResolvedValue(part) } };
  const notifications = {
    getUserIdsByRoles: jest.fn().mockResolvedValue(['chef-1', 'admin-1']),
    createInApp: jest.fn().mockResolvedValue([]),
  };
  const processor = new StockAlertsProcessor(prisma as never, notifications as never);
  return { processor, prisma, notifications };
}

function job(overrides: Partial<{ name: string; timestamp: number; data: Record<string, unknown> }> = {}) {
  return {
    name: 'low-stock',
    timestamp: Date.now(),
    data: { partId: 'part-1', garageId: GARAGE_ID },
    ...overrides,
  } as never;
}

const lowPart = {
  id: 'part-1',
  garageId: GARAGE_ID,
  reference: 'FH-001',
  nameFr: 'Filtre à huile',
  qtyInStock: new Prisma.Decimal('2.000'),
  minThreshold: new Prisma.Decimal('10.000'),
};

describe('StockAlertsProcessor', () => {
  it('notifie le chef d’atelier et l’admin du garage de la pièce', async () => {
    const { processor, notifications } = makeProcessor(lowPart);

    const result = await processor.process(job());

    expect(notifications.getUserIdsByRoles).toHaveBeenCalledWith(['CHEF_ATELIER', 'ADMIN'], GARAGE_ID);
    expect(notifications.createInApp).toHaveBeenCalledWith({
      recipientIds: ['chef-1', 'admin-1'],
      title: 'Stock bas',
      body: 'FH-001 — Filtre à huile : 2 en stock (seuil 10).',
      link: '/stock/part-1',
    });
    expect(result).toEqual({ notified: 2 });
  });

  it('ignore l’arriéré de jobs de plus de 24 h (file longtemps sans worker)', async () => {
    const { processor, prisma, notifications } = makeProcessor(lowPart);

    const result = await processor.process(job({ timestamp: Date.now() - LOW_STOCK_JOB_MAX_AGE_MS - 1 }));

    expect(result).toEqual({ skipped: 'stale' });
    expect(prisma.partsCatalog.findUnique).not.toHaveBeenCalled();
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it('accepte un ancien job sans garageId : le garage vient de la pièce', async () => {
    const { processor, notifications } = makeProcessor(lowPart);

    await processor.process(job({ data: { partId: 'part-1', reference: 'FH-001', currentQty: '2' } }));

    expect(notifications.getUserIdsByRoles).toHaveBeenCalledWith(['CHEF_ATELIER', 'ADMIN'], GARAGE_ID);
  });

  it('ne notifie pas si la pièce a été réapprovisionnée entre-temps', async () => {
    const { processor, notifications } = makeProcessor({
      ...lowPart,
      qtyInStock: new Prisma.Decimal('12.000'),
    });

    expect(await processor.process(job())).toEqual({ skipped: 'restocked' });
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it('ne notifie pas si la pièce n’existe plus ou n’a pas de garage', async () => {
    for (const part of [null, { ...lowPart, garageId: null }]) {
      const { processor, notifications } = makeProcessor(part);
      expect(await processor.process(job())).toEqual({ skipped: 'part-missing' });
      expect(notifications.createInApp).not.toHaveBeenCalled();
    }
  });

  it('ignore un job de type inconnu', async () => {
    const { processor, notifications } = makeProcessor(lowPart);

    expect(await processor.process(job({ name: 'other' }))).toEqual({ skipped: 'unknown-job' });
    expect(notifications.createInApp).not.toHaveBeenCalled();
  });

  it('jobId : un par pièce et par jour, sans « : » (interdit par BullMQ)', () => {
    const id = lowStockJobId('part-1', new Date('2026-10-01T23:30:00.000Z'));
    expect(id).toBe('low-stock_part-1_2026-10-01');
    expect(id).not.toContain(':');
  });
});
