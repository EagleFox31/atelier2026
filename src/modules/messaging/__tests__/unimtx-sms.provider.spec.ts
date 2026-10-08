import { createSmsProvider } from '../messaging.config';
import { UnimtxSmsProvider } from '../sms/unimtx-sms.provider';

const KEY = 'ak_test_access_key_id';

function provider(response: { status: number; body?: unknown } | Error) {
  const fetchImpl = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return {
      status: response.status,
      json: async () => response.body ?? {},
    } as unknown as Response;
  });
  const unimtx = new UnimtxSmsProvider({
    accessKeyId: KEY,
    senderId: 'AtelierM',
    apiUrl: 'https://api.unimtx.com',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { unimtx, fetchImpl };
}

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

const request = { to: '699123456', text: 'Code secret 4242', idempotencyKey: 'k1' };

describe('UnimtxSmsProvider', () => {
  it('envoie en POST action-based (accessKeyId en URL, signature) et renvoie l’id', async () => {
    const { unimtx, fetchImpl } = provider({
      status: 200,
      body: { code: '0', data: { messages: [{ id: 'msg-123', to: '+237699123456', parts: 1 }] } },
    });

    await expect(unimtx.sendSms(request)).resolves.toEqual({
      providerMessageId: 'msg-123',
      status: 'QUEUED',
      operator: 'ORANGE_CM',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.unimtx.com/?action=sms.message.send&accessKeyId=${KEY}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      to: '+237699123456',
      text: 'Code secret 4242',
      signature: 'AtelierM',
    });
  });

  it('numéro ou expéditeur invalides : refus définitif sans appel réseau', async () => {
    const { unimtx, fetchImpl } = provider({ status: 200 });
    await expect(unimtx.sendSms({ ...request, to: '12' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENT',
      permanent: true,
    });
    await expect(unimtx.sendSms({ ...request, senderId: 'X' })).rejects.toMatchObject({
      code: 'SENDER_REJECTED',
    });
    await expect(unimtx.sendSms({ ...request, senderId: 'Beaucoup+Trop/Long!' })).rejects.toMatchObject({
      code: 'SENDER_REJECTED',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [200, { code: '105400', message: 'InsufficientFunds' }, 'INSUFFICIENT_CREDIT', true],
    [200, { code: '107111', message: 'InvalidPhoneNumbers' }, 'INVALID_RECIPIENT', true],
    [200, { code: '107143' }, 'SENDER_REJECTED', true],
    [200, { code: '104110' }, 'PROVIDER_CONFIGURATION', true],
    [200, { code: '105001' }, 'PROVIDER_CONFIGURATION', true],
    [200, { code: '104001' }, 'PROVIDER_CONFIGURATION', true],
    [200, { code: '101000' }, 'RATE_LIMITED', false],
    [200, { code: '101303' }, 'RATE_LIMITED', false],
    [200, { code: '105300' }, 'RATE_LIMITED', false],
    [429, {}, 'RATE_LIMITED', false],
    [503, {}, 'UNAVAILABLE', false],
  ])('réponse %i %j → %s (définitif : %s)', async (status, body, code, permanent) => {
    const { unimtx } = provider({ status, body });
    await expect(unimtx.sendSms(request)).rejects.toMatchObject({ code, permanent });
  });

  it('succès code=0 sans id : erreur temporaire (pas de faux succès)', async () => {
    const { unimtx } = provider({ status: 200, body: { code: '0', data: { messages: [] } } });
    await expect(unimtx.sendSms(request)).rejects.toMatchObject({ code: 'UNAVAILABLE', permanent: false });
  });

  it('panne réseau et délai dépassé : erreurs temporaires', async () => {
    await expect(provider(new Error('ECONNRESET')).unimtx.sendSms(request)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      permanent: false,
    });
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(provider(abort).unimtx.sendSms(request)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('les erreurs ne divulguent ni la clé, ni le texte, ni le numéro complet', async () => {
    const { unimtx } = provider({
      status: 200,
      body: { code: '107111', message: `bad ${KEY} Code secret 4242 699123456` },
    });
    const error = await unimtx.sendSms(request).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).not.toContain('4242');
    expect((error as Error).message).not.toContain('699123456');
  });

  it('interroge sms.message.get et mappe le statut livré', async () => {
    const { unimtx, fetchImpl } = provider({
      status: 200,
      body: {
        code: '0',
        data: { messages: [{ id: 'msg-1', status: 'delivered', doneDate: '2026-10-08T09:12:00Z' }] },
      },
    });
    await expect(unimtx.getDeliveryStatus('msg-1')).resolves.toEqual({
      status: 'DELIVERED',
      deliveredAt: new Date('2026-10-08T09:12:00Z'),
    });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.unimtx.com/?action=sms.message.get&accessKeyId=${KEY}`);
  });

  it.each([
    [{ status: 'failed', errorCode: 'ABSENT_SUBSCRIBER' }, { status: 'FAILED', errorCode: 'ABSENT_SUBSCRIBER' }],
    [{ status: 'failed' }, { status: 'FAILED' }],
    [{ status: 'queued' }, { status: 'QUEUED' }],
    [{ status: 'sent' }, { status: 'SENT' }],
    [{ status: 'something_new' }, { status: 'UNKNOWN' }],
    [{}, { status: 'UNKNOWN' }],
  ])('statut de remise %j', async (message, expected) => {
    const { unimtx } = provider({ status: 200, body: { code: '0', data: { messages: [message] } } });
    await expect(unimtx.getDeliveryStatus('id')).resolves.toEqual(expected);
  });

  it('statut inconnu si message introuvable, erreur typée sinon', async () => {
    await expect(provider({ status: 404 }).unimtx.getDeliveryStatus('id')).resolves.toEqual({ status: 'UNKNOWN' });
    await expect(
      provider({ status: 200, body: { code: '107112' } }).unimtx.getDeliveryStatus('id'),
    ).resolves.toEqual({ status: 'UNKNOWN' });
    await expect(provider({ status: 200, body: { code: '104110' } }).unimtx.getDeliveryStatus('id')).rejects.toMatchObject({
      code: 'PROVIDER_CONFIGURATION',
    });
    await expect(provider({ status: 503 }).unimtx.getDeliveryStatus('id')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('validation d’expéditeur', async () => {
    const { unimtx } = provider({ status: 200 });
    await expect(unimtx.validateSender('AtelierM')).resolves.toEqual({ valid: true });
    await expect(unimtx.validateSender('A')).resolves.toMatchObject({ valid: false });
    await expect(unimtx.validateSender('plus+que+16+car')).resolves.toMatchObject({ valid: false });
  });
});

describe('Configuration SMS_PROVIDER=unimtx', () => {
  it('sélectionne l’adaptateur avec la clé et un expéditeur par défaut', () => {
    const p = createSmsProvider(env({ SMS_PROVIDER: 'unimtx', UNIMTX_ACCESS_KEY_ID: KEY }));
    expect(p).toBeInstanceOf(UnimtxSmsProvider);
    expect(p.name).toBe('unimtx');
  });

  it('clé absente : l’API refuse de démarrer, sans citer de secret', () => {
    expect(() => createSmsProvider(env({ SMS_PROVIDER: 'unimtx' }))).toThrow(/UNIMTX_ACCESS_KEY_ID/);
  });

  it('expéditeur invalide : refus au démarrage', () => {
    expect(() =>
      createSmsProvider(env({ SMS_PROVIDER: 'unimtx', UNIMTX_ACCESS_KEY_ID: KEY, UNIMTX_SENDER_ID: 'X' })),
    ).toThrow(/UNIMTX_SENDER_ID/);
  });
});
