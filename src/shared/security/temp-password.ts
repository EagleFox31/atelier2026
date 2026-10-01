import { randomInt } from 'crypto';

/**
 * Mots de passe temporaires (création d'un membre, réinitialisation).
 *
 * - Générateur cryptographique (crypto.randomInt), jamais Math.random.
 * - 12 caractères tirés d'un alphabet de 55 symboles sans caractères ambigus
 *   (0/O, 1/l/I) ≈ 69 bits d'entropie — contre 13 bits pour l'ancien « Prénom1234! ».
 * - Format lisible à dicter ou recopier : « Xk7m-Pq4r-Zt9w ».
 * - Jamais stocké : renvoyé une seule fois, et le changement est imposé à la
 *   première connexion (User.mustChangePassword).
 */
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

const GROUPS = 3;
const GROUP_LENGTH = 4;

export function generateTempPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}
