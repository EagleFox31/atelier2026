import { GoneException, NotFoundException } from '@nestjs/common';
import { GarageContactService } from '../garage-contact.service';
import { generateOpaqueToken, hashOpaqueToken } from '../../../shared/security/opaque-token';
import { issueGarageContactToken } from '../../../shared/garage/garage-contact-token';

const token = generateOpaqueToken();
const now = new Date('2026-10-28T13:00:00Z');
const garageA = {
  id: 'garage-a', name: 'Garage Akwa', status: 'active', phone: '+237 690 00 00 01',
  address: 'Rue des Manguiers', city: 'Douala',
};
function makePrisma(record: unknown) {
  return {
    garageContactLink: {
      findUnique: jest.fn().mockResolvedValue(record),
      updateMany: jest.fn().mockReturnValue({ kind: 'revoke' }),
      create: jest.fn().mockReturnValue({ kind: 'create' }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}
describe('Public garage contact links', () => {
  it('generates an opaque token with no plaintext in DB and revokes prior notification links', async () => {
    const p = makePrisma(null);
    const raw = await issueGarageContactToken(p as never, {
      garageId: 'garage-a', notificationId: 'notification-a', now,
    });
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const create = p.garageContactLink.create.mock.calls[0][0];
    expect(create.data).toMatchObject({
      garageId: 'garage-a', notificationId: 'notification-a',
      tokenHash: hashOpaqueToken(raw),
      expiresAt: new Date('2026-11-27T13:00:00Z'),
    });
    expect(JSON.stringify(create)).not.toContain(raw);
    expect(p.garageContactLink.updateMany).toHaveBeenCalledWith({
      where: { notificationId: 'notification-a', revokedAt: null },
      data: { revokedAt: now },
    });
    expect(p.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns only the garage assigned to the opaque token, without invoice or customer data', async () => {
    const p = makePrisma({
      garageId: 'garage-a', notificationId: 'notification-a',
      revokedAt: null, expiresAt: new Date('2026-11-01T00:00:00Z'),
      garage: garageA,
    });
    const data = await new GarageContactService(p as never).describe(token, now);
    expect(data).toEqual({
      garageName: 'Garage Akwa', city: 'Douala', address: 'Rue des Manguiers',
      phone: '+237 690 00 00 01', dialNumber: '+237690000001',
    });
    expect(JSON.stringify(data)).not.toMatch(/invoice|customer|notification|garage-a/i);
    expect(p.garageContactLink.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { garage: { select: {
        name: true, phone: true, city: true, address: true, status: true,
      } } },
    });
  });

  it.each(['invalid', 'https://evil.example', '../escape', 'a'.repeat(256)])(
    'rejects malformed links without querying DB (%s)', async (invalid) => {
      const p = makePrisma(null);
      await expect(new GarageContactService(p as never).describe(invalid, now))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(p.garageContactLink.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown, inactive, malformed phones and expiry without leaking data', async () => {
    for(const access of [
      null,
      { expiresAt: new Date('2026-11-01'), revokedAt: null, garage: {...garageA, status:'suspended'} },
      { expiresAt: new Date('2026-11-01'), revokedAt: null, garage: {...garageA, phone:'not a phone'} },
    ]) {
      const p = makePrisma(access);
      await expect(new GarageContactService(p as never).describe(token, now))
        .rejects.toBeInstanceOf(NotFoundException);
    }
    for(const access of [
      { expiresAt: now, revokedAt: null, garage: garageA },
      { expiresAt: new Date('2026-11-01'), revokedAt: now, garage: garageA },
    ]) {
      const p = makePrisma(access);
      await expect(new GarageContactService(p as never).describe(token, now))
        .rejects.toBeInstanceOf(GoneException);
    }
  });
});
