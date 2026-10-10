import {
  MAX_WEBHOOK_BODY_BYTES,
  MAX_WEBHOOK_STATUSES,
  MetaWebhookPayloadError,
  WhatsAppWebhookConfigurationError,
  isOptOutKeyword,
  loadWhatsAppWebhookConfig,
  parseMetaWebhook,
  signMetaPayload,
  verifyMetaSignature,
  verifySubscription,
} from '../whatsapp/meta-webhook';

const SECRET = 'app-secret-0123456789abcdef';
const TOKEN = 'verify-token-0123456789';
const PHONE_NUMBER_ID = '123456789012345';

function statusesPayload(statuses: unknown[], phoneNumberId: unknown = PHONE_NUMBER_ID) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '237600000000', phone_number_id: phoneNumberId },
              statuses,
            },
          },
        ],
      },
    ],
  };
}

const buf = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('loadWhatsAppWebhookConfig', () => {
  it('aucun secret : webhook désactivé (l’API démarre, la route répond 404)', () => {
    expect(loadWhatsAppWebhookConfig({})).toEqual({ enabled: false });
  });

  it('les deux secrets : activé', () => {
    expect(loadWhatsAppWebhookConfig({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: ` ${TOKEN} `, WHATSAPP_APP_SECRET: SECRET })).toEqual({
      enabled: true,
      verifyToken: TOKEN,
      appSecret: SECRET,
    });
  });

  it.each([
    [{ WHATSAPP_WEBHOOK_VERIFY_TOKEN: TOKEN }],
    [{ WHATSAPP_APP_SECRET: SECRET }],
    [{ WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'court', WHATSAPP_APP_SECRET: SECRET }],
  ])('configuration incohérente ou faible : refus de démarrer (%o)', (env) => {
    expect(() => loadWhatsAppWebhookConfig(env)).toThrow(WhatsAppWebhookConfigurationError);
  });

  it('le message d’erreur ne contient jamais la valeur d’un secret', () => {
    try {
      loadWhatsAppWebhookConfig({ WHATSAPP_APP_SECRET: SECRET });
      throw new Error('attendu : refus');
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET);
    }
  });
});

describe('verifySubscription (GET Meta)', () => {
  it('mode, jeton et challenge valides : renvoie le challenge à l’identique', () => {
    expect(verifySubscription({ mode: 'subscribe', token: TOKEN, challenge: '1158201444' }, TOKEN)).toEqual({
      ok: true,
      challenge: '1158201444',
    });
  });

  it.each([
    [{ mode: 'unsubscribe', token: TOKEN, challenge: '1' }, 'MODE'],
    [{ token: TOKEN, challenge: '1' }, 'MODE'],
    [{ mode: 'subscribe', token: 'mauvais-jeton-0123456', challenge: '1' }, 'TOKEN'],
    [{ mode: 'subscribe', token: `${TOKEN}x`, challenge: '1' }, 'TOKEN'],
    [{ mode: 'subscribe', challenge: '1' }, 'TOKEN'],
    [{ mode: 'subscribe', token: [TOKEN], challenge: '1' }, 'TOKEN'],
    [{ mode: 'subscribe', token: TOKEN, challenge: '<script>alert(1)</script>' }, 'CHALLENGE'],
    [{ mode: 'subscribe', token: TOKEN }, 'CHALLENGE'],
  ])('refus : %o → %s', (query, reason) => {
    expect(verifySubscription(query, TOKEN)).toEqual({ ok: false, reason });
  });
});

