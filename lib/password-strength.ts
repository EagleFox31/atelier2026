export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  label: string;
  percent: number;
  hints: string[];
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

/** Score simple pour l’UI inscription (8 car. min côté API). */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { level: 'weak', label: '', percent: 0, hints: [] };
  }

  const hints: string[] = [];
  const lengthOk = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!lengthOk) hints.push('Au moins 8 caractères');
  if (!hasLower) hints.push('Une minuscule');
  if (!hasUpper) hints.push('Une majuscule');
  if (!hasDigit) hints.push('Un chiffre');
  if (!hasSpecial) hints.push('Un caractère spécial (!@#…)');

  let points = 0;
  if (lengthOk) points += 1;
  if (password.length >= 12) points += 1;
  if (hasLower) points += 1;
  if (hasUpper) points += 1;
  if (hasDigit) points += 1;
  if (hasSpecial) points += 1;

  if (points <= 2) {
    return { level: 'weak', label: 'Faible', percent: 33, hints };
  }
  if (points <= 4) {
    return { level: 'medium', label: 'Moyen', percent: 66, hints };
  }
  return { level: 'strong', label: 'Fort', percent: 100, hints: [] };
}

export function getPasswordSimilarityPercent(password: string, confirmPassword: string): number {
  if (!confirmPassword) return 0;
  if (!password) return 0;

  const distance = levenshteinDistance(password, confirmPassword);
  const maxLength = Math.max(password.length, confirmPassword.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.max(0, Math.min(100, Math.round(similarity)));
}
