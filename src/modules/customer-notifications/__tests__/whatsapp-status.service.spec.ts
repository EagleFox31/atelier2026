import type { WhatsAppProvider } from '../../messaging';
import { toEventRows, toOptOutRows } from '../whatsapp-webhook.service';
import { WhatsAppSenderResolver, PLATFORM_SENDER_REF } from '../whatsapp-sender.resolver';
import {
  CORRELATION_WINDOW_MS,
  META_FAILURE_MESSAGE,
  StatusNotYetCorrelatedError,
  WhatsAppStatusService,
} from '../whatsapp-status.service';

/**
 * Faux Prisma en mémoire : reproduit la sémantique des écritures conditionnelles
 * (`updateMany` + `where`) pour vérifier ordre, doublons et concurrence sans base.
 */
type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const c = condition as { in?: unknown[]; lt?: Date };
      if (c.in) return c.in.includes(row[key]);
      if (c.lt) return row[key] instanceof Date && (row[key] as Date) < c.lt;
    }
    return (row[key] ?? null) === condition;
  });
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function table(rows: Row[]) {
  return {
    rows,
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      await tick();
      return rows.find((r) => matches(r, where)) ?? null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      await tick();
      return rows.find((r) => matches(r, where)) ?? null;
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      await tick();
      return rows.filter((r) => matches(r, where));
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      await tick();
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('not found');
      for (const [key, value] of Object.entries(data)) {
        const inc = (value as { increment?: number })?.increment;
        row[key] = inc !== undefined ? Number(row[key] ?? 0) + inc : value;
      }
      return row;
    },
    // Lecture + écriture sans `await` intermédiaire : atomique comme un UPDATE … WHERE.
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      await tick();
      const hit = rows.filter((r) => matches(r, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      await tick();
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
}

const PLATFORM_PHONE_ID = '111111111111111';
const OTHER_PHONE_ID = '222222222222222';
const T0 = new Date('2026-10-09T10:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

function notification(overrides: Partial<Row> = {}): Row {
  return {
    id: 'n1',
    garageId: 'garage-A',
    status: 'ACCEPTED',
    provider: 'whatsapp-cloud',
    senderAccountRef: PLATFORM_PHONE_ID,
    providerMessageId: 'wamid.A',
    acceptedAt: T0,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function setup(notifications: Row[], platform: Partial<WhatsAppProvider> = { name: 'whatsapp-cloud', accountRef: PLATFORM_PHONE_ID }) {
  const prisma = { customerNotification: table(notifications), whatsAppWebhookEvent: table([]) };
  const senders = new WhatsAppSenderResolver(platform as WhatsAppProvider);
  const optOuts = { handle: jest.fn().mockResolvedValue('APPLIED') };
  const service = new WhatsAppStatusService(prisma as never, senders, optOuts as never);
  let seq = 0;

  /** Persiste un accusé comme le webhook (dédoublonnage compris) et renvoie son id. */
  function receive(status: 'sent' | 'delivered' | 'read' | 'failed', opts: { wamid?: string; phone?: string; second?: number; code?: number } = {}) {
    const [row] = toEventRows([
      {
        phoneNumberId: opts.phone ?? PLATFORM_PHONE_ID,
        messageId: opts.wamid ?? 'wamid.A',
        status,
        occurredAt: at(opts.second ?? 0),
        errorCode: opts.code ?? null,
      },
    ]);
    const existing = prisma.whatsAppWebhookEvent.rows.find((r) => r.dedupKey === row.dedupKey);
    if (existing) return existing.id;
    const id = `ev${++seq}`;
    prisma.whatsAppWebhookEvent.rows.push({ ...row, id, attempts: 0, outcome: null, notificationId: null, processedAt: null, receivedAt: T0 } as Row);
    return id;
  }

  /** Persiste un « STOP » entrant comme le webhook. */
  function receiveStop(wamid = 'wamid.IN') {
    const [row] = toOptOutRows([{ phoneNumberId: PLATFORM_PHONE_ID, messageId: wamid, fromE164: '+237690000001', occurredAt: T0 }]);
    const id = `ev${++seq}`;
    prisma.whatsAppWebhookEvent.rows.push({ ...row, id, attempts: 0, outcome: null, notificationId: null, processedAt: null, receivedAt: T0 } as Row);
    return id;
  }

  return { prisma, service, optOuts, receive, receiveStop, row: (id = 'n1') => notifications.find((n) => n.id === id)! };
}

const SOON = at(5);

describe('WhatsAppStatusService — « STOP » entrant', () => {
  it('délégué au désabonnement, puis numéro de l’expéditeur effacé ; rejoué = aucun nouveau traitement', async () => {
    const { prisma, service, optOuts, receiveStop } = setup([notification()]);
    const seen: unknown[] = [];
    optOuts.handle.mockImplementation(async (event: Row) => {
      seen.push(event.senderE164);
      return 'APPLIED';
    });
    const id = receiveStop();

    expect(await service.apply(id, SOON)).toEqual({ outcome: 'APPLIED', notificationId: null });
    expect(optOuts.handle).toHaveBeenCalledWith(expect.objectContaining({ id, kind: 'INBOUND' }));
    expect(seen).toEqual(['+237690000001']);
    expect(prisma.whatsAppWebhookEvent.rows[0]).toMatchObject({ outcome: 'APPLIED', processedAt: SOON, senderE164: null, attempts: 1 });

    expect(await service.apply(id, SOON)).toEqual({ outcome: 'ALREADY_PROCESSED' });
    expect(optOuts.handle).toHaveBeenCalledTimes(1);
  });

  it('échec du désabonnement : événement non traité (numéro gardé pour la relance)', async () => {
    const { prisma, service, optOuts, receiveStop } = setup([]);
    optOuts.handle.mockRejectedValueOnce(new Error('base indisponible'));
    const id = receiveStop();

    await expect(service.apply(id, SOON)).rejects.toThrow('base indisponible');
    expect(prisma.whatsAppWebhookEvent.rows[0]).toMatchObject({ processedAt: null, senderE164: '+237690000001' });
  });

  it('un accusé de statut ne passe jamais par le désabonnement', async () => {
    const { service, optOuts, receive } = setup([notification()]);
    await service.apply(receive('sent'), SOON);
    expect(optOuts.handle).not.toHaveBeenCalled();
  });
});

describe('WhatsAppStatusService — progression normale', () => {
  it('sent → delivered → read : statut et horodatages Meta', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('sent', { second: 1 }), SOON);
    await service.apply(receive('delivered', { second: 2 }), SOON);
    const result = await service.apply(receive('read', { second: 3 }), SOON);

    expect(result).toEqual({ outcome: 'APPLIED', notificationId: 'n1' });
    expect(row()).toMatchObject({ status: 'READ', sentAt: at(1), deliveredAt: at(2), readAt: at(3), acceptedAt: T0 });
  });
});

describe('WhatsAppStatusService — monotonie (désordre)', () => {
  it('read avant delivered : reste READ, deliveredAt complété, rien d’inventé', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('read', { second: 3 }), SOON);
    expect(row()).toMatchObject({ status: 'READ', readAt: at(3), deliveredAt: null, sentAt: null });

    await service.apply(receive('delivered', { second: 2 }), SOON);
    expect(row()).toMatchObject({ status: 'READ', deliveredAt: at(2) });
  });

  it('sent tardif : n’écrase ni READ ni DELIVERED', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('delivered', { second: 2 }), SOON);
    await service.apply(receive('read', { second: 3 }), SOON);
    await service.apply(receive('sent', { second: 1 }), SOON);
    expect(row()).toMatchObject({ status: 'READ', sentAt: at(1) });
  });

  it('échec Meta depuis ACCEPTED : FAILED, code Meta seul, message générique', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('failed', { second: 4, code: 131026 }), SOON);
    expect(row()).toMatchObject({
      status: 'FAILED',
      failedAt: at(4),
      lastErrorCode: 'META_131026',
      lastErrorMessage: META_FAILURE_MESSAGE,
    });
  });

  it('échec après remise confirmée : ignoré (NO_CHANGE)', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('delivered', { second: 2 }), SOON);
    expect(await service.apply(receive('failed', { second: 4, code: 131026 }), SOON)).toEqual({
      outcome: 'NO_CHANGE',
      notificationId: 'n1',
    });
    expect(row()).toMatchObject({ status: 'DELIVERED', failedAt: null, lastErrorCode: null });
  });

  it('FAILED n’est jamais écrasé ni horodaté par un accusé tardif', async () => {
    const { service, receive, row } = setup([notification()]);
    await service.apply(receive('failed', { second: 4 }), SOON);
    await service.apply(receive('delivered', { second: 5 }), SOON);
    await service.apply(receive('read', { second: 6 }), SOON);
    expect(row()).toMatchObject({ status: 'FAILED', lastErrorCode: 'META_FAILED', deliveredAt: null, readAt: null });
  });
});

