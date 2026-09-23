import { ForbiddenException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };

  const subscriptions = {
    getSummary: jest.fn(),
  };

  const guard = new SubscriptionGuard(reflector as never, subscriptions as never);

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  function context(
    method: string,
    path = '/api/workshop/ot',
    roles: string[] = ['ADMIN'],
  ) {
    const request = {
      method,
      path,
      user: {
        tenantId: 'tenant-1',
        roles: roles.map((code) => ({ role: { code } })),
      },
    };

    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;
  }

  it('allows writes during the trial', async () => {
    subscriptions.getSummary.mockResolvedValue({
      status: SubscriptionStatus.TRIAL,
    });

    await expect(guard.canActivate(context('POST'))).resolves.toBe(true);
  });

  it('allows reads but blocks writes during grace period', async () => {
    subscriptions.getSummary.mockResolvedValue({
      status: SubscriptionStatus.GRACE_PERIOD,
    });

    await expect(guard.canActivate(context('GET'))).resolves.toBe(true);
    await expect(guard.canActivate(context('POST'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks business reads after the grace period', async () => {
    subscriptions.getSummary.mockResolvedValue({
      status: SubscriptionStatus.EXPIRED,
    });

    await expect(guard.canActivate(context('GET'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('always allows the subscription status endpoint', async () => {
    subscriptions.getSummary.mockResolvedValue({
      status: SubscriptionStatus.EXPIRED,
    });

    await expect(
      guard.canActivate(context('GET', '/api/subscription/status')),
    ).resolves.toBe(true);
    expect(subscriptions.getSummary).not.toHaveBeenCalled();
  });

  it('bypasses subscription checks for SUPER_ADMIN', async () => {
    await expect(
      guard.canActivate(context('POST', '/api/workshop/ot', ['SUPER_ADMIN'])),
    ).resolves.toBe(true);
    expect(subscriptions.getSummary).not.toHaveBeenCalled();
  });
});
