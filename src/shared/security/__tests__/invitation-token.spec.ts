import { createHash } from 'node:crypto';
import {
  INVITATION_TTL_HOURS,
  hashInvitationToken,
  invitationHashMatches,
  invitationStatusOf,
  isWellFormedInvitationToken,
  issueInvitation,
  unusablePassword,
} from '../invitation-token';
import { clientIpOf } from '../client-ip-throttler.guard';

describe('Jeton d’invitation', () => {
  const now = new Date('2026-10-02T09:00:00.000Z');

  it('32 octets aléatoires en base64url (43 caractères), uniques', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => issueInvitation(now).token));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
  });

  it('seule l’empreinte SHA-256 est à persister, jamais le jeton brut', () => {
    const { token, data } = issueInvitation(now);
    expect(data.inviteTokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(data.inviteTokenHash);
  });

  it(`expire ${INVITATION_TTL_HOURS} h après l’envoi, acceptation remise à zéro`, () => {
    const { data } = issueInvitation(now);
    expect(data.inviteSentAt).toEqual(now);
    expect(data.inviteExpiresAt.toISOString()).toBe('2026-10-05T09:00:00.000Z');
    expect(data.inviteAcceptedAt).toBeNull();
  });

  it('un nouvel envoi produit une autre empreinte (l’ancien lien ne correspond plus)', () => {
    const first = issueInvitation(now);
    const second = issueInvitation(now);
    expect(second.data.inviteTokenHash).not.toBe(first.data.inviteTokenHash);
    expect(hashInvitationToken(first.token)).not.toBe(second.data.inviteTokenHash);
  });

  it.each([
    ['', false],
    ['abc', false],
    ['a'.repeat(44), false],
    ['a'.repeat(42) + '=', false],
    ['../../etc/passwd'.padEnd(43, 'a'), false],
    [undefined, false],
    ['A'.repeat(43), true],
  ])('format %p → %p', (value, expected) => {
    expect(isWellFormedInvitationToken(value)).toBe(expected);
  });

  it('comparaison d’empreintes à temps constant, robuste aux longueurs différentes', () => {
    const h = hashInvitationToken('x');
    expect(invitationHashMatches(h, h)).toBe(true);
    expect(invitationHashMatches(h, hashInvitationToken('y'))).toBe(false);
    expect(invitationHashMatches(h, h.slice(0, 10))).toBe(false);
    expect(invitationHashMatches('', '')).toBe(false);
  });

  it('statut dérivé : none, pending, expired, accepted', () => {
    const later = new Date(now.getTime() + 1000);
    const earlier = new Date(now.getTime() - 1000);
    expect(invitationStatusOf({}, now)).toBe('none');
    expect(invitationStatusOf({ inviteTokenHash: 'h', inviteExpiresAt: later }, now)).toBe('pending');
    expect(invitationStatusOf({ inviteTokenHash: 'h', inviteExpiresAt: earlier }, now)).toBe('expired');
    expect(invitationStatusOf({ inviteTokenHash: 'h', inviteExpiresAt: now }, now)).toBe('expired');
    expect(invitationStatusOf({ inviteTokenHash: 'h', inviteExpiresAt: earlier, inviteAcceptedAt: earlier }, now)).toBe('accepted');
  });

  it('mot de passe de remplissage imprévisible', () => {
    expect(unusablePassword()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(unusablePassword()).not.toBe(unusablePassword());
  });
});

describe('clientIpOf (limitation de débit derrière Caddy)', () => {
  it('prend l’IP ajoutée par le proxy (entrée la plus à droite), pas une valeur fournie par le client', () => {
    expect(clientIpOf({ headers: { 'x-forwarded-for': '6.6.6.6, 41.202.1.2' }, ip: '172.18.0.5' })).toBe('41.202.1.2');
  });

  it('sans proxy : IP de la connexion', () => {
    expect(clientIpOf({ headers: {}, ip: '127.0.0.1' })).toBe('127.0.0.1');
  });
});
