import { test, expect } from '@playwright/test';

// Ces tests s'exécutent sans auth state sauvegardé
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('la page de login affiche le formulaire de connexion', async ({ page }) => {
    await expect(page.getByText('Connexion', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('admin@atelier.cm ou EMP-001')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });

  test('le bouton Se connecter est désactivé si les champs sont vides', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeDisabled();
  });

  test('login avec credentials valides redirige vers le dashboard', async ({ page }) => {
    await page.getByPlaceholder('admin@atelier.cm ou EMP-001').fill('admin@atelier.cm');
    await page.getByPlaceholder('••••••••').fill('Atelier2026!');
    await Promise.all([
      page.waitForURL('/', { timeout: 90_000, waitUntil: 'domcontentloaded' }),
      page.getByRole('button', { name: 'Se connecter' }).click(),
    ]);
    await expect(page).toHaveURL('/');
  });

  test('login avec credentials invalides affiche une erreur', async ({ page }) => {
    await page.getByPlaceholder('admin@atelier.cm ou EMP-001').fill('mauvais@atelier.cm');
    await page.getByPlaceholder('••••••••').fill('MauvaisMotDePasse!');

    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Se connecter' }).click();
    expect((await loginResponse).status()).toBeGreaterThanOrEqual(400);

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled({ timeout: 30_000 });
  });

  test('login fonctionne aussi avec le code employé', async ({ page }) => {
    await page.locator('input[autocomplete="username"]').fill('EMP-001');
    await page.locator('input[autocomplete="current-password"]').fill('Atelier2026!');
    await Promise.all([
      page.waitForURL('/', { timeout: 90_000, waitUntil: 'domcontentloaded' }),
      page.getByRole('button', { name: 'Se connecter' }).click(),
    ]);
    await expect(page).toHaveURL('/');
  });

  test('une page protégée redirige vers /login si non authentifié', async ({ page }) => {
    await page.goto('/workshop');
    await page.waitForURL('/login', { timeout: 5_000 });
    await expect(page).toHaveURL('/login');
  });

  test('toggle affiche/masque le mot de passe', async ({ page }) => {
    const input = page.locator('input[autocomplete="current-password"]');
    await expect(input).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Afficher le mot de passe' }).click({ force: true });
    await expect(input).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Masquer le mot de passe' }).click({ force: true });
    await expect(input).toHaveAttribute('type', 'password');
  });
});
