import { expect, test, type Page } from '@playwright/test';

const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;

async function login(page: Page) {
  test.skip(!email || !password, 'QA_EMAIL / QA_PASSWORD non définis');
  await page.goto('/login');
  await page.getByLabel(/email|identifiant/i).fill(email!);
  await page.getByLabel(/mot de passe/i).fill(password!);
  await page.getByRole('button', { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

test.describe('Parcours authentifié UX/CX', () => {
  test('aucune erreur console applicative majeure sur dashboard/settings', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const relevant = errors.filter(
      (message) =>
        !message.includes('chrome-extension://') &&
        !message.includes('No Listener') &&
        !message.includes('tabs.outgoing.message.ready'),
    );
    expect(relevant, relevant.join('\n')).toEqual([]);
  });

  test('journal d audit n expose pas les codes techniques dans le filtre', async ({ page }) => {
    await login(page);
    await page.goto('/audit');
    await expect(page.getByText(/STATUS_CHANGE|CREATE…/)).toHaveCount(0);
    await expect(page.getByRole('combobox').last()).toBeVisible();
  });

  test('création inline sélectionne immédiatement le nouveau client', async ({ page }) => {
    test.skip(process.env.QA_ALLOW_MUTATIONS !== '1', 'QA_ALLOW_MUTATIONS=1 requis');
    await login(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /Nouvel OT/i }).click();
    const customer = page.getByPlaceholder(/Téléphone ou nom du client/i);
    const suffix = Date.now().toString().slice(-6);
    await customer.fill(`QA-${suffix}`);
    await expect(page.getByText(/Créer ce client/i)).toBeVisible();

    await page.getByPlaceholder('Jean').fill('QA');
    await page.getByPlaceholder('Mbarga').fill(`Client${suffix}`);
    await page.getByPlaceholder(/\+237/).fill(`690${suffix}`);
    await page.getByRole('button', { name: /Créer et sélectionner/i }).click();

    await expect(page.getByText(`QA Client${suffix}`)).toBeVisible();
    await expect(page.getByText(/Client créé/i)).toBeVisible();
  });
});
