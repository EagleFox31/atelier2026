import { NotFoundException } from '@nestjs/common';
import { VehiclesService } from '../vehicles.service';

function makeDeps() {
  const prismaMock = {
    vehicle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    vehicleMake: { findMany: jest.fn() },
    vehicleModel: { findMany: jest.fn() },
  };
  const service = new VehiclesService(prismaMock as any);
  return { service, prismaMock };
}

describe('VehiclesService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('findAll()', () => {
    it('sans filtre : uniquement deletedAt: null dans le where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll();

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ deletedAt: null });
    });

    it('filtre deletedAt: null et customerId optionnel', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'cust-1');

      expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, customerId: 'cust-1' },
        }),
      );
    });

    it('filtre textuel : OR sur 5 champs (plaque, vin, prénom, nom, société)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll('Toyota');

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(5);
    });

    it('OR contient les champs de recherche avec le bon contenu', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll('LT-1234');

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where.OR[0]).toEqual({ plateNumber: { contains: 'LT-1234', mode: 'insensitive' } });
      expect(where.OR[1]).toEqual({ vin: { contains: 'LT-1234', mode: 'insensitive' } });
      expect(where.OR[2]).toEqual({ customer: { firstName: { contains: 'LT-1234', mode: 'insensitive' } } });
    });

    it('sans customerId : ne met pas la clé customerId dans where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll();

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('customerId');
    });

    it('sans search : ne met pas la clé OR dans where', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll();

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('OR');
    });

    it('OR contient les 5 champs complets (lastName, companyName inclus)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll('Toyota');

      const where = prismaMock.vehicle.findMany.mock.calls[0][0].where;
      expect(where.OR[3]).toEqual({ customer: { lastName: { contains: 'Toyota', mode: 'insensitive' } } });
      expect(where.OR[4]).toEqual({ customer: { companyName: { contains: 'Toyota', mode: 'insensitive' } } });
    });

    it('include contient customer, make et model', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll();

      const call = prismaMock.vehicle.findMany.mock.calls[0][0];
      expect(call.include.customer).toBe(true);
      expect(call.include.make).toBe(true);
      expect(call.include.model).toBe(true);
    });

    it('tri par createdAt desc', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('getMakes() / getModels()', () => {
    it('liste les marques triées', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicleMake.findMany.mockResolvedValue([{ id: '1', name: 'Toyota' }]);

      const result = await service.getMakes();

      expect(prismaMock.vehicleMake.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
      expect(result).toHaveLength(1);
    });

    it('filtre les modèles par makeId', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicleModel.findMany.mockResolvedValue([]);

      await service.getModels('make-1');

      expect(prismaMock.vehicleModel.findMany).toHaveBeenCalledWith({
        where: { makeId: 'make-1' },
        orderBy: { name: 'asc' },
      });
    });

    it('getModels() sans makeId → where vide', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicleModel.findMany.mockResolvedValue([]);

      await service.getModels();

      expect(prismaMock.vehicleModel.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne()', () => {
    it('lève NotFoundException si véhicule introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('inexistant')).rejects.toThrow(
        new NotFoundException('Véhicule introuvable'),
      );
    });

    it('retourne le véhicule avec ses relations (filtré sur deletedAt: null)', async () => {
      const { service, prismaMock } = makeDeps();
      const vehicle = { id: 'v-1', plateNumber: 'LT-1234', deletedAt: null };
      prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);

      const result = await service.findOne('v-1');

      expect(result).toEqual(vehicle);
      expect(prismaMock.vehicle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'v-1', deletedAt: null } }),
      );
    });

    it('findOne : include contient customer, make, model et serviceOrders (take:10, orderBy:openedAt desc)', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findFirst.mockResolvedValue({ id: 'v-1' });

      await service.findOne('v-1');

      const call = prismaMock.vehicle.findFirst.mock.calls[0][0];
      expect(call.include.customer).toBe(true);
      expect(call.include.make).toBe(true);
      expect(call.include.model).toBe(true);
      expect(call.include.serviceOrders.take).toBe(10);
      expect(call.include.serviceOrders.orderBy).toEqual({ openedAt: 'desc' });
    });
  });

  describe('create()', () => {
    it('délègue à Prisma sans transformation', async () => {
      const { service, prismaMock } = makeDeps();
      const data = { plateNumber: 'DL-999', customerId: 'cust-1' };
      prismaMock.vehicle.create.mockResolvedValue({ id: 'v-new', ...data });

      const result = await service.create(data);

      expect(prismaMock.vehicle.create).toHaveBeenCalledWith({ data });
      expect(result.id).toBe('v-new');
    });
  });

  describe('update()', () => {
    it('lève NotFoundException si le véhicule est introuvable', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findFirst.mockResolvedValue(null);

      await expect(service.update('inexistant', {})).rejects.toThrow(NotFoundException);
    });

    it('appelle vehicle.update si le véhicule existe', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findFirst.mockResolvedValue({ id: 'v-1', deletedAt: null });
      prismaMock.vehicle.update.mockResolvedValue({ id: 'v-1', plateNumber: 'LT-999' });

      await service.update('v-1', { plateNumber: 'LT-999' });

      expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { plateNumber: 'LT-999' },
      });
    });
  });

  describe('remove()', () => {
    it('soft delete via deletedAt', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.vehicle.findFirst.mockResolvedValue({ id: 'v-1', deletedAt: null });
      prismaMock.vehicle.update.mockResolvedValue({ id: 'v-1', deletedAt: new Date() });

      await service.remove('v-1');

      expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
