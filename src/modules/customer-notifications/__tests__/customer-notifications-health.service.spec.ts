import { CustomerNotificationsHealthService, OUTBOX_BACKLOG_MS } from '../customer-notifications-health.service';
import { loadCustomerNotificationsConfig } from '../customer-notifications.config';

const NOW = new Date('2026-10-15T10:00:00.000Z');

type GroupRow = Record<string, unknown> & { _count: { _all: number } };

function makeService(
  options: {
    env?: Record<string, string | undefined>;
    queue?: 'ok' | 'down' | 'hang';
    byStatus?: GroupRow[];
    skipped?: GroupRow[];
    failed?: GroupRow[];
    backlog?: number;
    usage?: GroupRow[];
  } = {},
) {
  const groupBy = jest.fn().mockImplementation(({ by }: { by: string[] }) => {
    if (by[0] === 'status') return Promise.resolve(options.byStatus ?? []);
    if (by[0] === 'skipReason') return Promise.resolve(options.skipped ?? []);
    if (by[0] === 'lastErrorCode') return Promise.resolve(options.failed ?? []);
    return Promise.resolve(options.usage ?? []);
  });
  const prisma = {
    customerNotification: {
      groupBy,
      count: jest.fn().mockResolvedValue(options.backlog ?? 0),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    garage: {
      findMany: jest.fn().mockResolvedValue([{ id: 'g1', name: 'Garage Central' }]),
    },
  };
  const queue = {
    getJobCounts: jest.fn().mockImplementation(() => {
      if (options.queue === 'down') return Promise.reject(new Error('ECONNREFUSED'));
      if (options.queue === 'hang') return new Promise(() => undefined);
      return Promise.resolve({ waiting: 2, active: 1, delayed: 0, failed: 3 });
    }),
  };
  const config = loadCustomerNotificationsConfig(options.env ?? {});
  const whatsapp = { name: 'simulator', simulated: true };
  const service = new CustomerNotificationsHealthService(prisma as never, queue as never, config, whatsapp as never);
  return { service, prisma, queue };
}

const LIVE_ENV = {
  CUSTOMER_NOTIFICATIONS_MODE: 'live',
  WHATSAPP_PROVIDER: 'whatsapp-cloud',
  WHATSAPP_APPROVED_TEMPLATES: 'am_vehicle_ready_v1:fr',
  CUSTOMER_NOTIFICATIONS_MONTHLY_CAP: '100',
};

describe('CustomerNotificationsHealthService', () => {
  it('mode off, file joignable, outbox vide : ok, sans alerte', async () => {
    const { service } = makeService();
    const health = await service.getHealth(NOW);

    expect(health.status).toBe('ok');
    expect(health.alerts).toEqual([]);
    expect(health.config).toEqual({
      mode: 'off',
      whatsappProvider: 'simulator',
      providerSimulated: true,
      monthlyCap: 300,
      sandboxRecipientCount: 0,
    });
    expect(health.queue).toEqual({ available: true, waiting: 2, active: 1, delayed: 0, failed: 3 });
    expect(health.templates).toHaveLength(8);
  });

  it("n'écrit jamais en base", async () => {
    const { service, prisma } = makeService({ env: LIVE_ENV });
    await service.getHealth(NOW);
    expect(prisma.customerNotification.update).not.toHaveBeenCalled();
    expect(prisma.customerNotification.updateMany).not.toHaveBeenCalled();
  });

  it('ne renvoie aucun numéro de test, seulement leur nombre', async () => {
    const { service } = makeService({
      env: { CUSTOMER_NOTIFICATIONS_MODE: 'sandbox', WHATSAPP_TEST_RECIPIENTS: '+237690000001,+237690000002' },
    });
    const health = await service.getHealth(NOW);
    expect(health.config.sandboxRecipientCount).toBe(2);
    expect(JSON.stringify(health)).not.toContain('690000001');
  });

  it('Redis injoignable : file indisponible et statut critique, sans exception', async () => {
    const { service } = makeService({ queue: 'down' });
    const health = await service.getHealth(NOW);
    expect(health.queue).toEqual({ available: false });
    expect(health.status).toBe('critical');
    expect(health.alerts.map((a) => a.code)).toContain('QUEUE_UNAVAILABLE');
  });

  it('Redis qui ne répond pas : abandon après le délai', async () => {
    jest.useFakeTimers();
    try {
      const { service } = makeService({ queue: 'hang' });
      const pending = service.getHealth(NOW);
      await jest.advanceTimersByTimeAsync(2_000);
      const health = await pending;
      expect(health.queue).toEqual({ available: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it('PENDING trop vieux : alerte OUTBOX_BACKLOG critique, même en mode off', async () => {
    const { service, prisma } = makeService({ backlog: 4 });
    const health = await service.getHealth(NOW);

    expect(health.status).toBe('critical');
    expect(health.alerts.map((a) => a.code)).toEqual(['OUTBOX_BACKLOG']);
    const where = prisma.customerNotification.count.mock.calls[0][0].where;
    expect(where).toEqual({ status: 'PENDING', createdAt: { lt: new Date(NOW.getTime() - OUTBOX_BACKLOG_MS) } });
  });

  it('mode live : modèles actifs non approuvés, échecs récents et garage proche du plafond', async () => {
    const { service } = makeService({
      env: LIVE_ENV,
      byStatus: [{ status: 'ACCEPTED', _count: { _all: 12 } }, { status: 'FAILED', _count: { _all: 3 } }],
      skipped: [{ skipReason: 'NO_CONSENT', _count: { _all: 1 } }, { skipReason: 'STALE', _count: { _all: 5 } }],
      failed: [{ lastErrorCode: 'UNKNOWN_OUTCOME', _count: { _all: 1 } }, { lastErrorCode: null, _count: { _all: 2 } }],
      usage: [{ garageId: 'g1', _count: { _all: 85 } }],
    });
    const health = await service.getHealth(NOW);

    expect(health.status).toBe('warning');
    expect(health.alerts.map((a) => a.code)).toEqual(['TEMPLATES_NOT_APPROVED', 'RECENT_FAILURES', 'QUOTA_NEAR_LIMIT']);
    const notApproved = health.alerts[0].message;
    expect(notApproved).toContain('am_appointment_confirmed_v1');
    expect(notApproved).not.toContain('am_vehicle_ready_v1');
    expect(notApproved).not.toContain('am_service_order_received_v1');
    expect(health.templates.find((t) => t.eventType === 'VEHICLE_READY')?.approved).toBe(true);
    expect(health.outbox.byStatus).toEqual({ ACCEPTED: 12, FAILED: 3 });
    expect(health.outbox.skippedByReason).toEqual([{ reason: 'STALE', count: 5 }, { reason: 'NO_CONSENT', count: 1 }]);
    expect(health.outbox.failedByCode).toEqual([{ code: 'UNKNOWN', count: 2 }, { code: 'UNKNOWN_OUTCOME', count: 1 }]);
    expect(health.quota.garages).toEqual([{ garageId: 'g1', garageName: 'Garage Central', used: 85, ratio: 0.85 }]);
  });

  it('mode sandbox sans destinataire autorisé : alerte', async () => {
    const { service } = makeService({ env: { CUSTOMER_NOTIFICATIONS_MODE: 'sandbox' } });
    const health = await service.getHealth(NOW);
    expect(health.alerts.map((a) => a.code)).toContain('SANDBOX_NO_RECIPIENTS');
  });

  it('plafond mensuel compté depuis le 1er du mois à Douala, statuts facturables seulement', async () => {
    const { service, prisma } = makeService();
    const health = await service.getHealth(NOW);
    const usageCall = prisma.customerNotification.groupBy.mock.calls.find(([args]) => args.by[0] === 'garageId')[0];

    expect(health.quota.monthStart).toBe('2026-09-30T23:00:00.000Z');
    expect(usageCall.where.status).toEqual({ in: ['ACCEPTED', 'SENT', 'DELIVERED', 'READ'] });
    expect(prisma.garage.findMany).not.toHaveBeenCalled();
  });
});
