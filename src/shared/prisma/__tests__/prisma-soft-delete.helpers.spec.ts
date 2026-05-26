import {
  SOFT_DELETE_MODELS,
  hideDeleted,
  redirectToSoftUpdate,
  softDeleteData,
  withNotDeleted,
} from '../prisma-soft-delete.helpers';

describe('prisma-soft-delete helpers', () => {
  describe('SOFT_DELETE_MODELS', () => {
    it('couvre User, Customer et Vehicle uniquement', () => {
      expect([...SOFT_DELETE_MODELS].sort()).toEqual(['Customer', 'User', 'Vehicle']);
    });
  });

  describe('withNotDeleted()', () => {
    it('ajoute deletedAt: null pour Customer', () => {
      const result = withNotDeleted('Customer', { where: { id: 'c-1' } });
      expect(result.where).toEqual({ id: 'c-1', deletedAt: null });
    });

    it('ne modifie pas les modèles sans soft delete', () => {
      const args = { where: { id: 'ot-1' } };
      expect(withNotDeleted('ServiceOrder', args)).toBe(args);
    });

    it('préserve les filtres existants', () => {
      const result = withNotDeleted('Vehicle', {
        where: { customerId: 'c-1', plateNumber: 'LT-123' },
      });
      expect(result.where).toEqual({
        customerId: 'c-1',
        plateNumber: 'LT-123',
        deletedAt: null,
      });
    });
  });

  describe('hideDeleted()', () => {
    it('retourne null si deletedAt est renseigné', () => {
      const row = { id: 'c-1', deletedAt: new Date('2026-01-01') };
      expect(hideDeleted('Customer', row)).toBeNull();
    });

    it('retourne la ligne si deletedAt est null', () => {
      const row = { id: 'c-1', deletedAt: null };
      expect(hideDeleted('Customer', row)).toEqual(row);
    });

    it('ne filtre pas les modèles hors soft delete', () => {
      const row = { id: 'ot-1', deletedAt: new Date() };
      expect(hideDeleted('ServiceOrder', row)).toEqual(row);
    });
  });

  describe('softDeleteData()', () => {
    it('User → deletedAt + status DELETED', () => {
      const data = softDeleteData('User');
      expect(data.status).toBe('DELETED');
      expect(data.deletedAt).toBeInstanceOf(Date);
    });

    it('Customer → deletedAt uniquement', () => {
      const data = softDeleteData('Customer');
      expect(data).toEqual({ deletedAt: expect.any(Date) });
      expect(data).not.toHaveProperty('status');
    });
  });

  describe('redirectToSoftUpdate()', () => {
    it('delete Customer → update avec deletedAt', async () => {
      const query = jest.fn().mockResolvedValue({ id: 'c-1', deletedAt: new Date() });
      await redirectToSoftUpdate(query, 'Customer', 'update', { where: { id: 'c-1' } });

      expect(query).toHaveBeenCalledWith({
        model: 'Customer',
        operation: 'update',
        args: {
          where: { id: 'c-1' },
          data: { deletedAt: expect.any(Date) },
        },
      });
    });

    it('deleteMany User → updateMany avec status DELETED', async () => {
      const query = jest.fn().mockResolvedValue({ count: 2 });
      await redirectToSoftUpdate(query, 'User', 'updateMany', { where: { status: 'INACTIVE' } });

      expect(query).toHaveBeenCalledWith({
        model: 'User',
        operation: 'updateMany',
        args: {
          where: { status: 'INACTIVE' },
          data: { deletedAt: expect.any(Date), status: 'DELETED' },
        },
      });
    });
  });
});