describe('verifyMetaSignature (POST Meta)', () => {
  const body = buf(statusesPayload([]));

  it('signature valide (casse indifférente)', () => {
    expect(verifyMetaSignature(body, signMetaPayload(body, SECRET), SECRET)).toEqual({ ok: true });
    expect(verifyMetaSignature(body, signMetaPayload(body, SECRET).toUpperCase().replace('SHA256', 'sha256'), SECRET)).toEqual({ ok: true });
  });

  it.each([
    [undefined, 'MISSING'],
    ['', 'MISSING'],
    ['abc', 'MALFORMED'],
    ['sha1=0123', 'MALFORMED'],
    [`sha256=${'z'.repeat(64)}`, 'MALFORMED'],
    [`sha256=${'0'.repeat(63)}`, 'MALFORMED'],
    [`sha256=${'0'.repeat(64)}`, 'MISMATCH'],
  ])('en-tête %p : %s', (header, reason) => {
    expect(verifyMetaSignature(body, header, SECRET)).toEqual({ ok: false, reason });
  });

  it('corps modifié d’un octet après signature : refus', () => {
    const signature = signMetaPayload(body, SECRET);
    expect(verifyMetaSignature(Buffer.concat([body, Buffer.from(' ')]), signature, SECRET).ok).toBe(false);
  });

  it('signé avec un autre secret (jeton d’accès, autre application) : refus', () => {
    expect(verifyMetaSignature(body, signMetaPayload(body, 'autre-secret-0123456789'), SECRET).ok).toBe(false);
  });

  it('JSON resérialisé (espaces, ordre) : refus — seule la forme brute reçue est signée', () => {
    const raw = Buffer.from('{ "object" : "whatsapp_business_account", "entry": [] }');
    const signature = signMetaPayload(raw, SECRET);
    expect(verifyMetaSignature(raw, signature, SECRET).ok).toBe(true);
    expect(verifyMetaSignature(buf(JSON.parse(raw.toString())), signature, SECRET).ok).toBe(false);
  });
});

describe('isOptOutKeyword', () => {
  it.each(['STOP', 'stop', ' Stop ! ', 'Arrêt', 'ARRETER', 'désabonner', 'Désinscrire.', 'unsubscribe'])('%p : désabonnement', (text) => {
    expect(isOptOutKeyword(text)).toBe(true);
  });

  it.each(['', 'Bonjour', 'STOP svp', 'non stop', 'STOPPER', 'S T O P', null, 42, 'STOP'.padEnd(80, ' ')])('%p : message ordinaire', (text) => {
    expect(isOptOutKeyword(text)).toBe(false);
  });
});

