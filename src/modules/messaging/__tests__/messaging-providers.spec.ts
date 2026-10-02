import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MessagingConfigurationError,
  createSmsProvider,
  createWhatsAppProvider,
} from '../messaging.config';
import {
  PermanentMessagingError,
  TemporaryMessagingError,
  isPermanentMessagingError,
} from '../messaging.errors';
import { MessagingModule } from '../messaging.module';
import { SMS_PROVIDER, WHATSAPP_PROVIDER } from '../messaging.tokens';
import { SimulatorSmsProvider } from '../sms/simulator-sms.provider';
import { SimulatorWhatsAppProvider } from '../whatsapp/simulator-whatsapp.provider';
import { FakeSmsProvider } from '../testing/fake-sms.provider';

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe('Sélection du fournisseur par configuration', () => {
  it('par défaut (variable absente ou vide) : simulateur', () => {
    expect(createSmsProvider(env({}))).toBeInstanceOf(SimulatorSmsProvider);
    expect(createSmsProvider(env({ SMS_PROVIDER: '  ' }))).toBeInstanceOf(SimulatorSmsProvider);
    expect(createWhatsAppProvider(env({}))).toBeInstanceOf(SimulatorWhatsAppProvider);
  });

  it('insensible à la casse et aux espaces', () => {
    expect(createSmsProvider(env({ SMS_PROVIDER: ' Simulator ' }))).toBeInstanceOf(SimulatorSmsProvider);
  });

  it('valeur inconnue : erreur explicite au démarrage (pas de repli silencieux)', () => {
    expect(() => createSmsProvider(env({ SMS_PROVIDER: 'techsoft' }))).toThrow(MessagingConfigurationError);
    expect(() => createSmsProvider(env({ SMS_PROVIDER: 'techsoft' }))).toThrow(/Valeurs acceptées : simulator/);
    expect(() => createWhatsAppProvider(env({ WHATSAPP_PROVIDER: 'meta' }))).toThrow(/WHATSAPP_PROVIDER="meta"/);
  });

  it('ne se laisse pas tromper par une clé héritée de Object.prototype', () => {
    expect(() => createSmsProvider(env({ SMS_PROVIDER: 'constructor' }))).toThrow(MessagingConfigurationError);
  });

  it('simulateur en production : avertissement journalisé', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    createSmsProvider(env({ NODE_ENV: 'production' }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aucun message réel'));
    warn.mockRestore();
  });
});

describe('MessagingModule — injection Nest', () => {
  const original = process.env.SMS_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = original;
  });

  it('expose SMS_PROVIDER et WHATSAPP_PROVIDER (simulateurs par défaut)', async () => {
    delete process.env.SMS_PROVIDER;
    const moduleRef = await Test.createTestingModule({ imports: [MessagingModule] }).compile();
    expect(moduleRef.get(SMS_PROVIDER)).toBeInstanceOf(SimulatorSmsProvider);
    expect(moduleRef.get(WHATSAPP_PROVIDER)).toBeInstanceOf(SimulatorWhatsAppProvider);
  });

  it('refuse de démarrer avec un fournisseur inconnu', async () => {
    process.env.SMS_PROVIDER = 'inconnu';
    await expect(Test.createTestingModule({ imports: [MessagingModule] }).compile()).rejects.toThrow(
      MessagingConfigurationError,
    );
  });
});

