import { SignupEmailService } from '../signup-email.service';
import { renderWelcomeEmail, type WelcomeEmailInput } from '../signup-welcome.email';
import { toWelcomeTeam, type SignupTeamResult } from '../signup.service';

const TEMP_PASSWORD = 'Norom4821!';

const base: WelcomeEmailInput = {
  adminFirstName: 'Jennifer',
  adminEmail: 'admin@garage-akwa.cm',
  adminEmployeeCode: 'jennifer.admin',
  workshopName: 'Garage Akwa Motors',
  trialEndsAt: new Date('2026-10-31T23:30:00.000Z'), // 1er nov. à Douala (UTC+1)
  appUrl: 'https://atelier.trigenys.com',
  team: [{ roleCode: 'TECHNICIEN', firstName: 'Norom', lastName: 'Gandi', employeeCode: 'norom.gandi' }],
};

describe('E-mail de bienvenue — sécurité', () => {
  it('toWelcomeTeam ne transmet jamais le mot de passe temporaire (liste blanche)', () => {
    const created: SignupTeamResult[] = [{
      roleCode: 'TECHNICIEN',
      firstName: 'Norom',
      lastName: 'Gandi',
      email: 'norom@garage.cm',
      employeeCode: 'norom.gandi',
      tempPassword: TEMP_PASSWORD,
    }];

    const team = toWelcomeTeam(created);

    expect(team).toEqual([{ roleCode: 'TECHNICIEN', firstName: 'Norom', lastName: 'Gandi', employeeCode: 'norom.gandi' }]);
    const { html, text } = renderWelcomeEmail({ ...base, team });
    expect(html).not.toContain(TEMP_PASSWORD);
    expect(text).not.toContain(TEMP_PASSWORD);
  });

  it('échappe le HTML des données saisies (nom d’atelier, prénom)', () => {
    const { html } = renderWelcomeEmail({
      ...base,
      workshopName: '<script>alert(1)</script>Garage',
      adminFirstName: '"><img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('E-mail de bienvenue — contenu', () => {
  it('sujet, date de fin du pilote (fuseau Douala), bouton et logo absolus', () => {
    const { subject, html, text } = renderWelcomeEmail(base);

    expect(subject).toBe('Votre atelier Garage Akwa Motors est prêt — Atelier Maître');
    expect(html).toContain('1 novembre 2026');
    expect(text).toContain('1 novembre 2026');
    expect(html).toContain('href="https://atelier.trigenys.com/login"');
    expect(html).toContain('src="https://atelier.trigenys.com/icon"');
    expect(text).toContain('Ouvrir mon atelier : https://atelier.trigenys.com/login');
    expect(html).toContain('norom.gandi');
  });

  it('sans URL publique : ni lien ni image cassés', () => {
    const { html, text } = renderWelcomeEmail({ ...base, appUrl: null });
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<img');
    expect(text).not.toContain('http');
  });

  it('sans équipe ni identifiant admin : sections omises, jamais « null »', () => {
    const { html, text } = renderWelcomeEmail({ ...base, team: [], adminEmployeeCode: null });
    expect(html).not.toContain('Votre équipe');
    expect(text).not.toContain('VOTRE ÉQUIPE');
    expect(html).not.toContain('Identifiant&nbsp;:');
    expect(`${html}${text}`).not.toMatch(/\bnull\b|undefined/);
  });
});

describe('SignupEmailService', () => {
  const ENV = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as never;
    process.env = { ...ENV, RESEND_API_KEY: 're_test_secret', SIGNUP_EMAIL_FROM: 'Atelier Maître <ateliermaitre@trigenys.com>' };
    delete process.env.SIGNUP_EMAIL_REPLY_TO;
    delete process.env.APP_PUBLIC_URL;
    process.env.APP_DOMAIN = 'atelier.trigenys.com';
  });

  afterAll(() => {
    process.env = ENV;
  });

  const { appUrl: _ignored, ...input } = base;

  it('sans clé Resend : aucun appel réseau, résultat « skipped »', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(new SignupEmailService().sendWelcome('tenant-1', input)).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie via Resend avec clé d’idempotence par tenant, HTML + texte', async () => {
    process.env.SIGNUP_EMAIL_REPLY_TO = 'ateliermaitre@trigenys.com';

    await expect(new SignupEmailService().sendWelcome('tenant-1', input)).resolves.toBe('sent');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_secret',
      'Idempotency-Key': 'atelier-signup-welcome/tenant-1',
    });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'Atelier Maître <ateliermaitre@trigenys.com>',
      to: ['admin@garage-akwa.cm'],
      reply_to: 'ateliermaitre@trigenys.com',
      subject: expect.stringContaining('Garage Akwa Motors'),
    });
    expect(body.html).toContain('https://atelier.trigenys.com/login'); // URL déduite de APP_DOMAIN
    expect(body.text).toContain('Bienvenue, Jennifer');
  });

  it.each([
    ['réponse HTTP 500', () => fetchMock.mockResolvedValue({ ok: false, status: 500 })],
    ['réseau / timeout', () => fetchMock.mockRejectedValue(new Error('timeout'))],
  ])('ne lève jamais (%s) et ne journalise pas la clé', async (_label, arrange) => {
    arrange();
    const service = new SignupEmailService();
    const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(service.sendWelcome('tenant-1', input)).resolves.toBe('failed');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('re_test_secret');
  });

  it.each([
    [{ APP_PUBLIC_URL: 'https://app.exemple.cm/' }, 'https://app.exemple.cm'],
    [{ APP_DOMAIN: 'atelier.trigenys.com' }, 'https://atelier.trigenys.com'],
    [{}, null],
  ])('resolveAppUrl(%o) → %s', (env, expected) => {
    expect(SignupEmailService.resolveAppUrl(env as NodeJS.ProcessEnv)).toBe(expected);
  });
});
