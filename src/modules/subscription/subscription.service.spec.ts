import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionService } from './subscription.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SubscriptionService', () => {
  function setup(now: Date, row: Record<string, unknown>) {
    const prisma = {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...row,
          ...data,
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const clock = { now: jest.fn().mockReturnValue(now) };
    const service = new SubscriptionService(prisma as never, clock as never);
    return { service, prisma, clock };
  }

  const started = new Date('2026-09-01T08:00:00.000Z');
  const ends = new Date(started.getTime() + 30 * DAY_MS);
  const graceEnds = new Date(ends.getTime() + 7 * DAY_MS);
  const retentionEnds = new Date(ends.getTime() + 90 * DAY_MS);

  const baseRow = {
    id: 'tenant-1',
    plan: 'pro',
    subscriptionStatus: SubscriptionStatus.TRIAL,
    trialStartedAt: started,
    trialEndsAt: ends,
    graceEndsAt,
    subscriptionStartedAt: null,
    subscriptionEndsAt: null,
    dataRetentionEndsAt: retentionEnds,
  };

  it('keeps a tenant in TRIAL before day 30', async () => {
    const now = new Date(ends.getTime() - DAY_MS);
    const { service, prisma } = setup(now, baseRow);

    const result = await service.getSummary('tenant-1');

    expect(result.status).toBe(SubscriptionStatus.TRIAL);
    expect(result.daysRemaining).toBe(1);
    expect(result.readOnly).toBe(false);
    expect(result.blocked).toBe(false);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('moves to GRACE_PERIOD at the end of the 30-day pilot', async () => {
    const now = new Date(ends.getTime() + 60_000);
    const { service, prisma } = setup(now, baseRow);

    const result = await service.getSummary('tenant-1');

    expect(result.status).toBe(SubscriptionStatus.GRACE_PERIOD);
    expect(result.readOnly).toBe(true);
    expect(result.blocked).toBe(false);
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionStatus: SubscriptionStatus.GRACE_PERIOD },
      }),
    );
  });

  it('moves to EXPIRED after the seven-day grace period', async () => {
    const row = {
      ...baseRow,
      subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
    };
    const now = new Date(graceEnds.getTime() + 1);
    const { service } = setup(now, row);

    const result = await service.getSummary('tenant-1');

    expect(result.status).toBe(SubscriptionStatus.EXPIRED);
    expect(result.blocked).toBe(true);
  });

  it('does not downgrade an ACTIVE tenant', async () => {
    const row = {
      ...baseRow,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartedAt: new Date('2026-09-15T08:00:00.000Z'),
    };
    const now = new Date('2027-01-01T08:00:00.000Z');
    const { service, prisma } = setup(now, row);

    const result = await service.getSummary('tenant-1');

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.blocked).toBe(false);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('keeps legacy tenants without trial dates ACTIVE', async () => {
    const row = {
      ...baseRow,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialStartedAt: null,
      trialEndsAt: null,
      graceEndsAt: null,
    };
    const { service } = setup(new Date('2026-09-23T08:00:00.000Z'), row);

    const result = await service.getSummary('tenant-1');

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