describe('SimulatorSmsProvider', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('renvoie un identifiant déterministe dérivé de la clé d’idempotence', async () => {
    const provider = new SimulatorSmsProvider();
    const a = await provider.sendSms({ to: '+237699000001', text: 'Bonjour', idempotencyKey: 'k1' });
    const b = await provider.sendSms({ to: '+237699000001', text: 'Bonjour', idempotencyKey: 'k1' });
    const c = await provider.sendSms({ to: '+237699000001', text: 'Bonjour', idempotencyKey: 'k2' });

    expect(a).toEqual({ providerMessageId: expect.stringMatching(/^sim-[0-9a-f]{24}$/), status: 'SENT', operator: 'ORANGE_CM' });
    expect(b.providerMessageId).toBe(a.providerMessageId);
    expect(c.providerMessageId).not.toBe(a.providerMessageId);
  });

  it('journalise sans le corps du message et avec un numéro masqué', async () => {
    await new SimulatorSmsProvider().sendSms({
      to: '+237699123456',
      text: 'Code secret 4242',
      idempotencyKey: 'k1',
    });

    const lines = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(lines).toContain('+2376******56');
    expect(lines).not.toContain('699123456');
    expect(lines).not.toContain('Code secret 4242');
  });

  it('numéro invalide ou expéditeur refusé : erreur PERMANENTE', async () => {
    const provider = new SimulatorSmsProvider();
    await expect(provider.sendSms({ to: '12', text: 'x', idempotencyKey: 'k' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENT',
      permanent: true,
    });
    await expect(
      provider.sendSms({ to: '+237699000001', text: 'x', senderId: 'NomBeaucoupTropLong', idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ code: 'SENDER_REJECTED' });
  });

  it('statut de remise, solde et validation d’expéditeur', async () => {
    const provider = new SimulatorSmsProvider();
    const { providerMessageId } = await provider.sendSms({ to: '699000001', text: 'x', idempotencyKey: 'k' });

    await expect(provider.getDeliveryStatus(providerMessageId)).resolves.toEqual({ status: 'DELIVERED' });
    await expect(provider.getDeliveryStatus('autre-ref')).resolves.toEqual({ status: 'UNKNOWN' });
    await expect(provider.getBalance()).resolves.toEqual({ smsCredits: null });
    await expect(provider.validateSender('AtelierMtr')).resolves.toEqual({ valid: true });
    await expect(provider.validateSender('Atelier-Maitre')).resolves.toMatchObject({ valid: false });
  });
});

describe('SimulatorWhatsAppProvider', () => {
  it('message libre et modèle : identifiant déterministe, numéro validé', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const provider = new SimulatorWhatsAppProvider();

    const msg = await provider.sendWhatsAppMessage({ to: '699000001', text: 'Bonjour', idempotencyKey: 'w1' });
    const tpl = await provider.sendTemplate({
      to: '+237699000001',
      templateName: 'vehicle_ready',
      language: 'fr',
      variables: ['Paul'],
      idempotencyKey: 'w1',
    });

    expect(msg).toEqual({ providerMessageId: expect.stringMatching(/^sim-wa-/), status: 'SENT' });
    expect(tpl.providerMessageId).toBe(msg.providerMessageId);
    await expect(provider.sendTemplate({
      to: 'abc', templateName: 't', language: 'fr', variables: [], idempotencyKey: 'w2',
    })).rejects.toBeInstanceOf(PermanentMessagingError);
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).not.toContain('Bonjour');
    log.mockRestore();
  });
});

describe('Modèle d’erreur', () => {
  it('distingue définitif et temporaire', () => {
    const permanent = new PermanentMessagingError('INSUFFICIENT_CREDIT', 'Solde épuisé.', 'x');
    const temporary = new TemporaryMessagingError('RATE_LIMITED', 'Trop de requêtes.', 'x', 30_000);

    expect(isPermanentMessagingError(permanent)).toBe(true);
    expect(isPermanentMessagingError(temporary)).toBe(false);
    expect(isPermanentMessagingError(new Error('autre'))).toBe(false);
    expect(permanent.name).toBe('PermanentMessagingError');
    expect(temporary.retryAfterMs).toBe(30_000);
  });

  it('FakeSmsProvider rejoue les résultats programmés dans l’ordre', async () => {
    const fake = new FakeSmsProvider().next({ kind: 'temporary', code: 'TIMEOUT' });
    await expect(fake.sendSms({ to: '+237699000001', text: 'x', idempotencyKey: 'k' })).rejects.toBeInstanceOf(
      TemporaryMessagingError,
    );
    await expect(fake.sendSms({ to: '+237699000001', text: 'x', idempotencyKey: 'k' })).resolves.toMatchObject({
      status: 'SENT',
    });
    expect(fake.sent).toHaveLength(2);
  });
});