describe('parseMetaWebhook', () => {
  it('plusieurs statuts dans un même appel, dans l’ordre reçu', () => {
    const parsed = parseMetaWebhook(
      buf(
        statusesPayload([
          { id: 'wamid.A', status: 'sent', timestamp: '1760000000', recipient_id: '237690000001' },
          { id: 'wamid.A', status: 'delivered', timestamp: '1760000005', recipient_id: '237690000001' },
          { id: 'wamid.B', status: 'read', timestamp: 1760000010, recipient_id: '237690000002' },
        ]),
      ),
    );
    expect(parsed.ignored).toBe(0);
    expect(parsed.statuses).toEqual([
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.A', status: 'sent', occurredAt: new Date(1760000000_000), errorCode: null },
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.A', status: 'delivered', occurredAt: new Date(1760000005_000), errorCode: null },
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.B', status: 'read', occurredAt: new Date(1760000010_000), errorCode: null },
    ]);
  });

  it('échec Meta : seul le code est gardé, ni titre, ni détail, ni numéro du client', () => {
    const parsed = parseMetaWebhook(
      buf(
        statusesPayload([
          {
            id: 'wamid.F',
            status: 'failed',
            timestamp: '1760000000',
            recipient_id: '237690000001',
            errors: [{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Jean Dupont +237690000001' } }],
          },
        ]),
      ),
    );
    expect(parsed.statuses).toEqual([
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.F', status: 'failed', occurredAt: new Date(1760000000_000), errorCode: 131026 },
    ]);
    expect(JSON.stringify(parsed)).not.toMatch(/237690000001|Jean|undeliverable/);
  });

  it('statut inconnu, identifiant ou horodatage invalide : ignoré et compté, le reste passe', () => {
    const parsed = parseMetaWebhook(
      buf(
        statusesPayload([
          { id: 'wamid.OK', status: 'delivered', timestamp: '1760000000' },
          { id: 'wamid.X', status: 'deleted', timestamp: '1760000000' },
          { id: 'wamid X;drop', status: 'sent', timestamp: '1760000000' },
          { id: 'wamid.Y', status: 'sent', timestamp: 'hier' },
          'n’importe quoi',
        ]),
      ),
    );
    expect(parsed.statuses.map((s) => s.messageId)).toEqual(['wamid.OK']);
    expect(parsed.ignored).toBe(4);
  });

  it('compte émetteur absent ou invalide : statuts ignorés (impossible à rattacher)', () => {
    expect(parseMetaWebhook(buf(statusesPayload([{ id: 'wamid.A', status: 'sent', timestamp: '1' }], null)))).toEqual({
      statuses: [],
      optOuts: [],
      ignored: 1,
    });
    expect(parseMetaWebhook(buf(statusesPayload([{ id: 'wamid.A', status: 'sent', timestamp: '1' }], 'abc'))).statuses).toEqual([]);
  });

  it('autres champs (templates, compte) et messages entrants : ignorés, aucun contenu retenu', () => {
    const payload = statusesPayload([]);
    (payload.entry[0].changes as unknown[]).push({ field: 'message_template_status_update', value: { event: 'APPROVED' } });
    (payload.entry[0].changes[0].value as Record<string, unknown>).messages = [
      { from: '237690000001', id: 'wamid.IN', timestamp: '1', type: 'text', text: { body: 'Bonjour, secret' } },
    ];
    const parsed = parseMetaWebhook(buf(payload));
    expect(parsed).toEqual({ statuses: [], optOuts: [], ignored: 2 });
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it('« STOP » entrant (texte ou bouton de réponse rapide) : seul l’expéditeur E.164 est retenu, jamais le texte', () => {
    const payload = statusesPayload([]);
    (payload.entry[0].changes[0].value as Record<string, unknown>).messages = [
      { from: '237690000001', id: 'wamid.S1', timestamp: '1760000000', type: 'text', text: { body: ' Stop. ' } },
      { from: '237690000002', id: 'wamid.S2', timestamp: '1760000001', type: 'button', button: { text: 'Arrêter', payload: 'x' } },
      { from: '237690000003', id: 'wamid.S3', timestamp: '1760000002', type: 'text', text: { body: 'stop les messages svp' } },
      { from: '237690000004', id: 'wamid.S4', timestamp: '1760000003', type: 'image', image: { caption: 'STOP' } },
      { from: '+237 690', id: 'wamid.S5', timestamp: '1760000004', type: 'text', text: { body: 'STOP' } },
    ];
    const parsed = parseMetaWebhook(buf(payload));
    expect(parsed.optOuts).toEqual([
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.S1', fromE164: '+237690000001', occurredAt: new Date(1760000000 * 1000) },
      { phoneNumberId: PHONE_NUMBER_ID, messageId: 'wamid.S2', fromE164: '+237690000002', occurredAt: new Date(1760000001 * 1000) },
    ]);
    expect(parsed.ignored).toBe(3);
    expect(JSON.stringify(parsed)).not.toMatch(/stop les messages/i);
  });

  it('« STOP » sur un compte émetteur invalide : ignoré', () => {
    const payload = statusesPayload([], 'abc');
    (payload.entry[0].changes[0].value as Record<string, unknown>).messages = [
      { from: '237690000001', id: 'wamid.S1', timestamp: '1', type: 'text', text: { body: 'STOP' } },
    ];
    expect(parseMetaWebhook(buf(payload))).toEqual({ statuses: [], optOuts: [], ignored: 1 });
  });

  it.each([
    ['JSON illisible', Buffer.from('{pas du json'), 'INVALID_JSON'],
    ['autre objet Meta', buf({ object: 'page', entry: [] }), 'INVALID_STRUCTURE'],
    ['tableau racine', buf([1, 2]), 'INVALID_STRUCTURE'],
    ['entry non tableau', buf({ object: 'whatsapp_business_account', entry: {} }), 'INVALID_STRUCTURE'],
    ['corps trop gros', Buffer.alloc(MAX_WEBHOOK_BODY_BYTES + 1, 32), 'TOO_LARGE'],
  ])('%s : refus %s', (_label, body, code) => {
    expect(() => parseMetaWebhook(body)).toThrow(MetaWebhookPayloadError);
    try {
      parseMetaWebhook(body);
    } catch (error) {
      expect((error as MetaWebhookPayloadError).code).toBe(code);
    }
  });

  it(`plus de ${MAX_WEBHOOK_STATUSES} éléments : refus TOO_LARGE`, () => {
    const many = Array.from({ length: MAX_WEBHOOK_STATUSES + 1 }, (_, i) => ({ id: `wamid.${i}`, status: 'sent', timestamp: '1' }));
    expect(() => parseMetaWebhook(buf(statusesPayload(many)))).toThrow(MetaWebhookPayloadError);
  });
});
