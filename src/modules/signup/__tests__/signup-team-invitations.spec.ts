import { SignupService } from '../signup.service';
import { issueInvitation } from '../../../shared/security/invitation-token';
import type { SignupDto } from '../dto/signup.dto';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

function makeDeps() {
  let n = 0;
  const tx = {
    tenant: { create: jest.fn().mockResolvedValue({ id: 't-1' }) },
    garage: { create: jest.fn().mockResolvedValue({ id: 'g-1' }) },
    user: {
      create: jest.fn(async ({ data }: any) => ({ id: `u-${++n}`, tokenVersion: 0, ...data })),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userRole: { create: jest.fn() },
    role: { findUnique: jest.fn(async ({ where }: any) => ({ id: `role-${where.code}` })) },
    workshopSettings: { upsert: jest.fn() },
  };
  const prisma = {
    ...tx,
    user: { ...tx.user, findFirst: jest.fn().mockResolvedValue(null) },
    tenant: { ...tx.tenant, findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt') };
  const secrets = { getSigningSecret: () => 's', getExpiresIn: () => '1d' };
  const welcome = { sendWelcome: jest.fn().mockResolvedValue('sent') };
  const invitations = {
    issue: jest.fn(() => issueInvitation()),
    deliver: jest.fn().mockResolvedValue('sent'),
  };
  const service = new SignupService(prisma as any, jwt as any, secrets as any, welcome as any, invitations as any);
  return { service, tx, invitations };
}

const dto = {
  admin: { firstName: 'Jennifer', lastName: 'Admin', email: 'admin@garage.cm', password: 'Atelier2026!' },
  workshop: { shopName: 'Garage Akwa', address: 'Akwa', phone: '690000000', email: 'garage@garage.cm' },
  team: [
    { roleCode: 'TECHNICIEN', firstName: 'Marie', lastName: 'Nkolo', email: 'Marie@Garage.cm' },
    { roleCode: 'CAISSIER', firstName: 'Paul', lastName: 'Caisse' },
  ],
} as unknown as SignupDto;

describe('Inscription — membres d’équipe (#15)', () => {
  it('avec e-mail : invitation envoyée après commit ; sans e-mail : mot de passe temporaire', async () => {
    const { service, tx, invitations } = makeDeps();

    const { teamCreated } = await service.register(dto);

    const created = tx.user.create.mock.calls.map((c: any) => c[0].data);
    const marie = created.find((d: any) => d.firstName === 'Marie');
    const paul = created.find((d: any) => d.firstName === 'Paul');

    expect(marie).toMatchObject({ email: 'marie@garage.cm', mustChangePassword: false, inviteTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(paul).toMatchObject({ email: null, mustChangePassword: true });
    expect(paul).not.toHaveProperty('inviteTokenHash');

    const marieResult = teamCreated.find((m) => m.firstName === 'Marie')!;
    const paulResult = teamCreated.find((m) => m.firstName === 'Paul')!;
    expect(marieResult).not.toHaveProperty('tempPassword');
    expect(marieResult.invitation).toMatchObject({ status: 'pending', email: 'marie@garage.cm', emailStatus: 'sent' });
    expect(paulResult.tempPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    expect(paulResult).not.toHaveProperty('invitation');

    expect(invitations.deliver).toHaveBeenCalledTimes(1);
    expect(invitations.deliver.mock.calls[0][0]).toMatchObject({
      email: 'marie@garage.cm', workshopName: 'Garage Akwa', invitedByName: 'Jennifer Admin', roleCode: 'TECHNICIEN',
    });
    // Le jeton brut ne figure jamais dans la réponse de l'API.
    expect(JSON.stringify(teamCreated)).not.toContain(invitations.deliver.mock.calls[0][1].token);
  });
});
