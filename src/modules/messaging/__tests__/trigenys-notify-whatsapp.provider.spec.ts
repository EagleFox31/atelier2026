import {
  PermanentMessagingError,
  TemporaryMessagingError,
} from '../messaging.errors';
import { createWhatsAppProvider } from '../messaging.config';
import {
  TrigenysNotifyWhatsAppProvider,
  type TrigenysNotifyWhatsAppConfig,
} from '../whatsapp/trigenys-notify-whatsapp.provider';

const ORIGIN = 'https://trigenys-notify-staging-api.lawrynnjennifer.workers.dev';
const URL = ORIGIN + '/v1/dispatch/atelier/whatsapp';
const KEY = 'N'.repeat(48);
const CONFIG: TrigenysNotifyWhatsAppConfig = {
  apiUrl: ORIGIN,
  ingestKey: KEY,
  phoneNumberId: '123456789012345',
};
const VEHICLE_READY = {
  to: '699123456',
  templateName: 'am_vehicle_ready_v1',
  language: 'fr',
  variables: ['Ada', 'CE-123-AA', 'Garage pilote'],
  idempotencyKey: 'customer-notification:550e8400-e29b-41d4-a716-446655440000',
};
const RESPONSE = {
  accepted: true,
  status: 'QUEUED',
  provider: 'whatsapp-cloud',
  providerMessageId: 'wamid.EXAMPLE',
  accountRef: CONFIG.phoneNumberId,
};

function withResponse(status: number, data: unknown) {
  const http = jest.fn(async () =>
    new Response(JSON.stringify(data), {
      status, headers: { 'content-type': 'application/json' },
    }),
  );
  const provider = new TrigenysNotifyWhatsAppProvider({
    ...CONFIG,
    fetchImpl: http as unknown as typeof fetch,
  });
  return { http, provider };
}

