import { generateOpaqueToken, hashOpaqueToken, isWellFormedOpaqueToken } from '../opaque-token';

describe('opaque-token', () => {
  it('jeton base64url de 43 caractères, différent à chaque appel', () => {
    const a = generateOpaqueToken();
    expect(isWellFormedOpaqueToken(a)).toBe(true);
    expect(generateOpaqueToken()).not.toBe(a);
  });

  it('empreinte SHA-256 hex stable, différente du jeton', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it.each([undefined, 42, '', 'abc', `${'a'.repeat(42)}!`, 'a'.repeat(44)])('rejette %p', (value) => {
    expect(isWellFormedOpaqueToken(value)).toBe(false);
  });
});
