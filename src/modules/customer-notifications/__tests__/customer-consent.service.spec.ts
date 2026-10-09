import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerConsentService } from '../customer-consent.service';
import { WHATSAPP_CONSENT_TEXT } from '../consent-text';

type Current = { status: 'GRANTED' | 'REVOKED'; phoneE164: string } | null;

function makeService(options: { customer?: boolean; current?: Current; phonePrimary?: string } = {}) {
  const customer = options.customer === false
    ? null
    : {
        phonePrimary: options.phonePrimary ?? '699 00 00 00',
        channelConsents: options.current ? [options.current] : [],
      };
  const prisma = {
    customer: { findFirst: jest.fn().mockResolvedValue(customer) },
    customerChannelConsent: {
      upsert: jest.fn().mockResolvedValue({ status: 'GRANTED' }),
      findUnique: jest.fn().mockResolvedValue({ status: options.current?.status }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { service: new CustomerConsentService(prisma as never), prisma };
}

describe('CustomerConsentService.record', () => {
  it('accord : normalise le numéro principal en E.164 et écrit état + preuve en une requête', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.record('c1', 'WHATSAPP', { status: 'GRANTED', source: 'IN_PERSON' }, 'g1', 'u1'),
    ).resolves.toMatchObject({ changed: true });

    const call = prisma.customerChannelConsent.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ customerId_channel: { customerId: 'c1', channel: 'WHATSAPP' } });
    expect(call.create).toMatchObject({ garageId: 'g1', customerId: 'c1', status: 'GRANTED', phoneE164: '+237699000000' });
    expect(call.create.events.create).toMatchObject({
      action: 'GRANTED',
      phoneE164: '+237699000000',
      source: 'IN_PERSON',
      consentTextVersion: WHATSAPP_CONSENT_TEXT.version,
      recordedById: 'u1',
    });
    expect(call.update.revokedAt).toBeNull();
  });

  it('second appel identique : aucune écriture (idempotent)', async () => {
    const { service, prisma } = makeService({ current: { status: 'GRANTED', phoneE164: '+237699000000' } });

    await expect(
      service.record('c1', 'WHATSAPP', { status: 'GRANTED', source: 'IN_PERSON' }, 'g1', 'u1'),
    ).resolves.toMatchObject({ changed: false });
    expect(prisma.customerChannelConsent.upsert).not.toHaveBeenCalled();
  });

  it('changement de numéro : nouvel événement de preuve', async () => {
    const { service, prisma } = makeService({ current: { status: 'GRANTED', phoneE164: '+237699000000' } });

    await service.record('c1', 'WHATSAPP', { status: 'GRANTED', source: 'PHONE_CALL', phone: '677 11 22 33' }, 'g1', 'u1');
    expect(prisma.customerChannelConsent.upsert.mock.calls[0][0].update).toMatchObject({ phoneE164: '+237677112233' });
  });

  it('retrait sans numéro : garde le numéro du consentement, pose revokedAt', async () => {
    const { service, prisma } = makeService({
      current: { status: 'GRANTED', phoneE164: '+237677112233' },
      phonePrimary: '699 00 00 00',
    });

    await service.record('c1', 'WHATSAPP', { status: 'REVOKED', source: 'CUSTOMER_MESSAGE' }, 'g1', 'u1');
    const { update } = prisma.customerChannelConsent.upsert.mock.calls[0][0];
    expect(update).toMatchObject({ status: 'REVOKED', phoneE164: '+237677112233' });
    expect(update.revokedAt).toBeInstanceOf(Date);
    expect(update).not.toHaveProperty('grantedAt');
  });

  it('numéro inexploitable : 400 CONSENT_PHONE_INVALID, rien n’est écrit', async () => {
    const { service, prisma } = makeService({ phonePrimary: '12' });

    await expect(
      service.record('c1', 'WHATSAPP', { status: 'GRANTED', source: 'IN_PERSON' }, 'g1', 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customerChannelConsent.upsert).not.toHaveBeenCalled();
  });

  it('client d’un autre garage : 404 (pas 403)', async () => {
    const { service, prisma } = makeService({ customer: false });

    await expect(
      service.record('c1', 'WHATSAPP', { status: 'GRANTED', source: 'IN_PERSON' }, 'g2', 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', garageId: 'g2', deletedAt: null } }),
    );
  });
});
