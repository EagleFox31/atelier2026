import { ReportsService } from '../reports.service';

const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeDeps() {
  const prismaMock = {
    invoice: { aggregate: jest.fn() },
    oTWorkItem: { findMany: jest.fn() },
  };
  const service = new ReportsService(prismaMock as any);
  return { service, prismaMock };
}

describe('ReportsService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── getRevenueReport() ───────────────────────────────────────────────────────

  describe('getRevenueReport()', () => {
    it('filtre toujours status: PAID', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({ _sum: { totalXaf: 0, amountPaidXaf: 0 } });

      await service.getRevenueReport(undefined, undefined, TEST_GARAGE_ID);

      expect(prismaMock.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PAID' }) }),
      );
    });

    it('sans dates → pas de filtre paidAt dans le where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({ _sum: { totalXaf: 0, amountPaidXaf: 0 } });

      await service.getRevenueReport(undefined, undefined, TEST_GARAGE_ID);

      const where = prismaMock.invoice.aggregate.mock.calls[0][0].where;
      expect(where.paidAt).toBeUndefined();
    });

    it('avec startDate seulement → paidAt.gte défini, lte absent', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({ _sum: { totalXaf: 0, amountPaidXaf: 0 } });

      await service.getRevenueReport('2026-01-01', undefined, TEST_GARAGE_ID);

      const { paidAt } = prismaMock.invoice.aggregate.mock.calls[0][0].where;
      expect(paidAt.gte).toEqual(new Date('2026-01-01'));
      expect(paidAt.lte).toBeUndefined();
    });

    it('avec endDate seulement → paidAt.lte défini, gte absent', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({ _sum: { totalXaf: 0, amountPaidXaf: 0 } });

      await service.getRevenueReport(undefined, '2026-05-31', TEST_GARAGE_ID);

      const { paidAt } = prismaMock.invoice.aggregate.mock.calls[0][0].where;
      expect(paidAt.lte).toEqual(new Date('2026-05-31'));
      expect(paidAt.gte).toBeUndefined();
    });

    it('agrège le CA des factures PAID avec startDate + endDate', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({
        _sum: { totalXaf: 500000, amountPaidXaf: 480000 },
      });

      const result = await service.getRevenueReport('2026-01-01', '2026-05-31', TEST_GARAGE_ID);

      expect(result).toEqual({
        totalRevenue:   500000,
        totalCollected: 480000,
        period: { startDate: '2026-01-01', endDate: '2026-05-31' },
      });
    });

    it('retourne 0 quand _sum est null (aucune facture PAID)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({
        _sum: { totalXaf: null, amountPaidXaf: null },
      });

      const result = await service.getRevenueReport(undefined, undefined, TEST_GARAGE_ID);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalCollected).toBe(0);
    });

    it('period utilise null quand les dates sont absentes (stable en JSON)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.invoice.aggregate.mockResolvedValue({ _sum: { totalXaf: 0, amountPaidXaf: 0 } });

      const result = await service.getRevenueReport(undefined, undefined, TEST_GARAGE_ID);

      expect(result.period).toEqual({ startDate: null, endDate: null });
    });
  });

  // ─── getWorkshopPerformance() ─────────────────────────────────────────────────

  describe('getWorkshopPerformance()', () => {
    it('filtre uniquement les work items COMPLETED', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([]);

      await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(prismaMock.oTWorkItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });

    it('retourne un objet vide si aucun work item COMPLETED', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([]);

      const result = await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(result).toEqual({});
    });

    it('agrège les heures de plusieurs items pour un même technicien', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 2,   actualHours: 2.5, technician: { firstName: 'Paul', lastName: 'Tech' } },
        { estimatedHours: 1,   actualHours: 1,   technician: { firstName: 'Paul', lastName: 'Tech' } },
        { estimatedHours: 3,   actualHours: 2,   technician: null },
      ]);

      const result = await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(result['Paul Tech']).toEqual({ estimatedHours: 3, actualHours: 3.5 });
      expect(result['Unassigned']).toEqual({ estimatedHours: 3, actualHours: 2 });
    });

    it('techniciens distincts → agrégats séparés', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 4, actualHours: 3, technician: { firstName: 'Jean', lastName: 'A' } },
        { estimatedHours: 2, actualHours: 5, technician: { firstName: 'Marc', lastName: 'B' } },
      ]);

      const result = await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['Jean A']).toEqual({ estimatedHours: 4, actualHours: 3 });
      expect(result['Marc B']).toEqual({ estimatedHours: 2, actualHours: 5 });
    });

    it('estimatedHours null/undefined coercé à 0', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: null, actualHours: null, technician: { firstName: 'Test', lastName: 'U' } },
      ]);

      const result = await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(result['Test U']).toEqual({ estimatedHours: 0, actualHours: 0 });
    });

    it('label "Unassigned" regroupe tous les items sans technicien', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.oTWorkItem.findMany.mockResolvedValue([
        { estimatedHours: 1, actualHours: 1, technician: null },
        { estimatedHours: 2, actualHours: 3, technician: null },
      ]);

      const result = await service.getWorkshopPerformance(TEST_GARAGE_ID);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result['Unassigned']).toEqual({ estimatedHours: 3, actualHours: 4 });
    });
  });
});
