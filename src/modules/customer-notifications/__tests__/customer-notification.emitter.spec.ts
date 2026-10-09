import { Prisma } from '@prisma/client';
import { CustomerNotificationEmitter, type CustomerNotificationInput } from '../customer-notification.emitter';
import { CustomerNotificationSweeper } from '../customer-notification.sweeper';

const INPUT: CustomerNotificationInput = {
  garageId: 'g1',
  eventType: 'VEHICLE_READY',
  idempotencyKey: 'ot.ready:o1:v1',
  customerId: 'c1',
  refs: { serviceOrderId: 'o1' },
  variables: { customerName: 'Jean', plate: 'LT 123 AB', garageName: 'Garage Central' },
};

function makeEmitter(options: { enabled?: boolean; existing?: { id: string; status: string } | null } = {}) {
  const prisma = {
    customerNotification: {
      findUnique: jest.fn().mockResolvedValue(options.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'n1', status: 'PENDING' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: { findFirst: jest.fn().mockResolvedValue(null) },
    workshopSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    garage: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const preferences = { isEnabled: jest.fn().mockResolvedValue(options.enabled ?? true) };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const emitter = new CustomerNotificationEmitter(prisma as never, preferences as never, queue as never);
  return { emitter, prisma, queue };
}

describe('CustomerNotificationEmitter', () => {
  it('écrit l’outbox puis met en file avec un jobId déterministe, sans PII dans Redis', async () => {
    const { emitter, prisma, queue } = makeEmitter();

    await expect(emitter.emit(INPUT)).resolves.toEqual({ outcome: 'QUEUED', notificationId: 'n1' });

    expect(prisma.customerNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ garageId: 'g1', idempotencyKey: 'ot.ready:o1:v1', serviceOrderId: 'o1' }),
      select: { id: true, status: true },
    });
    expect(queue.add).toHaveBeenCalledWith('dispatch', { notificationId: 'n1' }, expect.objectContaining({ jobId: 'cn_n1' }));
  });

  it('même clé déjà émise et traitée : ni nouvelle ligne, ni nouvelle mise en file', async () => {
    const { emitter, prisma, queue } = makeEmitter({ existing: { id: 'n1', status: 'ACCEPTED' } });
    await expect(emitter.emit(INPUT)).resolves.toEqual({ outcome: 'ALREADY_EXISTS', notificationId: 'n1' });
    expect(prisma.customerNotification.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('émission concurrente (P2002) : relit la ligne gagnante', async () => {
    const { emitter, prisma } = makeEmitter();
    prisma.customerNotification.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );
    prisma.customerNotification.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'n9', status: 'PENDING' });

    await expect(emitter.emit(INPUT)).resolves.toEqual({ outcome: 'ALREADY_EXISTS', notificationId: 'n9' });
  });

  it('événement désactivé par le garage : rien n’est écrit', async () => {
    const { emitter, prisma } = makeEmitter({ enabled: false });
    await expect(emitter.emit(INPUT)).resolves.toEqual({ outcome: 'DISABLED_BY_GARAGE' });
    expect(prisma.customerNotification.create).not.toHaveBeenCalled();
  });

  it('objet sans garage : ignoré', async () => {
    const { emitter, prisma } = makeEmitter();
    await expect(emitter.emit({ ...INPUT, garageId: null })).resolves.toEqual({ outcome: 'IGNORED_NO_GARAGE' });
    expect(prisma.customerNotification.findUnique).not.toHaveBeenCalled();
  });

  it('Redis indisponible : la ligne reste PENDING pour le balayeur, l’émission ne casse pas', async () => {
    const { emitter, queue } = makeEmitter();
    queue.add.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(emitter.emit(INPUT)).resolves.toEqual({ outcome: 'QUEUED', notificationId: 'n1' });
  });

  it('emitSafely ne propage jamais d’erreur (variable manquante)', async () => {
    const { emitter } = makeEmitter();
    await expect(emitter.emitSafely({ ...INPUT, variables: {} })).resolves.toBeNull();
    await expect(emitter.emit({ ...INPUT, variables: {} })).rejects.toThrow('Variables manquantes');
  });

  it('complète le nom du client et du garage quand l’appelant ne les fournit pas', async () => {
    const { emitter, prisma } = makeEmitter();
    prisma.customer.findFirst.mockResolvedValue({ customerType: 'COMPANY', companyName: 'SOTRACAM', firstName: null, lastName: null });
    prisma.workshopSettings.findUnique.mockResolvedValue({ shopName: 'Garage Central' });

    await emitter.emit({ ...INPUT, variables: { plate: 'LT 123 AB' } });

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1', garageId: 'g1' } }));
    expect(prisma.customerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variables: { plate: 'LT 123 AB', customerName: 'SOTRACAM', garageName: 'Garage Central' },
        }),
      }),
    );
  });

  it('sans paramètres d’atelier : nom du garage ; variables fournies : aucune lecture', async () => {
    const { emitter, prisma } = makeEmitter();
    prisma.customer.findFirst.mockResolvedValue({ customerType: 'INDIVIDUAL', firstName: 'Jean', lastName: 'Mbarga' });
    prisma.garage.findUnique.mockResolvedValue({ name: 'Garage du Centre' });

    await emitter.emit({ ...INPUT, variables: { plate: 'LT 123 AB' } });
    expect(prisma.customerNotification.create.mock.calls[0][0].data.variables).toMatchObject({
      customerName: 'Jean Mbarga',
      garageName: 'Garage du Centre',
    });

    prisma.customer.findFirst.mockClear();
    await emitter.emit(INPUT);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('événement désactivé : aucune lecture des variables', async () => {
    const { emitter, prisma } = makeEmitter({ enabled: false });
    await emitter.emit({ ...INPUT, variables: { plate: 'LT 123 AB' } });
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('emitInBackground : émet le résultat du builder, ne propage aucune erreur', async () => {
    const { emitter, prisma } = makeEmitter();
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    emitter.emitInBackground('test', async () => INPUT);
    await flush();
    expect(prisma.customerNotification.create).toHaveBeenCalledTimes(1);

    emitter.emitInBackground('rien', async () => null);
    emitter.emitInBackground('panne', async () => {
      throw new Error('lecture impossible');
    });
    await flush();
    expect(prisma.customerNotification.create).toHaveBeenCalledTimes(1);
  });
});

describe('CustomerNotificationSweeper', () => {
  it('réenfile les PENDING non pris en charge et classe les prises en charge expirées', async () => {
    const { emitter, prisma, queue } = makeEmitter();
    prisma.customerNotification.updateMany.mockResolvedValue({ count: 2 });
    prisma.customerNotification.findMany.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
    const sweeper = new CustomerNotificationSweeper(prisma as never, emitter);
    const now = new Date('2026-10-12T10:00:00Z');

    await expect(sweeper.sweep(now)).resolves.toEqual({ requeued: 2, unknownOutcome: 2 });

    expect(prisma.customerNotification.updateMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', dispatchStartedAt: { lt: new Date('2026-10-12T09:50:00Z') } },
      data: expect.objectContaining({ status: 'FAILED', lastErrorCode: 'UNKNOWN_OUTCOME' }),
    });
    expect(prisma.customerNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING', dispatchStartedAt: null, createdAt: { lt: new Date('2026-10-12T09:59:00Z') } },
      }),
    );
    expect(queue.add.mock.calls.map((call) => call[2].jobId)).toEqual(['cn_n1', 'cn_n2']);
  });

  it('convergé : rien à faire, aucune écriture de file', async () => {
    const { emitter, prisma, queue } = makeEmitter();
    const sweeper = new CustomerNotificationSweeper(prisma as never, emitter);
    await expect(sweeper.sweep()).resolves.toEqual({ requeued: 0, unknownOutcome: 0 });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