describe('WhatsAppStatusService — idempotence et concurrence', () => {
  it('même accusé rejoué : une seule ligne, deuxième application sans effet', async () => {
    const { service, receive, prisma, row } = setup([notification()]);
    const first = receive('delivered', { second: 2 });
    expect(receive('delivered', { second: 2 })).toBe(first);
    expect(prisma.whatsAppWebhookEvent.rows).toHaveLength(1);

    await service.apply(first, SOON);
    expect(await service.apply(first, SOON)).toEqual({ outcome: 'ALREADY_PROCESSED' });
    expect(row()).toMatchObject({ status: 'DELIVERED', deliveredAt: at(2) });
  });

  it('accusés traités en parallèle, dans le désordre : convergence vers READ', async () => {
    const { service, receive, row } = setup([notification()]);
    const ids = [receive('read', { second: 3 }), receive('sent', { second: 1 }), receive('delivered', { second: 2 })];
    await Promise.all([...ids, ...ids].map((id) => service.apply(id, SOON)));
    expect(row()).toMatchObject({ status: 'READ', sentAt: at(1), deliveredAt: at(2), readAt: at(3) });
  });
});

describe('WhatsAppStatusService — rattachement', () => {
  it('accusé arrivé avant l’enregistrement du wamid : réessayé, puis appliqué', async () => {
    const pending = notification({ providerMessageId: null, status: 'PENDING', acceptedAt: null });
    const { service, receive, row, prisma } = setup([pending]);
    const id = receive('sent', { second: 1 });

    await expect(service.apply(id, SOON)).rejects.toBeInstanceOf(StatusNotYetCorrelatedError);
    expect(prisma.whatsAppWebhookEvent.rows[0]).toMatchObject({ processedAt: null, attempts: 1 });

    Object.assign(row(), { providerMessageId: 'wamid.A', status: 'ACCEPTED', acceptedAt: T0 });
    expect(await service.apply(id, SOON)).toEqual({ outcome: 'APPLIED', notificationId: 'n1' });
    expect(row()).toMatchObject({ status: 'SENT', sentAt: at(1) });
  });

  it('wamid inconnu après la fenêtre de rattachement : UNMATCHED, aucune écriture', async () => {
    const { service, receive, row } = setup([notification()]);
    const id = receive('delivered', { wamid: 'wamid.INCONNU' });
    const late = new Date(T0.getTime() + CORRELATION_WINDOW_MS + 1);
    expect(await service.apply(id, late)).toEqual({ outcome: 'UNMATCHED', notificationId: null });
    expect(row()).toMatchObject({ status: 'ACCEPTED', deliveredAt: null });
  });

  it('même wamid annoncé par un autre compte émetteur : jamais appliqué (isolation)', async () => {
    const { service, receive, row } = setup([notification()]);
    const id = receive('read', { phone: OTHER_PHONE_ID });
    await expect(service.apply(id, SOON)).rejects.toBeInstanceOf(StatusNotYetCorrelatedError);
    expect(row()).toMatchObject({ status: 'ACCEPTED', readAt: null });
  });

  it('seul le compte émetteur choisit la ligne : garage d’un autre compte intact', async () => {
    const mine = notification({ id: 'n-A', garageId: 'garage-A' });
    const theirs = notification({ id: 'n-B', garageId: 'garage-B', senderAccountRef: OTHER_PHONE_ID, providerMessageId: 'wamid.B' });
    const { service, receive, row } = setup([mine, theirs]);
    // Même wamid, mais annoncé par le numéro de la plateforme : la ligne de l'autre compte ne bouge pas.
    await expect(service.apply(receive('read', { wamid: 'wamid.B' }), SOON)).rejects.toBeInstanceOf(StatusNotYetCorrelatedError);
    expect(row('n-B')).toMatchObject({ status: 'ACCEPTED', readAt: null });
  });

  it('lignes historiques « platform » : rattachées seulement si le numéro est celui de la plateforme', async () => {
    const legacy = notification({ senderAccountRef: PLATFORM_SENDER_REF });
    const { service, receive, row } = setup([legacy]);
    await service.apply(receive('delivered', { second: 2 }), SOON);
    expect(row()).toMatchObject({ status: 'DELIVERED' });

    const other = setup([notification({ senderAccountRef: PLATFORM_SENDER_REF })]);
    await expect(other.service.apply(other.receive('delivered', { phone: OTHER_PHONE_ID }), SOON)).rejects.toBeInstanceOf(
      StatusNotYetCorrelatedError,
    );
  });

  it('notification simulée (sans wamid) : jamais touchée', async () => {
    const simulated = notification({ status: 'SIMULATED', provider: 'simulator', providerMessageId: null });
    const { service, receive, row } = setup([simulated]);
    const late = new Date(T0.getTime() + CORRELATION_WINDOW_MS + 1);
    expect((await service.apply(receive('read'), late)).outcome).toBe('UNMATCHED');
    expect(row()).toMatchObject({ status: 'SIMULATED', readAt: null });
  });

  it('accusé sans statut exploitable : IGNORED', async () => {
    const { service, prisma } = setup([notification()]);
    prisma.whatsAppWebhookEvent.rows.push({ id: 'st1', kind: 'STATUS', status: null, processedAt: null, receivedAt: T0 } as Row);
    expect(await service.apply('st1', SOON)).toEqual({ outcome: 'IGNORED', notificationId: null });
  });
});

