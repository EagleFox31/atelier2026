import { NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers.service';

function makeDeps() {
  const prismaMock = {
    customer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new CustomersService(prismaMock as any);
  return { service, prismaMock };
}

describe('CustomersService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('filtre deletedAt: null par défaut', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('sans type : ne met pas la clé customerType dans where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll();

      const where = prismaMock.customer.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('customerType');
    });

    it('sans search : ne met pas la clé OR dans where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll();

      const where = prismaMock.customer.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('OR');
    });

    it('tri par createdAt desc', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('applique recherche et type', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll('Dupont', 'INDIVIDUAL');

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            customerType: 'INDIVIDUAL',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('OR contient les 5 champs de recherche avec le bon contenu', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findMany.mockResolvedValue([]);

      await service.findAll('Dupont');

      const where = prismaMock.customer.findMany.mock.calls[0][0].where;
      expect(where.OR[0]).toEqual({ firstName: { contains: 'Dupont', mode: 'insensitive' } });
      expect(where.OR[1]).toEqual({ lastName: { contains: 'Dupont', mode: 'insensitive' } });
      expect(where.OR[2]).toEqual({ companyName: { contains: 'Dupont', mode: 'insensitive' } });
      expect(where.OR[3]).toEqual({ phonePrimary: { contains: 'Dupont' } });
      expect(where.OR[4]).toEqual({ email: { contains: 'Dupont', mode: 'insensitive' } });
    });
  });

  describe('findOne()', () => {
    it('lève NotFoundException si client introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('inexistant')).rejects.toThrow(
        new NotFoundException('Client introuvable'),
      );
    });

    it('include contient vehicles et serviceOrders avec orderBy + take:5', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', vehicles: [], serviceOrders: [] });

      await service.findOne('c-1');

      const call = prismaMock.customer.findUnique.mock.calls[0][0];
      expect(call.include.vehicles).toBe(true);
      expect(call.include.serviceOrders.take).toBe(5);
      expect(call.include.serviceOrders.orderBy).toEqual({ openedAt: 'desc' });
    });
  });

  describe('remove()', () => {
    it('soft delete via deletedAt', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prismaMock.customer.update.mockResolvedValue({ id: 'c-1', deletedAt: new Date() });

      await service.remove('c-1');

      expect(prismaMock.customer.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
