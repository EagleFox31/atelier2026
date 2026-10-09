import { NotFoundException } from '@nestjs/common';
import type { WhatsAppProvider } from '../../messaging';
import { MAX_OPT_OUT_CUSTOMERS, OPT_OUT_NOTE_PREFIX, WhatsAppOptOutService } from '../whatsapp-opt-out.service';
import { WhatsAppSenderResolver } from '../whatsapp-sender.resolver';

const PHONE_ID = '111111111111111';
const SENDER = '+237690000001';

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev1',
    kind: 'INBOUND',
    provider: 'whatsapp-cloud',
    phoneNumberId: PHONE_ID,
    providerMessageId: 'wamid.IN',
    senderE164: SENDER,
    ...overrides,
  } as never;
}

function setup(options: { contacted?: { garageId: string; customerId: string }[]; granted?: { garageId: string; customerId: string }[] } = {}) {
  const prisma = {
    customerNotification: { findMany: jest.fn().mockResolvedValue(options.contacted ?? []) },
    customerChannelConsent: { findMany: jest.fn().mockResolvedValue(options.granted ?? []) },
  };
  const consents = { record: jest.fn().mockResolvedValue({ changed: true }) };
  const senders = new WhatsAppSenderResolver({ name: 'whatsapp-cloud', accountRef: PHONE_ID } as WhatsAppProvider);
  const service = new WhatsAppOptOutService(prisma as never, senders, consents as never);
  return { prisma, consents, service };
}

describe('WhatsAppOptOutService', () => {
  it('retire le consentement des clients contactés depuis ce compte à ce numéro, avec preuve et sans auteur', async () => {
    const pairs = [{ garageId: 'garage-A', customerId: 'c1' }, { garageId: 'garage-B', customerId: 'c2' }];
    const { prisma, consents, service } = setup({ contacted: pairs, granted: pairs });

    expect(await service.handle(event())).toBe('APPLIED');

    expect(prisma.customerNotification.findMany).toHaveBeenCalledWith({
      where: {
        provider: 'whatsapp-cloud',
        senderAccountRef: { in: [PHONE_ID, 'platform'] },
        recipientE164: SENDER,
        providerMessageId: { not: null },
        customerId: { not: null },
      },
      select: { garageId: true, customerId: true },
      distinct: ['garageId', 'customerId'],
      take: MAX_OPT_OUT_CUSTOMERS,
    });
    expect(prisma.customerChannelConsent.findMany.mock.calls[0][0].where).toEqual({
      channel: 'WHATSAPP',
      status: 'GRANTED',
      phoneE164: SENDER,
      OR: pairs,
    });
    expect(consents.record).toHaveBeenCalledTimes(2);
    expect(consents.record).toHaveBeenCalledWith(
      'c1',
      'WHATSAPP',
      { status: 'REVOKED', source: 'CUSTOMER_MESSAGE', phone: SENDER, note: `${OPT_OUT_NOTE_PREFIX} (wamid.IN).` },
      'garage-A',
      null,
    );
  });

  it('numéro jamais contacté depuis ce compte : UNMATCHED, aucun consentement lu ni touché', async () => {
    const { prisma, consents, service } = setup();
    expect(await service.handle(event())).toBe('UNMATCHED');
    expect(prisma.customerChannelConsent.findMany).not.toHaveBeenCalled();
    expect(consents.record).not.toHaveBeenCalled();
  });

  it('autre compte émetteur : seul ce compte est cherché (pas la plateforme)', async () => {
    const { prisma, service } = setup();
    await service.handle(event({ phoneNumberId: '999999999999999' }));
    expect(prisma.customerNotification.findMany.mock.calls[0][0].where.senderAccountRef).toEqual({ in: ['999999999999999'] });
  });

  it('client contacté mais consentement déjà retiré ou autre numéro : NO_CHANGE', async () => {
    const { consents, service } = setup({ contacted: [{ garageId: 'garage-A', customerId: 'c1' }] });
    expect(await service.handle(event())).toBe('NO_CHANGE');
    expect(consents.record).not.toHaveBeenCalled();
  });

  it('rejoué : consentement déjà retiré par le premier passage → NO_CHANGE', async () => {
    const pair = { garageId: 'garage-A', customerId: 'c1' };
    const { consents, service } = setup({ contacted: [pair], granted: [pair] });
    consents.record.mockResolvedValue({ changed: false });
    expect(await service.handle(event())).toBe('NO_CHANGE');
  });

  it('client supprimé entre-temps : ignoré ; autre erreur : remontée (relance)', async () => {
    const pair = { garageId: 'garage-A', customerId: 'c1' };
    const { consents, service } = setup({ contacted: [pair], granted: [pair] });
    consents.record.mockRejectedValueOnce(new NotFoundException('Client introuvable'));
    expect(await service.handle(event())).toBe('NO_CHANGE');

    consents.record.mockRejectedValueOnce(new Error('base indisponible'));
    await expect(service.handle(event())).rejects.toThrow('base indisponible');
  });

  it('numéro déjà effacé : IGNORED sans requête', async () => {
    const { prisma, service } = setup();
    expect(await service.handle(event({ senderE164: null }))).toBe('IGNORED');
    expect(prisma.customerNotification.findMany).not.toHaveBeenCalled();
  });
});
