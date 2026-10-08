import { createSmsProvider } from '../messaging.config';
import { SmsToSmsProvider } from '../sms/smsto-sms.provider';

const KEY = 'sk_test_secret_value';

function provider(response: { status: number; body?: unknown } | Error) {
  const fetchImpl = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return {
      status: response.status,
      json: async () => response.body ?? {},
    } as unknown as Response;
  });
  const smsto = new SmsToSmsProvider({
    apiKey: KEY,
    senderId: 'AtelierMtr',
    apiUrl: 'https://api.sms.to',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { smsto, fetchImpl };
}

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

const request = { to: '699123456', text: 'Code secret 4242', idempotencyKey: 'k1' };

describe('SmsToSmsProvider', () => {
  it('envoie au format attendu (Bearer, E.164, sender_id) et renvoie message_id', async () => {
    const { smsto, fetchImpl } = provider({ status: 200, body: { success: true, message_id: 'abc-123' } });

    await expect(smsto.sendSms(request)).resolves.toEqual({
      providerMessageId: 'abc-123',
      status: 'QUEUED',
      operator: 'ORANGE_CM',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sms.to/sms/send');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'Code secret 4242',
      to: '+237699123456',
      sender_id: 'AtelierMtr',
    });
  });

  it('numéro ou expéditeur invalides : refus définitif sans appel réseau', async () => {
    const { smsto, fetchImpl } = provider({ status: 200 });
    await expect(smsto.sendSms({ ...request, to: '12' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENT',
      permanent: true,
    });
    await expect(smsto.sendSms({ ...request, senderId: 'Nom-Beaucoup-Trop-Long' })).rejects.toMatchObject({
      code: 'SENDER_REJECTED',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, {}, 'PROVIDER_CONFIGURATION', true],
    [403, {}, 'PROVIDER_CONFIGURATION', true],
    [402, {}, 'INSUFFICIENT_CREDIT', true],
    [422, { message: 'Insufficient balance' }, 'INSUFFICIENT_CREDIT', true],
    [422, { errors: { sender_id: ['invalid'] } }, 'SENDER_REJECTED', true],
    [422, { errors: { to: ['invalid'] } }, 'INVALID_RECIPIENT', true],
    [422, { message: 'unknown' }, 'CONTENT_REJECTED', true],
    [429, {}, 'RATE_LIMITED', false],
    [503, {}, 'UNAVAILABLE', false],
  ])('HTTP %i %j → %s (définitif : %s)', async (status, body, code, permanent) => {
    const { smsto } = provider({ status, body });
    await expect(smsto.sendSms(request)).rejects.toMatchObject({ code, permanent });
  });

  it('succès 2xx sans message_id : erreur temporaire (pas de faux succès)', async () => {
    const { smsto } = provider({ status: 200, body: { success: true } });
    await expect(smsto.sendSms(request)).rejects.toMatchObject({ code: 'UNAVAILABLE', permanent: false });
  });

  it('panne réseau et délai dépassé : erreurs temporaires', async () => {
    await expect(provider(new Error('ECONNRESET')).smsto.sendSms(request)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      permanent: false,
    });
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(provider(abort).smsto.sendSms(request)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('les erreurs ne divulguent ni la clé, ni le texte, ni le numéro complet', async () => {
    const { smsto } = provider({ status: 422, body: { message: `bad ${KEY} Code secret 4242 699123456` } });
    const error = await smsto.sendSms(request).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).not.toContain('4242');
    expect((error as Error).message).not.toContain('699123456');
  });

  it('statut de remise inconnu et validation d’expéditeur', async () => {
    const { smsto } = provider({ status: 200 });
    await expect(smsto.getDeliveryStatus()).resolves.toEqual({ status: 'UNKNOWN' });
    await expect(smsto.validateSender('AtelierMtr')).resolves.toEqual({ valid: true });
    await expect(smsto.validateSender('Atelier-Maitre')).resolves.toMatchObject({ valid: false });
  });
});

describe('Configuration SMS_PROVIDER=smsto', () => {
  it('sélectionne l’adaptateur avec la clé et un expéditeur par défaut', () => {
    const p = createSmsProvider(env({ SMS_PROVIDER: 'smsto', SMSTO_API_KEY: KEY }));
    expect(p).toBeInstanceOf(SmsToSmsProvider);
    expect(p.name).toBe('smsto');
  });

  it('clé absente : l’API refuse de démarrer, sans citer de secret', () => {
    expect(() => createSmsProvider(env({ SMS_PROVIDER: 'smsto' }))).toThrow(/SMSTO_API_KEY/);
  });

  it('expéditeur invalide : refus au démarrage', () => {
    expect(() =>
      createSmsProvider(env({ SMS_PROVIDER: 'smsto', SMSTO_API_KEY: KEY, SMSTO_SENDER_ID: 'Atelier-Maitre' })),
    ).toThrow(/SMSTO_SENDER_ID/);
  });
});
