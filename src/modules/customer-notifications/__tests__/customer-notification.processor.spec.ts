import { SubscriptionStatus } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import {
  PermanentMessagingError,
  TemporaryMessagingError,
  type SendWhatsAppTemplateRequest,
  type WhatsAppProvider,
} from '../../messaging';
import { CustomerNotificationProcessor, monthStartInDouala } from '../customer-notification.processor';
import { loadCustomerNotificationsConfig } from '../customer-notifications.config';

const PHONE = '+237690000001';

class FakeWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'fake-whatsapp';
  readonly sent: SendWhatsAppTemplateRequest[] = [];
  failWith: Error | null = null;
  constructor(readonly simulated = false) {}
  async sendWhatsAppMessage(): Promise<never> {
    throw new Error('non utilisé');
  }
  async sendTemplate(request: SendWhatsAppTemplateRequest) {
    if (this.failWith) throw this.failWith;
    this.sent.push(request);
    return { providerMessageId: 'wamid.1', status: 'QUEUED' as const };
  }
}

const ROW = {
  id: 'n1',
  garageId: 'g1',
  customerId: 'c1',
  eventType: 'VEHICLE_READY' as const,
  idempotencyKey: 'ot.ready:o1:v1',
  appointmentId: null,
  serviceOrderId: 'o1',
  quoteId: null,
  invoiceId: null,
  paymentId: null,
  variables: { customerName: 'Jean', plate: 'LT 123 AB', garageName: 'Garage Central' },
  garage: { tenantId: 't1' },
  customer: { lang: 'fr' },
};

