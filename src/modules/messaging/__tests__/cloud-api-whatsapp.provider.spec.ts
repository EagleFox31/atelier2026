import { createWhatsAppProvider } from '../messaging.config';
import { WhatsAppCloudApiProvider } from '../whatsapp/cloud-api-whatsapp.provider';

const TOKEN = 'EAAG_secret_token';

function provider(response: { status: number; body?: unknown } | Error) {
  const fetchImpl = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return { status: response.status, json: async () => response.body ?? {} } as unknown as Response;
  });
  const whatsapp = new WhatsAppCloudApiProvider({
    accessToken: TOKEN,
    phoneNumberId: '123456',
    apiUrl: 'https://graph.facebook.com',
    apiVersion: 'v21.0',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { whatsapp, fetchImpl };
}

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

function metaError(code: number, status = 400) {
  return { status, body: { error: { code, message: `secret ${TOKEN}` } } };
}

const text = { to: '699123456', text: 'Bonjour', idempotencyKey: 'k1' };
const template = {
  to: '699123456',
  templateName: 'ot_pret',
  language: 'fr',
  variables: ['Paul', 'OT-12'],
  idempotencyKey: 'k2',
};

describe('WhatsAppCloudApiProvider', () => {
  it('envoie un texte au format Cloud API (Bearer, numéro sans +)', async () => {
    const { whatsapp, fetchImpl } = provider({ status: 200, body: { messages: [{ id: 'wamid.1' }] } });
    await expect(whatsapp.sendWhatsAppMessage(text)).resolves.toEqual({
      providerMessageId: 'wamid.1',
      status: 'QUEUED',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/123456/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      messaging_product: 'whatsapp',
      to: '237699123456',
      type: 'text',
      text: { body: 'Bonjour' },
    });
  });

  it('envoie un modèle avec ses variables positionnelles', async () => {
    const { whatsapp, fetchImpl } = provider({ status: 200, body: { messages: [{ id: 'wamid.2' }] } });
    await whatsapp.sendTemplate(template);
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.template).toEqual({
      name: 'ot_pret',
      language: { code: 'fr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Paul' },
            { type: 'text', text: 'OT-12' },
          ],
        },
      ],
    });
  });

  it('refuse un numéro invalide sans appel réseau', async () => {
    const { whatsapp, fetchImpl } = provider({ status: 200 });
    await expect(whatsapp.sendWhatsAppMessage({ ...text, to: '12' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENT',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [metaError(131047), 'CONTENT_REJECTED'],
    [metaError(131026), 'INVALID_RECIPIENT'],
    [metaError(190, 401), 'PROVIDER_CONFIGURATION'],
    [metaError(132001), 'CONTENT_REJECTED'],
    [metaError(131042), 'INSUFFICIENT_CREDIT'],
    [metaError(130429, 429), 'RATE_LIMITED'],
    [{ status: 503 }, 'UNAVAILABLE'],
  ])('classe un refus Meta (%#)', async (response, code) => {
    const { whatsapp } = provider(response);
    const error = await whatsapp.sendWhatsAppMessage(text).catch((e: Error) => e);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('traite une réponse 2xx sans id comme temporaire', async () => {
    const { whatsapp } = provider({ status: 200, body: {} });
    await expect(whatsapp.sendWhatsAppMessage(text)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('traduit timeout et réseau en erreurs temporaires', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    await expect(provider(abort).whatsapp.sendWhatsAppMessage(text)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(provider(new Error('down')).whatsapp.sendWhatsAppMessage(text)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('exige token et identifiant de numéro au démarrage', () => {
    expect(() => createWhatsAppProvider(env({ WHATSAPP_PROVIDER: 'whatsapp-cloud' }))).toThrow(
      /WHATSAPP_ACCESS_TOKEN/,
    );
    expect(() =>
      createWhatsAppProvider(
        env({ WHATSAPP_PROVIDER: 'whatsapp-cloud', WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'abc' }),
      ),
    ).toThrow(/numérique/);
    expect(
      createWhatsAppProvider(
        env({ WHATSAPP_PROVIDER: 'whatsapp-cloud', WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' }),
      ).name,
    ).toBe('whatsapp-cloud');
  });
});
