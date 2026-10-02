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