describe('TrigenysNotifyWhatsAppProvider — contrat serveur à serveur', () => {
  it('n’effectue aucun appel à la construction ; sélection explicite uniquement', () => {
    const { http, provider } = withResponse(202, RESPONSE);
    expect(provider.name).toBe('whatsapp-cloud');
    expect(provider.simulated).toBe(false);
    expect(provider.accountRef).toBe(CONFIG.phoneNumberId);
    expect(http).not.toHaveBeenCalled();
    expect(createWhatsAppProvider({})).not.toBeInstanceOf(TrigenysNotifyWhatsAppProvider);
    const selected = createWhatsAppProvider({
      WHATSAPP_PROVIDER: 'trigenys-notify',
      TRIGENYS_NOTIFY_API_URL: ORIGIN,
      TRIGENYS_NOTIFY_INGEST_KEY: KEY,
      TRIGENYS_NOTIFY_PHONE_NUMBER_ID: CONFIG.phoneNumberId,
    });
    expect(selected).toBeInstanceOf(TrigenysNotifyWhatsAppProvider);
    expect(selected.name).toBe('whatsapp-cloud');
  });

  it('bloque les secrets incomplets et toute redirection vers un autre hôte', () => {
    for (const value of [
      'http://trigenys-notify-staging-api.lawrynnjennifer.workers.dev',
      'https://evil.example',
      ORIGIN + '.evil.example',
      ORIGIN + '/other',
      ORIGIN + '?redirect=evil',
      'https://user:pass@trigenys-notify-staging-api.lawrynnjennifer.workers.dev',
    ]) {
      expect(() => new TrigenysNotifyWhatsAppProvider({ ...CONFIG, apiUrl: value })).toThrow();
    }
    expect(() => new TrigenysNotifyWhatsAppProvider({ ...CONFIG, ingestKey: 'short' })).toThrow();
    expect(() => new TrigenysNotifyWhatsAppProvider({ ...CONFIG, phoneNumberId: 'not numeric' })).toThrow();
    expect(() => createWhatsAppProvider({ WHATSAPP_PROVIDER: 'trigenys-notify' })).toThrow(/TRIGENYS_NOTIFY/);
  });

  it('transmet exclusivement le contrat Utility au Worker avec sa clé privée', async () => {
    const { http, provider } = withResponse(202, RESPONSE);
    await expect(provider.sendTemplate(VEHICLE_READY)).resolves.toEqual({
      providerMessageId: 'wamid.EXAMPLE',
      status: 'QUEUED',
    });
    expect(http).toHaveBeenCalledTimes(1);
    const [target, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(new Headers(init.headers).get('x-notify-auth')).toBe(KEY);
    expect(new Headers(init.headers).get('authorization')).toBeNull();
    expect(JSON.parse(String(init.body))).toEqual({
      eventId: VEHICLE_READY.idempotencyKey,
      eventType: 'VEHICLE_READY',
      to: '+237699123456',
      templateName: 'am_vehicle_ready_v1',
      language: 'fr',
      variables: VEHICLE_READY.variables,
    });
  });

  it('reconnaît le modèle devis et ne transmet que le suffixe opaque du bouton', async () => {
    const { http, provider } = withResponse(202, RESPONSE);
    await provider.sendTemplate({
      ...VEHICLE_READY,
      templateName: 'am_quote_approval_v1',
      variables: ['Ada', 'Garage pilote', 'DEV-2026-1', '5 000 FCFA'],
      buttons: [{ index: 0, urlSuffix: 'a'.repeat(43) }],
    });
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      eventType: 'QUOTE_APPROVAL_REQUESTED',
      buttons: [{ index: 0, urlSuffix: 'a'.repeat(43) }],
    });
  });

  it('refuse le texte libre, les modèles marketing, les paramètres et destinations invalides sans réseau', async () => {
    const { http, provider } = withResponse(202, RESPONSE);
    await expect(provider.sendWhatsAppMessage({
      to: VEHICLE_READY.to, text: 'Bonjour', idempotencyKey: 'k1',
    })).rejects.toMatchObject({ code: 'CONTENT_REJECTED', permanent: true });
    const cases = [
      { templateName: 'am_promotion_v1' },
      { language: 'es' },
      { to: 'invalid' },
      { variables: ['Ada', 'CE-123-AA'] },
      { variables: ['Ada\nInjected', 'CE-123-AA', 'Garage'] },
      { idempotencyKey: 'unknown-id' },
      { buttons: [{ index: 0, urlSuffix: 'https://evil.example' }] },
    ];
    for (const change of cases) {
      await expect(provider.sendTemplate({ ...VEHICLE_READY, ...change })).rejects.toBeInstanceOf(
        PermanentMessagingError,
      );
    }
    expect(http).not.toHaveBeenCalled();
  });

  it('refuse une réponse 202 d’un compte émetteur différent sans second appel', async () => {
    const { http, provider } = withResponse(202, { ...RESPONSE, accountRef: 'other' });
    await expect(provider.sendTemplate(VEHICLE_READY)).rejects.toMatchObject({
      code: 'UNKNOWN_OUTCOME', permanent: true,
    });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('interdit de rejouer si Meta a potentiellement accepté avant un timeout', async () => {
    const http = jest.fn(async () => { throw new Error('secret recipient sensitive trace'); });
    const provider = new TrigenysNotifyWhatsAppProvider({
      ...CONFIG, fetchImpl: http as unknown as typeof fetch,
    });
    await expect(provider.sendTemplate(VEHICLE_READY)).rejects.toMatchObject({
      code: 'UNKNOWN_OUTCOME', permanent: true,
    });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('classe une réponse Meta amont 5xx en issue incertaine, sans réessai automatique', async () => {
    const { provider } = withResponse(503, {
      error: 'PROVIDER_UNAVAILABLE',
      retryable: true,
      upstream: 'PRIVATE META BODY',
    });
    const error = await provider.sendTemplate(VEHICLE_READY).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PermanentMessagingError);
    expect(error).toMatchObject({ code: 'UNKNOWN_OUTCOME', permanent: true });
    expect((error as Error).message).not.toContain('PRIVATE');
  });

  it('classe explicitement quota et configuration ; aucun corps sensible dans les erreurs', async () => {
    const rate = withResponse(503, { error: 'RATE_LIMITED', sensitive: KEY });
    await expect(rate.provider.sendTemplate(VEHICLE_READY)).rejects.toBeInstanceOf(TemporaryMessagingError);
    await expect(rate.provider.sendTemplate(VEHICLE_READY)).rejects.toMatchObject({
      code: 'RATE_LIMITED', permanent: false,
    });

    const disabled = withResponse(503, { error: 'CHANNEL_DISABLED', sensitive: KEY });
    await expect(disabled.provider.sendTemplate(VEHICLE_READY)).rejects.toMatchObject({
      code: 'PROVIDER_CONFIGURATION', permanent: true,
    });
    const invalid = withResponse(400, { error: 'INVALID_EVENT', sensitive: KEY });
    const e = await invalid.provider.sendTemplate(VEHICLE_READY).catch((reason: unknown) => reason);
    expect(e).toMatchObject({ code: 'CONTENT_REJECTED', permanent: true });
    expect(String((e as Error).message)).not.toContain(KEY);
  });
});
