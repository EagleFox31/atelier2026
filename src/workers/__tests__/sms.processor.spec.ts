import { ForbiddenException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { SmsProcessor, type SmsJobData } from '../sms.processor';

function makeProcessor() {
  const prisma = {
    sMSNotification: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    invoice: { update: jest.fn().mockResolvedValue({}) },
    garage: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-from-garage' }) },
    serviceOrder: { findUnique: jest.fn().mockResolvedValue(null) },
    customer: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const subscriptions = { assertSmsEntitled: jest.fn().mockResolvedValue(undefined) };
  const processor = new SmsProcessor(prisma as never, subscriptions as never);
  const gateway = jest.spyOn(processor as any, 'mockSmsGateway').mockResolvedValue(true);
  return { processor, prisma, subscriptions, gateway };
}

function job(data: Partial<SmsJobData>, name = 'reminder_j7') {
  return { name, data: { phone: '+237690000001', message: 'Bonjour', ...data } } as never;
}

describe('SmsProcessor — droit SMS et relances', () => {
  it('envoie, journalise et marque la relance J+7 APRÈS l’envoi réussi', async () => {
    const { processor, prisma, gateway } = makeProcessor();

    await expect(
      processor.process(job({ tenantId: 't1', garageId: 'g1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).resolves.toEqual({ sent: true });

    expect(gateway).toHaveBeenCalled();
    expect(prisma.sMSNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ garageId: 'g1', status: 'SENT', templateCode: 'reminder_j7' }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { reminder1SentAt: expect.any(Date) },
    });
  });

  it('marque reminder2SentAt pour la relance J+15', async () => {
    const { processor, prisma } = makeProcessor();

    await processor.process(job({ tenantId: 't1', invoiceId: 'inv-2', invoiceReminder: 2 }, 'reminder_j15'));

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-2' },
      data: { reminder2SentAt: expect.any(Date) },
    });
  });

  it('refus commercial : échec définitif (pas de retry), SMS marqué FAILED, relance non marquée', async () => {
    const { processor, prisma, subscriptions, gateway } = makeProcessor();
    subscriptions.assertSmsEntitled.mockRejectedValue(new ForbiddenException({ errorCode: 'SMS_SUBSCRIPTION_REQUIRED' }));

    await expect(
      processor.process(job({ tenantId: 't1', notificationId: 'n1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(gateway).not.toHaveBeenCalled();
    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', errorMessage: expect.stringContaining('Pro ou Business') },
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('panne temporaire (abonnement illisible) : erreur relancée pour que BullMQ réessaie', async () => {
    const { processor, prisma, subscriptions, gateway } = makeProcessor();
    subscriptions.assertSmsEntitled.mockRejectedValue(new Error('connexion DB perdue'));

    const result = processor.process(job({ tenantId: 't1', notificationId: 'n1' }));

    await expect(result).rejects.toThrow('connexion DB perdue');
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(gateway).not.toHaveBeenCalled();
    expect(prisma.sMSNotification.update).not.toHaveBeenCalled();
  });

  it('échec de la passerelle : erreur relancée (retry) et relance non marquée', async () => {
    const { processor, prisma, gateway } = makeProcessor();
    gateway.mockResolvedValue(false);

    await expect(
      processor.process(job({ tenantId: 't1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).rejects.toThrow('Gateway timeout');

    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('refus par défaut : aucun tenant identifiable → échec définitif sans envoi', async () => {
    const { processor, subscriptions, gateway, prisma } = makeProcessor();
    prisma.garage.findUnique.mockResolvedValue(null);

    await expect(processor.process(job({}))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(subscriptions.assertSmsEntitled).not.toHaveBeenCalled();
    expect(gateway).not.toHaveBeenCalled();
  });

  it('ancien job sans tenantId : tenant retrouvé via le garage', async () => {
    const { processor, subscriptions } = makeProcessor();

    await processor.process(job({ garageId: 'g1' }));

    expect(subscriptions.assertSmsEntitled).toHaveBeenCalledWith('tenant-from-garage');
  });
});