describe('WhatsAppSenderResolver — compte émetteur', () => {
  it('fournisseur Meta : référence = phone_number_id ; simulateur : platform', async () => {
    const cloud = new WhatsAppSenderResolver({ name: 'whatsapp-cloud', accountRef: PLATFORM_PHONE_ID } as WhatsAppProvider);
    const simulator = new WhatsAppSenderResolver({ name: 'simulator' } as WhatsAppProvider);
    expect((await cloud.resolve('g')).accountRef).toBe(PLATFORM_PHONE_ID);
    expect((await simulator.resolve('g')).accountRef).toBe(PLATFORM_SENDER_REF);
  });

  it('« platform » accepté seulement pour le numéro et le fournisseur de la plateforme', () => {
    const cloud = new WhatsAppSenderResolver({ name: 'whatsapp-cloud', accountRef: PLATFORM_PHONE_ID } as WhatsAppProvider);
    expect(cloud.accountRefsFor('whatsapp-cloud', PLATFORM_PHONE_ID)).toEqual([PLATFORM_PHONE_ID, PLATFORM_SENDER_REF]);
    expect(cloud.accountRefsFor('whatsapp-cloud', OTHER_PHONE_ID)).toEqual([OTHER_PHONE_ID]);
    expect(new WhatsAppSenderResolver({ name: 'simulator' } as WhatsAppProvider).accountRefsFor('whatsapp-cloud', PLATFORM_PHONE_ID)).toEqual([
      PLATFORM_PHONE_ID,
    ]);
  });
});

describe('toEventRows', () => {
  it('dédoublonne dans un même appel et ne garde ni numéro ni texte', () => {
    const event = { phoneNumberId: PLATFORM_PHONE_ID, messageId: 'wamid.A', status: 'failed' as const, occurredAt: T0, errorCode: 131026 };
    const rows = toEventRows([event, event, { ...event, status: 'sent' as const, errorCode: null }]);
    expect(rows.map((r) => r.dedupKey)).toEqual([
      `status:${PLATFORM_PHONE_ID}:wamid.A:failed`,
      `status:${PLATFORM_PHONE_ID}:wamid.A:sent`,
    ]);
    expect(rows[0]).toMatchObject({ kind: 'STATUS', provider: 'whatsapp-cloud', status: 'FAILED', errorCode: '131026' });
  });
});
