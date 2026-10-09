import { ForbiddenException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { FakeSmsProvider } from '../../modules/messaging/testing/fake-sms.provider';
import { SimulatorSmsProvider } from '../../modules/messaging/sms/simulator-sms.provider';
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
  const provider = new FakeSmsProvider();
  const processor = new SmsProcessor(prisma as never, subscriptions as never, provider);
  return { processor, prisma, subscriptions, provider };
}

function job(
  data: Partial<SmsJobData>,
  name = 'reminder_j7',
  extra: { id?: string; attemptsMade?: number; attempts?: number } = {},
) {
  return {
    id: extra.id ?? 'job-1',
    queueName: 'sms-notifications',
    name,
    attemptsMade: extra.attemptsMade ?? 0,
    opts: { attempts: extra.attempts ?? 1 },
    data: { phone: '+237690000001', message: 'Bonjour', ...data },
  } as never;
}

describe('SmsProcessor — droit SMS et relances', () => {
  it('envoie, journalise et marque la relance J+7 APRÈS l’envoi réussi', async () => {
    const { processor, prisma, provider } = makeProcessor();

    await expect(
      processor.process(job({ tenantId: 't1', garageId: 'g1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).resolves.toEqual({ sent: true });

    expect(provider.sent).toHaveLength(1);
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
    const { processor, prisma, subscriptions, provider } = makeProcessor();
    subscriptions.assertSmsEntitled.mockRejectedValue(new ForbiddenException({ errorCode: 'SMS_SUBSCRIPTION_REQUIRED' }));

    await expect(
      processor.process(job({ tenantId: 't1', notificationId: 'n1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(provider.sent).toHaveLength(0);
    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', errorMessage: expect.stringContaining('Pro ou Business') },
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('panne temporaire (abonnement illisible) : erreur relancée pour que BullMQ réessaie', async () => {
    const { processor, prisma, subscriptions, provider } = makeProcessor();
    subscriptions.assertSmsEntitled.mockRejectedValue(new Error('connexion DB perdue'));

    const result = processor.process(job({ tenantId: 't1', notificationId: 'n1' }));

    await expect(result).rejects.toThrow('connexion DB perdue');
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(provider.sent).toHaveLength(0);
    expect(prisma.sMSNotification.update).not.toHaveBeenCalled();
  });

  it('refus par défaut : aucun tenant identifiable → échec définitif sans envoi', async () => {
    const { processor, subscriptions, provider, prisma } = makeProcessor();
    prisma.garage.findUnique.mockResolvedValue(null);

    await expect(processor.process(job({}))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(subscriptions.assertSmsEntitled).not.toHaveBeenCalled();
    expect(provider.sent).toHaveLength(0);
  });

  it('ancien job sans tenantId : tenant retrouvé via le garage', async () => {
    const { processor, subscriptions } = makeProcessor();

    await processor.process(job({ garageId: 'g1' }));

    expect(subscriptions.assertSmsEntitled).toHaveBeenCalledWith('tenant-from-garage');
  });
});

describe('SmsProcessor — fournisseur injecté (SMS_PROVIDER)', () => {
  it('succès : stocke gatewayRef et opérateur renvoyés par le fournisseur', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.always({ kind: 'success', result: { providerMessageId: 'prov-42', operator: 'MTN_CM' } });

    await processor.process(job({ tenantId: 't1', notificationId: 'n1', serviceOrderId: 'so-1' }));

    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({
        gatewayRef: 'prov-42',
        operator: 'MTN_CM',
        status: 'SENT',
        serviceOrderId: 'so-1',
      }),
    });
  });

  it('normalise le numéro en E.164 avant l’envoi et déduit l’opérateur si le fournisseur ne le donne pas', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.always({ kind: 'success', result: { operator: undefined } });

    await processor.process(job({ tenantId: 't1', garageId: 'g1', phone: '699 00 00 01' }));

    expect(provider.sent[0].to).toBe('+237699000001');
    expect(prisma.sMSNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ operator: 'ORANGE_CM', phoneTo: '699 00 00 01', garageId: 'g1' }),
    });
  });

  it('statut DELIVERED immédiat : deliveredAt renseigné', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.always({ kind: 'success', result: { status: 'DELIVERED' } });

    await processor.process(job({ tenantId: 't1', notificationId: 'n1' }));

    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ status: 'DELIVERED', deliveredAt: expect.any(Date) }),
    });
  });

  it('clé d’idempotence : id de notification, sinon id du job', async () => {
    const { processor, provider } = makeProcessor();

    await processor.process(job({ tenantId: 't1', notificationId: 'n1' }));
    await processor.process(job({ tenantId: 't1' }, 'reminder_j7', { id: 'invoice-reminder-j7_inv-1' }));

    expect(provider.sent.map((r) => r.idempotencyKey)).toEqual([
      'sms-notification:n1',
      'sms-job:sms-notifications:invoice-reminder-j7_inv-1',
    ]);
  });

  it('même job rejoué : même clé d’idempotence', async () => {
    const { processor, provider } = makeProcessor();
    provider.next({ kind: 'temporary', code: 'TIMEOUT' });

    const data = { tenantId: 't1' };
    await expect(processor.process(job(data, 'vehicle_ready', { id: '17', attempts: 3 }))).rejects.toThrow();
    await processor.process(job(data, 'vehicle_ready', { id: '17', attempts: 3, attemptsMade: 1 }));

    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0].idempotencyKey).toBe(provider.sent[1].idempotencyKey);
  });

  it('échec définitif du fournisseur : UnrecoverableError, FAILED avec le code, relance non marquée', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failPermanently('INSUFFICIENT_CREDIT');

    await expect(
      processor.process(job({ tenantId: 't1', notificationId: 'n1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', errorMessage: expect.stringContaining('INSUFFICIENT_CREDIT') },
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('échec temporaire (tentatives restantes) : erreur relancée, notification et relance intactes', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failTemporarily('UNAVAILABLE');

    const result = processor.process(
      job({ tenantId: 't1', notificationId: 'n1', invoiceId: 'inv-1', invoiceReminder: 1 }, 'reminder_j7', { attempts: 3 }),
    );

    await expect(result).rejects.toThrow('UNAVAILABLE');
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(prisma.sMSNotification.update).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('échec temporaire à la dernière tentative : erreur relancée et notification FAILED', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failTemporarily('TIMEOUT');

    const result = processor.process(
      job({ tenantId: 't1', notificationId: 'n1' }, 'reminder_j7', { attempts: 3, attemptsMade: 2 }),
    );

    await expect(result).rejects.toThrow('TIMEOUT');
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', errorMessage: expect.stringContaining('TIMEOUT'), retryCount: 2 },
    });
  });

  it('erreur non typée du fournisseur : traitée comme temporaire (retry)', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.always({ kind: 'error', error: new Error('socket hang up') });

    const result = processor.process(
      job({ tenantId: 't1', invoiceId: 'inv-1', invoiceReminder: 1 }, 'reminder_j7', { attempts: 3 }),
    );

    await expect(result).rejects.toThrow('socket hang up');
    await expect(result).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('numéro inexploitable : échec définitif sans appel au fournisseur', async () => {
    const { processor, prisma, provider } = makeProcessor();

    await expect(
      processor.process(job({ tenantId: 't1', notificationId: 'n1', phone: '12' })),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(provider.sent).toHaveLength(0);
    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'FAILED', errorMessage: expect.stringContaining('numéro') },
    });
  });
});

describe('SmsProcessor — fournisseur simulé', () => {
  it('enregistre SIMULATED (jamais SENT ni DELIVERED) et marque quand même la relance', async () => {
    const { prisma, subscriptions } = makeProcessor();
    const processor = new SmsProcessor(prisma as never, subscriptions as never, new SimulatorSmsProvider());

    await expect(
      processor.process(job({ tenantId: 't1', garageId: 'g1', invoiceId: 'inv-1', invoiceReminder: 1 })),
    ).resolves.toEqual({ sent: false, simulated: true });

    const { data } = prisma.sMSNotification.create.mock.calls[0][0];
    expect(data.status).toBe('SIMULATED');
    expect(data).not.toHaveProperty('deliveredAt');
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { reminder1SentAt: expect.any(Date) },
    });
  });

  it('met à jour une notification existante en SIMULATED', async () => {
    const { prisma, subscriptions } = makeProcessor();
    const processor = new SmsProcessor(prisma as never, subscriptions as never, new SimulatorSmsProvider());

    await processor.process(job({ tenantId: 't1', notificationId: 'n-1' }));

    expect(prisma.sMSNotification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: expect.objectContaining({ status: 'SIMULATED' }),
    });
  });
});
