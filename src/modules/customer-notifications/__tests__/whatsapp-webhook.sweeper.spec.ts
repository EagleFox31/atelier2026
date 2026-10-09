import { StatusNotYetCorrelatedError } from '../whatsapp-status.service';
import { EVENT_RETENTION_MS, EVENT_SWEEP_GRACE_MS, WhatsAppWebhookSweeper } from '../whatsapp-webhook.sweeper';

const NOW = new Date('2026-10-09T12:00:00Z');

function setup(pendingIds: string[]) {
  const prisma = {
    whatsAppWebhookEvent: {
      findMany: jest.fn().mockResolvedValue(pendingIds.map((id) => ({ id }))),
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };
  const statuses = { apply: jest.fn() };
  return { prisma, statuses, sweeper: new WhatsAppWebhookSweeper(prisma as never, statuses as never) };
}

describe('WhatsAppWebhookSweeper', () => {
  it('reprend les accusés non traités après le délai de grâce, directement (sans la file)', async () => {
    const { prisma, statuses, sweeper } = setup(['ev1', 'ev2', 'ev3']);
    statuses.apply
      .mockResolvedValueOnce({ outcome: 'APPLIED', notificationId: 'n1' })
      .mockRejectedValueOnce(new StatusNotYetCorrelatedError('ev2'))
      .mockRejectedValueOnce(new Error('base indisponible'));

    expect(await sweeper.sweep(NOW)).toEqual({ processed: 1, waiting: 1, failed: 1, purged: 3 });
    expect(prisma.whatsAppWebhookEvent.findMany.mock.calls[0][0].where).toEqual({
      processedAt: null,
      receivedAt: { lt: new Date(NOW.getTime() - EVENT_SWEEP_GRACE_MS) },
    });
    expect(statuses.apply).toHaveBeenCalledWith('ev1', NOW);
  });

  it('purge seulement les accusés traités depuis plus de 30 jours (jamais un événement en attente)', async () => {
    const { prisma, sweeper } = setup([]);
    await sweeper.sweep(NOW);
    expect(prisma.whatsAppWebhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { processedAt: { lt: new Date(NOW.getTime() - EVENT_RETENTION_MS) } },
    });
  });
});
