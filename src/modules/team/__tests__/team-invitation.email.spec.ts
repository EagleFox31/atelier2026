import { renderTeamInvitationEmail, type TeamInvitationEmailInput } from '../team-invitation.email';

const TOKEN = 'Q2hhbmdlTWVJbW1lZGlhdGVseS1BdGVsaWVyTWFpdHJl';

const base: TeamInvitationEmailInput = {
  firstName: 'Norom',
  roleCode: 'TECHNICIEN',
  employeeCode: 'norom.gandi',
  email: 'norom@garage-akwa.cm',
  workshopName: 'Garage Akwa Motors',
  invitedByName: 'Jennifer Admin',
  expiresAt: new Date('2026-10-05T09:00:00.000Z'), // 10:00 à Douala (UTC+1)
  appUrl: 'https://atelier.trigenys.com',
  token: TOKEN,
};

describe('E-mail d’invitation équipe', () => {
  it('contient le bouton « Activer mon compte » vers /invitation/<jeton>, en HTML et en texte', () => {
    const { subject, html, text } = renderTeamInvitationEmail(base);
    const link = `https://atelier.trigenys.com/invitation/${TOKEN}`;

    expect(subject).toBe('Invitation à rejoindre Garage Akwa Motors sur Atelier Maître');
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain('Activer mon compte');
    expect(text).toContain(`Activer mon compte : ${link}`);
  });

  it('présente prénom, rôle, identifiant, atelier, e-mail et l’expiration à l’heure de Douala', () => {
    const { html, text } = renderTeamInvitationEmail(base);
    for (const content of [html, text]) {
      expect(content).toContain('Norom');
      expect(content).toContain('Technicien');
      expect(content).toContain('norom.gandi');
      expect(content).toContain('Garage Akwa Motors');
      expect(content).toContain('norom@garage-akwa.cm');
      expect(content).toContain('5 octobre 2026 à 10:00');
      expect(content).toContain('Jennifer Admin');
    }
  });

  it('reprend l’habillage Atelier Maître (kente, terre cuite, logo absolu, mobile)', () => {
    const { html } = renderTeamInvitationEmail(base);
    expect(html).toContain('#C8511A');
    expect(html).toContain('src="https://atelier.trigenys.com/icon"');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('max-width:600px');
  });

  it('ne contient jamais de mot de passe', () => {
    const { html, text } = renderTeamInvitationEmail(base);
    expect(`${html}\n${text}`).not.toMatch(/mot de passe temporaire|password/i);
    expect(text).not.toMatch(/Mot de passe\s*:/);
  });

  it('échappe le HTML des données saisies (atelier, prénom, invitant)', () => {
    const { html } = renderTeamInvitationEmail({
      ...base,
      workshopName: '<script>alert(1)</script>Garage',
      firstName: '"><img src=x onerror=alert(1)>',
      invitedByName: '<b>Boss</b>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Boss</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sans rôle, identifiant ni invitant : sections omises, jamais « null »', () => {
    const { html, text } = renderTeamInvitationEmail({ ...base, roleCode: null, employeeCode: null, invitedByName: null });
    expect(`${html}${text}`).not.toMatch(/\bnull\b|undefined/);
    expect(text).not.toContain('Rôle :');
    expect(text).not.toContain('Identifiant :');
  });
});