function makeProcessor(
  options: {
    env?: Record<string, string | undefined>;
    simulated?: boolean;
    claimed?: number;
    plan?: string;
    status?: SubscriptionStatus;
    consent?: boolean;
    stale?: boolean;
  } = {},
) {
  const prisma = {
    customerNotification: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
      findUnique: jest.fn().mockResolvedValue({ status: 'ACCEPTED' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(ROW),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    customerChannelConsent: {
      findFirst: jest.fn().mockResolvedValue(options.consent === false ? null : { phoneE164: PHONE }),
    },
  };
  const subscriptions = {
    getSummary: jest.fn().mockResolvedValue({
      status: options.status ?? SubscriptionStatus.ACTIVE,
      plan: options.plan ?? 'pro',
    }),
  };
  const preferences = { isEnabled: jest.fn().mockResolvedValue(true) };
  const staleness = { isStale: jest.fn().mockResolvedValue(options.stale ?? false) };
  const provider = new FakeWhatsAppProvider(options.simulated ?? false);
  const senders = { resolve: jest.fn().mockResolvedValue({ provider, accountRef: 'platform' }) };
  const config = loadCustomerNotificationsConfig(
    options.env ?? {
      CUSTOMER_NOTIFICATIONS_MODE: 'live',
      WHATSAPP_PROVIDER: 'whatsapp-cloud',
      WHATSAPP_APPROVED_TEMPLATES: 'am_vehicle_ready_v1:fr',
      CUSTOMER_NOTIFICATIONS_MONTHLY_CAP: '300',
    },
  );
  const processor = new CustomerNotificationProcessor(
    prisma as never,
    subscriptions as never,
    preferences as never,
    staleness as never,
    senders as never,
    config,
  );
  return { processor, prisma, provider, subscriptions };
}

function job(extra: { attemptsMade?: number; attempts?: number } = {}) {
  return {
    id: 'cn_n1',
    data: { notificationId: 'n1' },
    attemptsMade: extra.attemptsMade ?? 0,
    opts: { attempts: extra.attempts ?? 3 },
  } as never;
}

const lastUpdateData = (prisma: ReturnType<typeof makeProcessor>['prisma']) =>
  prisma.customerNotification.update.mock.calls.at(-1)?.[0].data;

describe('CustomerNotificationProcessor', () => {
  it('envoie le modèle approuvé et passe en ACCEPTED (jamais « livré »)', async () => {
    const { processor, prisma, provider } = makeProcessor();

    await expect(processor.process(job())).resolves.toEqual({ outcome: 'ACCEPTED' });

    expect(provider.sent).toEqual([
      expect.objectContaining({
        to: PHONE,
        templateName: 'am_vehicle_ready_v1',
        language: 'fr',
        variables: ['Jean', 'LT 123 AB', 'Garage Central'],
        idempotencyKey: 'customer-notification:n1',
      }),
    ]);
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'ACCEPTED', providerMessageId: 'wamid.1' });
    expect(prisma.customerNotification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: expect.objectContaining({ channel: 'WHATSAPP', recipientE164: PHONE, provider: 'fake-whatsapp' }),
    });
  });

  it('prise en charge atomique : PENDING non réservé seulement', async () => {
    const { processor, prisma } = makeProcessor();
    await processor.process(job());
    expect(prisma.customerNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', status: 'PENDING', dispatchStartedAt: null },
      data: { dispatchStartedAt: expect.any(Date), attemptCount: { increment: 1 } },
    });
  });

  it('déjà traitée (autre worker ou rejeu) : aucun envoi', async () => {
    const { processor, provider } = makeProcessor({ claimed: 0 });
    await expect(processor.process(job())).resolves.toEqual({ outcome: 'ALREADY_HANDLED' });
    expect(provider.sent).toHaveLength(0);
  });

  it('fournisseur simulé → SIMULATED, jamais ACCEPTED', async () => {
    const { processor, prisma } = makeProcessor({ simulated: true });
    await expect(processor.process(job())).resolves.toEqual({ outcome: 'SIMULATED' });
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'SIMULATED' });
    expect(lastUpdateData(prisma)).not.toHaveProperty('acceptedAt');
  });

  it.each([
    ['MODE_OFF', { env: {} }],
    ['NOT_ENTITLED', { status: SubscriptionStatus.TRIAL }],
    ['NOT_ENTITLED', { plan: 'essential' }],
    ['STALE', { stale: true }],
    ['NO_CONSENT', { consent: false }],
  ])('règle non remplie → SKIPPED(%s), aucun envoi', async (reason, options) => {
    const { processor, prisma, provider } = makeProcessor(options);
    await expect(processor.process(job())).resolves.toEqual({ outcome: 'SKIPPED', reason });
    expect(provider.sent).toHaveLength(0);
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'SKIPPED', skipReason: reason });
  });

  it('refus définitif → FAILED, aucune relance', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failWith = new PermanentMessagingError('INVALID_RECIPIENT', 'numéro inconnu', 'fake-whatsapp');

    await expect(processor.process(job())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'FAILED', lastErrorCode: 'INVALID_RECIPIENT' });
  });

  it('panne temporaire → prise en charge libérée pour la relance BullMQ', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failWith = new TemporaryMessagingError('UNAVAILABLE', '503', 'fake-whatsapp');

    await expect(processor.process(job({ attemptsMade: 0 }))).rejects.toBe(provider.failWith);
    expect(lastUpdateData(prisma)).toEqual({ dispatchStartedAt: null, lastErrorCode: 'UNAVAILABLE' });
  });

  it('panne temporaire à la dernière tentative → FAILED', async () => {
    const { processor, prisma, provider } = makeProcessor();
    provider.failWith = new TemporaryMessagingError('TIMEOUT', 'délai', 'fake-whatsapp');

    await expect(processor.process(job({ attemptsMade: 2 }))).rejects.toBe(provider.failWith);
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'FAILED', lastErrorCode: 'TIMEOUT' });
  });

  it('variable manquante → FAILED définitif MISSING_VARIABLE', async () => {
    const { processor, prisma, provider } = makeProcessor();
    prisma.customerNotification.findUniqueOrThrow.mockResolvedValue({ ...ROW, variables: { customerName: 'Jean' } });

    await expect(processor.process(job())).rejects.toBeInstanceOf(UnrecoverableError);
    expect(provider.sent).toHaveLength(0);
    expect(lastUpdateData(prisma)).toMatchObject({ status: 'FAILED', lastErrorCode: 'MISSING_VARIABLE' });
  });

  it('plafond mensuel compté depuis le début du mois à Douala', async () => {
    const { processor, prisma } = makeProcessor();
    await processor.process(job());
    expect(prisma.customerNotification.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        garageId: 'g1',
        status: { in: ['ACCEPTED', 'SENT', 'DELIVERED', 'READ'] },
      }),
    });
  });
});

describe('monthStartInDouala', () => {
  it('31 octobre 23:30 UTC = 1er novembre 00:30 à Douala', () => {
    expect(monthStartInDouala(new Date('2026-10-31T23:30:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });

  it('milieu de mois', () => {
    expect(monthStartInDouala(new Date('2026-10-15T12:00:00Z')).toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });
});
