import { PlanningService } from '../planning.service';
import { AppointmentStatus } from '@prisma/client';

const TEST_GARAGE_ID = '52221808-e45d-41a9-9a37-933695560f6c';

function makeDeps() {
  const prismaMock = {
    appointment: {
      create: jest.fn().mockResolvedValue({ id: 'appt-new' }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'appt-1', garageId: TEST_GARAGE_ID }),
      update: jest.fn().mockResolvedValue({ id: 'appt-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'appt-1' }),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cust-uuid-1' }),
    },
    vehicle: {
      findFirst: jest.fn().mockResolvedValue({ id: 'v-1' }),
    },
  };
  const service = new PlanningService(prismaMock as any);
  return { service, prismaMock };
}

describe('PlanningService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── findAll() ──────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('requête sans filtre → where vide', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, undefined, undefined);
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({}) }),
      );
    });

    it('filtre par statut quand fourni', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, undefined, AppointmentStatus.SCHEDULED);
      const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(AppointmentStatus.SCHEDULED);
    });

    it('construit une plage [00:00:00.000 → 23:59:59.999] pour le jour donné', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, '2026-05-23', undefined);

      const { gte, lte } = prismaMock.appointment.findMany.mock.calls[0][0].where.scheduledAt;

      expect(gte).toBeInstanceOf(Date);
      expect(lte).toBeInstanceOf(Date);
      // Début de journée — minuit local
      expect(gte.getHours()).toBe(0);
      expect(gte.getMinutes()).toBe(0);
      expect(gte.getSeconds()).toBe(0);
      expect(gte.getMilliseconds()).toBe(0);
      // Fin de journée — 23:59:59.999 local
      expect(lte.getHours()).toBe(23);
      expect(lte.getMinutes()).toBe(59);
      expect(lte.getSeconds()).toBe(59);
      expect(lte.getMilliseconds()).toBe(999);
    });

    it('startOfDay et endOfDay sont sur la même date calendaire', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, '2026-05-23', undefined);
      const { gte, lte } = prismaMock.appointment.findMany.mock.calls[0][0].where.scheduledAt;
      expect(gte.getDate()).toBe(lte.getDate());
      expect(gte.getMonth()).toBe(lte.getMonth());
      expect(gte.getFullYear()).toBe(lte.getFullYear());
    });

    it('combine date et statut dans le même where', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, '2026-05-23', AppointmentStatus.COMPLETED);
      const where = prismaMock.appointment.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(AppointmentStatus.COMPLETED);
      expect(where.scheduledAt).toBeDefined();
    });

    it('inclut customer et vehicle dans la requête', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, undefined, undefined);
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { customer: true, vehicle: true } }),
      );
    });

    it('tri par scheduledAt asc', async () => {
      const { service, prismaMock } = makeDeps();
      await service.findAll(TEST_GARAGE_ID, undefined, undefined);
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scheduledAt: 'asc' } }),
      );
    });
  });

  // ── remove() — hard delete intentionnel (pas de deletedAt) ─────────────────────

  describe('remove()', () => {
    it('appelle delete() et non update(), confirmant le hard delete', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.appointment.delete.mockResolvedValue({ id: 'appt-1' });

      await service.remove('appt-1', TEST_GARAGE_ID);

      expect(prismaMock.appointment.delete).toHaveBeenCalledWith({ where: { id: 'appt-1' } });
      expect(prismaMock.appointment.update).not.toHaveBeenCalled();
    });
  });

  // ── create() ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('transmet le body directement à Prisma sans transformation', async () => {
      const { service, prismaMock } = makeDeps();
      const body = {
        customerId: 'cust-uuid-1',
        scheduledAt: '2026-05-23T09:00:00.000Z',
        reason: 'Révision annuelle',
      };
      prismaMock.appointment.create.mockResolvedValue({ id: 'appt-new', ...body });

      await service.create(body as any, TEST_GARAGE_ID);

      expect(prismaMock.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust-uuid-1' }) }),
      );
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('délègue à Prisma sans transformation', async () => {
      const { service, prismaMock } = makeDeps();
      prismaMock.appointment.update.mockResolvedValue({ id: 'appt-1', status: 'COMPLETED' });

      await service.update('appt-1', { status: AppointmentStatus.COMPLETED } as any, TEST_GARAGE_ID);

      expect(prismaMock.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt-1' },
          data: expect.objectContaining({ status: AppointmentStatus.COMPLETED }),
        }),
      );
    });
  });
});
