import { detectCameroonOperator, isValidAlphanumericSenderId, maskPhone, toE164 } from '../shared/phone';

describe('toE164 — normalisation des numéros', () => {
  it.each([
    ['699000001', '+237699000001'],
    ['699 00 00 01', '+237699000001'],
    ['+237 699-00-00-01', '+237699000001'],
    ['+237699000001', '+237699000001'],
    ['237699000001', '+237699000001'],
    ['00237699000001', '+237699000001'],
    ['(+237) 677.12.34.56', '+237677123456'],
    ['222 23 45 67', '+237222234567'],
    ['+33612345678', '+33612345678'],
  ])('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it.each([
    [''],
    ['12'],
    ['69900000'], // ancien plan à 8 chiffres
    ['599000001'], // préfixe hors plan camerounais
    ['+237 12345'],
    ['+2375990000011'],
    ['abc699000001'],
    ['+0123456789'],
  ])('refuse %p', (input) => {
    expect(toE164(input)).toBeNull();
  });

  it('refuse null / undefined', () => {
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });
});

describe('detectCameroonOperator — comportement historique conservé', () => {
  it.each([
    ['+237690000001', 'ORANGE_CM'],
    ['+237655000001', 'ORANGE_CM'],
    ['+237670000001', 'MTN_CM'],
    ['+237680000001', 'MTN_CM'],
    ['+237650000001', 'MTN_CM'],
    ['+237222000001', 'CAMTEL'],
    ['+237620000001', 'UNKNOWN'],
    ['+33612345678', 'UNKNOWN'],
    ['699 00 00 01', 'ORANGE_CM'],
    // Corrigé : sans « + », l'ancien code lisait « 237… » comme un fixe Camtel.
    ['237699000001', 'ORANGE_CM'],
  ])('%s → %s', (input, expected) => {
    expect(detectCameroonOperator(input)).toBe(expected);
  });
});

/**
 * Plan vérifié (sources dans `shared/phone.ts`) : chaque préfixe à 3 chiffres
 * 600–699 est testé, bornes comprises. Toute tranche absente vaut UNKNOWN.
 */
describe('detectCameroonOperator — plan de numérotation vérifié', () => {
  const RANGES: Array<[from: number, to: number, operator: string]> = [
    [650, 654, 'MTN_CM'],
    [655, 659, 'ORANGE_CM'],
    [660, 669, 'NEXTTEL'],
    [670, 679, 'MTN_CM'],
    [680, 683, 'MTN_CM'],
    [690, 699, 'ORANGE_CM'],
  ];
  const expectedFor = (prefix: number) =>
    RANGES.find(([from, to]) => prefix >= from && prefix <= to)?.[2] ?? 'UNKNOWN';
  const mobileCases = Array.from({ length: 100 }, (_, i) => 600 + i).map(
    (prefix) => [`+237${prefix}123456`, expectedFor(prefix)] as const,
  );

  it.each(mobileCases)('%s → %s', (input, expected) => {
    expect(detectCameroonOperator(input)).toBe(expected);
  });

  it.each([
    // 684–689 : plus classés MTN (aucune source) ; 686–689 = Orange selon une source unique.
    ['+237684000001', 'UNKNOWN'],
    ['+237689999999', 'UNKNOWN'],
    // 64x (Orange selon une source unique) et 62x (Camtel Blue, non vérifié).
    ['+237640000001', 'UNKNOWN'],
    ['+237621000001', 'UNKNOWN'],
  ])('tranche non vérifiée %s → %s', (input, expected) => {
    expect(detectCameroonOperator(input)).toBe(expected);
  });

  it.each([
    ['+237222123456', 'CAMTEL'],
    ['+237233123456', 'CAMTEL'],
    ['+237242123456', 'CAMTEL'],
    ['+237243123456', 'CAMTEL'],
    ['+237221123456', 'UNKNOWN'],
    ['+237223123456', 'UNKNOWN'],
    ['+237232123456', 'UNKNOWN'],
    ['+237244123456', 'UNKNOWN'],
  ])('fixe %s → %s', (input, expected) => {
    expect(detectCameroonOperator(input)).toBe(expected);
  });

  it('formats locaux équivalents → même opérateur', () => {
    expect(detectCameroonOperator('660 12 34 56')).toBe('NEXTTEL');
    expect(detectCameroonOperator('00237 683 12 34 56')).toBe('MTN_CM');
    expect(detectCameroonOperator('659123456')).toBe('ORANGE_CM');
  });
});

describe('maskPhone', () => {
  it('ne garde que l’indicatif et les 2 derniers chiffres', () => {
    expect(maskPhone('+237699000001')).toBe('+2376******01');
    expect(maskPhone('699000001')).toBe('6990***01');
  });

  it('masque entièrement un numéro très court et gère l’absence', () => {
    expect(maskPhone('1234')).toBe('****');
    expect(maskPhone(undefined)).toBe('(vide)');
  });
});

describe('isValidAlphanumericSenderId', () => {
  it.each([['AtelierMtr', true], ['Atelier Mtr', true], ['AtelierMaitre', false], ['12345', false], ['', false], ['Atelier-M', false]])(
    '%p → %p',
    (sender, expected) => {
      expect(isValidAlphanumericSenderId(sender)).toBe(expected);
    },
  );
});
