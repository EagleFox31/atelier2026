/**
 * Numéros de téléphone : normalisation E.164, opérateur camerounais, masquage.
 *
 * Décision (Adopt/Build) : `libphonenumber-js` est déjà présent en dépendance
 * transitive (class-validator), mais sa validation par plages d'attribution
 * peut rejeter une plage camerounaise récemment ouverte — ce qui deviendrait ici
 * un échec DÉFINITIF d'envoi. Notre besoin se limite au formatage E.164
 * (+237 + 9 chiffres) : une fonction locale, testée, suffit (Build).
 */

export type CameroonOperator = 'ORANGE_CM' | 'MTN_CM' | 'NEXTTEL' | 'CAMTEL' | 'UNKNOWN';

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
 * Préfixes du numéro national (9 chiffres) → opérateur. Seules les tranches
 * vérifiées sont encodées ; tout le reste vaut `UNKNOWN` (l'opérateur n'est
 * qu'une métadonnée de traçabilité : mieux vaut « inconnu » qu'un opérateur faux).
 *
 * Sources (consultées le 2026-10-02) :
 * - [ART] Communication de l'Agence de Régulation des Télécommunications du
 *   6.X.2014 (passage à 9 chiffres), publiée par l'UIT :
 *   https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000240001PDFF.pdf
 *   → 66 NEXTTEL ; 67 + 650–654 MTN ; 69 + 655–659 Orange ;
 *     222 / 233 fixe Camtel ; 242 / 243 CDMA Camtel.
 * - [LIBON] https://help.libon.com/en/articles/183153-list-of-mtn-cameroon-prefixes
 *   → MTN 680–683 ;
 * - [MTN] https://mtn.cm/help/contact-us/ — numéros officiels MTN en 680, 682, 683.
 *   → 680–683 MTN retenu (deux sources indépendantes).
 *
 * Volontairement NON encodés (sources insuffisantes ou contradictoires) :
 * - 684–689 : l'ancien code les classait MTN sans source ; LIBON
 *   (https://help.libon.com/en/articles/183074-list-of-orange-cameroon-prefixes)
 *   attribue 686–689 à Orange, source unique → UNKNOWN ;
 * - 640–642 (Orange selon LIBON seul), 62x (Camtel « Blue », aucune source
 *   d'attribution trouvée), autres 2xx (S=2 = fixe tous opérateurs selon l'ART).
 */
const CAMEROON_PREFIXES: ReadonlyArray<readonly [prefix: string, operator: CameroonOperator]> = [
  ['650', 'MTN_CM'], ['651', 'MTN_CM'], ['652', 'MTN_CM'], ['653', 'MTN_CM'], ['654', 'MTN_CM'],
  ['655', 'ORANGE_CM'], ['656', 'ORANGE_CM'], ['657', 'ORANGE_CM'], ['658', 'ORANGE_CM'], ['659', 'ORANGE_CM'],
  ['66', 'NEXTTEL'],
  ['67', 'MTN_CM'],
  ['680', 'MTN_CM'], ['681', 'MTN_CM'], ['682', 'MTN_CM'], ['683', 'MTN_CM'],
  ['69', 'ORANGE_CM'],
  ['222', 'CAMTEL'], ['233', 'CAMTEL'], ['242', 'CAMTEL'], ['243', 'CAMTEL'],
];

/**
 * Opérateur camerounais déduit du préfixe (table `CAMEROON_PREFIXES`).
 * Accepte un numéro brut ou E.164 ; numéro étranger ou tranche non vérifiée → `UNKNOWN`.
 */
export function detectCameroonOperator(phone: string): CameroonOperator {
  const e164 = toE164(phone);
  if (e164 && !e164.startsWith(`+${CAMEROON_CODE}`)) return 'UNKNOWN';
  const national = e164
    ? e164.slice(1 + CAMEROON_CODE.length)
    : phone.replace(`+${CAMEROON_CODE}`, '').replace(/\s/g, '');

  const match = CAMEROON_PREFIXES.find(([prefix]) => national.startsWith(prefix));
  return match ? match[1] : 'UNKNOWN';
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
