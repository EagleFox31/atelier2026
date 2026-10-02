/**
 * Numéros de téléphone : normalisation E.164, opérateur camerounais, masquage.
 *
 * Décision (Adopt/Build) : `libphonenumber-js` est déjà présent en dépendance
 * transitive (class-validator), mais sa validation par plages d'attribution
 * peut rejeter une plage camerounaise récemment ouverte — ce qui deviendrait ici
 * un échec DÉFINITIF d'envoi. Notre besoin se limite au formatage E.164
 * (+237 + 9 chiffres) : une fonction locale, testée, suffit (Build).
 */

export type CameroonOperator = 'ORANGE_CM' | 'MTN_CM' | 'CAMTEL' | 'UNKNOWN';

const CAMEROON_CODE = '237';

/**
 * Convertit un numéro saisi librement en E.164 (`+2376XXXXXXXX`).
 * Accepte : `699 00 00 00`, `+237 699-00-00-00`, `237699000000`, `00237699000000`,
 * et tout numéro international déjà au format `+<indicatif><numéro>`.
 * Retourne `null` si le numéro est inexploitable (fail-fast côté appelant).
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/[\s.\-()]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;

  if (value.startsWith('+')) {
    const digits = value.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.startsWith(CAMEROON_CODE)) {
      return isCameroonNational(digits.slice(CAMEROON_CODE.length)) ? `+${digits}` : null;
    }
    return `+${digits}`;
  }

  if (!/^\d+$/.test(value)) return null;
  if (value.length === 12 && value.startsWith(CAMEROON_CODE)) {
    return isCameroonNational(value.slice(3)) ? `+${value}` : null;
  }
  return isCameroonNational(value) ? `+${CAMEROON_CODE}${value}` : null;
}

/** Plan de numérotation camerounais à 9 chiffres : 6XXXXXXXX (mobile), 2/3XXXXXXXX (fixe). */
function isCameroonNational(national: string): boolean {
  return /^[236]\d{8}$/.test(national);
}

/**
 * Opérateur camerounais déduit du préfixe (comportement historique de
 * `SmsProcessor.detectOperator`, conservé à l'identique) :
 * 69x / 655 → Orange, 67x / 68x / 650 → MTN, 2xx → Camtel, sinon inconnu.
 * Accepte un numéro brut ou E.164.
 */
export function detectCameroonOperator(phone: string): CameroonOperator {
  const e164 = toE164(phone);
  if (e164 && !e164.startsWith(`+${CAMEROON_CODE}`)) return 'UNKNOWN';
  const national = e164
    ? e164.slice(1 + CAMEROON_CODE.length)
    : phone.replace(`+${CAMEROON_CODE}`, '').replace(/\s/g, '');

  if (national.startsWith('69') || national.startsWith('655')) return 'ORANGE_CM';
  if (national.startsWith('67') || national.startsWith('68') || national.startsWith('650')) return 'MTN_CM';
  if (national.startsWith('2')) return 'CAMTEL';
  return 'UNKNOWN';
}

/** Masque un numéro pour les journaux : `+237699000001` → `+2376******01`. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(vide)';
  const compact = phone.replace(/\s/g, '');
  if (compact.length <= 6) return '*'.repeat(compact.length);
  const keepStart = compact.startsWith('+') ? 5 : 4;
  return `${compact.slice(0, keepStart)}${'*'.repeat(compact.length - keepStart - 2)}${compact.slice(-2)}`;
}

/**
 * Nom d'expéditeur SMS alphanumérique : 1 à 11 caractères (limite GSM),
 * lettres/chiffres/espaces, au moins une lettre.
 */
export function isValidAlphanumericSenderId(senderId: string): boolean {
  return /^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$/.test(senderId);
}
