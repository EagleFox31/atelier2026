import { resolveDispatch, type DispatchInput } from '../resolve-dispatch';

const PHONE = '+237690000001';

function input(overrides: Partial<DispatchInput> = {}): DispatchInput {
  return {
    mode: 'live',
    eventEnabled: true,
    entitled: true,
    stale: false,
    consentPhone: PHONE,
    templateName: 'am_vehicle_ready_v1',
    languages: ['en', 'fr'],
    isTemplateApproved: () => true,
    testRecipients: new Set(),
    sentThisMonth: 0,
    monthlyCap: 300,
    ...overrides,
  };
}

describe('resolveDispatch', () => {
  it('envoie en WhatsApp au numéro du consentement, dans la langue du client', () => {
    expect(resolveDispatch(input())).toEqual({
      action: 'SEND',
      channel: 'WHATSAPP',
      to: PHONE,
      templateName: 'am_vehicle_ready_v1',
      language: 'en',
    });
  });

  it('se replie sur le français si le modèle anglais n’est pas approuvé', () => {
    const decision = resolveDispatch(input({ isTemplateApproved: (_, lang) => lang === 'fr' }));
    expect(decision).toMatchObject({ action: 'SEND', language: 'fr' });
  });

  it.each([
    ['MODE_OFF', { mode: 'off' as const }],
    ['DISABLED_BY_GARAGE', { eventEnabled: false }],
    ['NOT_ENTITLED', { entitled: false }],
    ['STALE', { stale: true }],
    ['NO_CONSENT', { consentPhone: null }],
    ['TEMPLATE_NOT_APPROVED', { isTemplateApproved: () => false }],
    ['SANDBOX_RECIPIENT_NOT_ALLOWED', { mode: 'sandbox' as const }],
    ['QUOTA_EXCEEDED', { sentThisMonth: 300 }],
  ])('%s', (reason, overrides) => {
    expect(resolveDispatch(input(overrides))).toEqual({ action: 'SKIP', reason });
  });

  it('la première règle qui échoue l’emporte (ordre documenté)', () => {
    const everythingWrong = input({
      mode: 'sandbox',
      eventEnabled: false,
      entitled: false,
      stale: true,
      consentPhone: null,
      sentThisMonth: 999,
    });
    expect(resolveDispatch(everythingWrong)).toEqual({ action: 'SKIP', reason: 'DISABLED_BY_GARAGE' });
    expect(resolveDispatch({ ...everythingWrong, eventEnabled: true })).toMatchObject({ reason: 'NOT_ENTITLED' });
    expect(resolveDispatch({ ...everythingWrong, eventEnabled: true, entitled: true })).toMatchObject({ reason: 'STALE' });
  });

  it('mode sandbox : envoie seulement aux destinataires de test', () => {
    const decision = resolveDispatch(input({ mode: 'sandbox', testRecipients: new Set([PHONE]) }));
    expect(decision).toMatchObject({ action: 'SEND', to: PHONE });
  });

  it('plafond à 0 : aucun envoi', () => {
    expect(resolveDispatch(input({ monthlyCap: 0 }))).toEqual({ action: 'SKIP', reason: 'QUOTA_EXCEEDED' });
  });
});
