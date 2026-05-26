import { BillingService } from '../billing.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { WorkshopService } from '../../workshop/workshop.service';

// Mocks minimaux — les méthodes Prisma ne sont pas appelées par computeAmounts
const mockPrisma = {} as unknown as PrismaService;
const mockWorkshop = {} as unknown as WorkshopService;

function makeInvoiceDeps() {
  const prismaMock = { invoice: { findMany: jest.fn().mockResolvedValue([]) } };
  const service = new BillingService(prismaMock as any, {} as any, {} as any, {} as any);
  return { service, prismaMock };
}

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    service = new BillingService(mockPrisma, mockWorkshop, {} as any, {} as any);
  });

  describe('computeAmounts()', () => {
    it('retourne le subtotal inchangé', () => {
      const result = service.computeAmounts(10000);
      expect(result.subtotal).toBe(10000);
    });

    it('applique la TVA camerounaise de 19.25%', () => {
      const result = service.computeAmounts(10000);
      // 10000 * 0.1925 = 1925
      expect(result.taxRate).toBe(0.1925);
      expect(result.taxAmount).toBe(1925);
    });

    it('arrondit la TVA à l\'entier le plus proche', () => {
      // 7777 * 0.1925 = 1496.6525 → arrondi à 1497
      const result = service.computeAmounts(7777);
      expect(result.taxAmount).toBe(Math.round(7777 * 0.1925));
    });

    it('n\'applique pas le timbre si total ≤ 20000 XAF', () => {
      // subtotal=10000, TVA=1925, total=11925 — sous le seuil
      const result = service.computeAmounts(10000);
      expect(result.stampDuty).toBe(0);
    });

    it('applique le timbre de 1000 XAF si total > 20000 XAF', () => {
      // subtotal=20000, TVA=3850, total avant timbre=23850 → timbre appliqué
      const result = service.computeAmounts(20000);
      expect(result.stampDuty).toBe(1000);
    });

    it('calcule le total = subtotal + TVA + timbre', () => {
      const result = service.computeAmounts(20000);
      expect(result.total).toBe(result.subtotal + result.taxAmount + result.stampDuty);
    });

    it('total exact pour 20000 XAF : 20000 + 3850 + 1000 = 24850', () => {
      const result = service.computeAmounts(20000);
      expect(result.total).toBe(24850);
    });

    it('gère un montant de 0 XAF sans erreur', () => {
      const result = service.computeAmounts(0);
      expect(result.subtotal).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.stampDuty).toBe(0);
      expect(result.total).toBe(0);
    });

    it('gère des montants élevés (facture > 1M XAF)', () => {
      const result = service.computeAmounts(1_000_000);
      expect(result.taxAmount).toBe(192_500);
      expect(result.stampDuty).toBe(1000);
      expect(result.total).toBe(1_193_500);
    });

    // Seuil exact — 20000 XAF de subtotal dépasse le seuil (20000 + TVA > 20000)
    // Mais subtotal=16807 → 16807 + 3235 = 20042 > 20000 → timbre
    it('applique le timbre dès que subtotal + TVA dépasse 20000', () => {
      // subtotal très proche du seuil mais qui le dépasse
      const subtotal = 17000;
      const tva = Math.round(subtotal * 0.1925); // 3273
      const total = subtotal + tva; // 20273 > 20000
      const result = service.computeAmounts(subtotal);
      expect(total).toBeGreaterThan(20000);
      expect(result.stampDuty).toBe(1000);
    });

  describe('listInvoices()', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sans filtre : where est vide {}', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices();
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).toEqual({});
    });

    it('filtre par customerId uniquement', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices('cust-1');
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ customerId: 'cust-1' });
    });

    it('filtre par status uniquement', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices(undefined, 'PAID');
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ status: 'PAID' });
    });

    it('combine customerId et status', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices('cust-2', 'ISSUED');
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ customerId: 'cust-2', status: 'ISSUED' });
    });

    it('sans customerId : ne met pas la clé customerId dans where', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices();
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('customerId');
    });

    it('sans status : ne met pas la clé status dans where', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices();
      const where = prismaMock.invoice.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('status');
    });

    it('include contient customer, lines, payments, serviceOrder.reference et creator.firstName/lastName', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices();
      const call = prismaMock.invoice.findMany.mock.calls[0][0];
      expect(call.include.customer).toBe(true);
      expect(call.include.lines).toBe(true);
      expect(call.include.payments).toBe(true);
      expect(call.include.serviceOrder.select.reference).toBe(true);
      expect(call.include.creator.select.firstName).toBe(true);
      expect(call.include.creator.select.lastName).toBe(true);
    });

    it('tri par createdAt desc', async () => {
      const { service, prismaMock } = makeInvoiceDeps();
      await service.listInvoices();
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

    it('ne met pas le timbre si subtotal + TVA est exactement 20000', () => {
      // 20000 / 1.1925 ≈ 16772 → 16772 + 3228 = 20000 (exactement le seuil)
      // On cherche un subtotal tel que subtotal + round(subtotal * 0.1925) == 20000
      // subtotal = 16772 → TVA = round(16772 * 0.1925) = round(3228.59) = 3229 → total = 20001
      // subtotal = 16771 → TVA = round(16771 * 0.1925) = round(3228.4) = 3228 → total = 19999 ≤ 20000
      const result = service.computeAmounts(16771);
      expect(result.subtotal + result.taxAmount).toBeLessThanOrEqual(20000);
      expect(result.stampDuty).toBe(0);
    });
  });
});
