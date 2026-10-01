import { SubscriptionStatus, UserStatus } from '@prisma/client';
import { AdminService } from '../admin.service';

type TenantRow = {
  id: string;
  status: string;
  subscriptionStatus: SubscriptionStatus;
  statusBeforeSuspension: SubscriptionStatus | null;
  trialEndsAt: Date | null;
};

describe('AdminService.toggleTenantStatus', () => {
  function setup(row: TenantRow, reconciledStatus?: SubscriptionStatus) {
    const tenantUpdate = jest.fn().mockImplementation(async ({ data }: { data: Partial<TenantRow> }) => ({
      ...row,
      ...data,
    }));
    const userUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
        update: tenantUpdate,
      },
      user: { updateMany: userUpdateMany },
      $transaction: jest.fn().mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const subscriptions = {
      reconcileTenant: jest.fn().mockImplementation(async () => ({
        subscriptionStatus: reconciledStatus ?? tenantUpdate.mock.calls.at(-1)?.[0].data.subscriptionStatus,
      })),
    };
    const service = new AdminService(prisma as never, subscriptions as never);
    return { service, prisma, subscriptions, tenantUpdate, userUpdateMany };
  }

  const trialEnds = new Date('2026-10-31T08:00:00.000Z');

  it('suspend : passe le tenant en SUSPENDED en mémorisant son statut, sans toucher aux utilisateurs', async () => {
    const { service, tenantUpdate, userUpdateMany, subscriptions } = setup({
      id: 't1',
      status: 'active',
      subscriptionStatus: SubscriptionStatus.TRIAL,
      statusBeforeSuspension: null,
      trialEndsAt: trialEnds,
    });

    const result = await service.toggleTenantStatus('t1');

    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        statusBeforeSuspension: SubscriptionStatus.TRIAL,
        status: 'suspended',
      },
    });
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(subscriptions.reconcileTenant).not.toHaveBeenCalled();
    expect(result).toEqual({ tenantId: 't1', status: 'suspended', subscriptionStatus: SubscriptionStatus.SUSPENDED });
  });

  it('réactive : restaure le statut mémorisé et laisse suspendus les comptes suspendus par l’ADMIN', async () => {
    const { service, tenantUpdate, userUpdateMany, prisma } = setup({
      id: 't1',
      status: 'suspended',
      subscriptionStatus: SubscriptionStatus.SUSPENDED,
      statusBeforeSuspension: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
    });

    const result = await service.toggleTenantStatus('t1');

    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { subscriptionStatus: SubscriptionStatus.ACTIVE, statusBeforeSuspension: null, status: 'active' },
    });
    // Aucun utilisateur n'est réactivé : un compte suspendu individuellement reste suspendu.
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({ tenantId: 't1', status: 'active', subscriptionStatus: SubscriptionStatus.ACTIVE });
  });

  it('réactive : recalcule le pilote s’il s’est terminé pendant la suspension', async () => {
    const { service, subscriptions } = setup(
      {
        id: 't1',
        status: 'suspended',
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        statusBeforeSuspension: SubscriptionStatus.TRIAL,
        trialEndsAt: trialEnds,
      },
      SubscriptionStatus.GRACE_PERIOD,
    );

    const result = await service.toggleTenantStatus('t1');

    expect(subscriptions.reconcileTenant).toHaveBeenCalledWith('t1');
    expect(result.subscriptionStatus).toBe(SubscriptionStatus.GRACE_PERIOD);
  });

  it.each([
    ['avec pilote', trialEnds, SubscriptionStatus.TRIAL],
    ['sans pilote', null, SubscriptionStatus.ACTIVE],
  ])('réactive sans statut mémorisé (%s) : repli sur %s', async (_label, trialEndsAt, expected) => {
    const { service, tenantUpdate } = setup({
      id: 't1',
      status: 'suspended',
      subscriptionStatus: SubscriptionStatus.SUSPENDED,
      statusBeforeSuspension: null,
      trialEndsAt,
    });

    await service.toggleTenantStatus('t1');

    expect(tenantUpdate.mock.calls[0][0].data.subscriptionStatus).toBe(expected);
  });

  it('réactive une suspension héritée (ancien mécanisme) : débloque une dernière fois les utilisateurs', async () => {
    const { service, prisma, userUpdateMany, tenantUpdate } = setup({
      id: 't1',
      status: 'suspended',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      statusBeforeSuspension: null,
      trialEndsAt: null,
    });

    const result = await service.toggleTenantStatus('t1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tenantUpdate.mock.calls[0][0].data).toEqual({
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      statusBeforeSuspension: null,
      status: 'active',
    });
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', deletedAt: null, status: UserStatus.SUSPENDED },
      data: { status: UserStatus.ACTIVE },
    });
    expect(result.status).toBe('active');
  });
});
