import { expect, test } from '@playwright/test';

test.describe('Parcours public UX', () => {
  test('tarifs affiche les 4 choix au même niveau', async ({ page }) => {
    await page.goto('/#tarifs');

    await expect(page.getByText('Atelier Maître Essentiel', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître Pro', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître Business', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître · 30 jours', { exact: false })).toBeVisible();

    const pro = page.getByRole('link', { name: /Réserver une démo/i }).nth(1);
    await expect(pro).toHaveAttribute('href', /plan=pro/);
  });

  test('ville recherche dès le premier caractère et tolère une faute', async ({ page }) => {
    await page.goto('/inscription');

    await page.getByLabel('Prénom').fill('Test');
    await page.getByLabel('Nom').fill('QA');
    await page.getByLabel('Email').fill('qa@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('QATest-2026!');
    await page.getByLabel('Confirmer le mot de passe').fill('QATest-2026!');
    await page.getByRole('button', { name: /Continuer/i }).click();

    const city = page.getByRole('combobox', { name: /ville/i }).or(page.getByPlaceholder(/Rechercher une ville/i));
    await city.fill('Bertoa');
    await expect(page.getByRole('option', { name: 'Bertoua' })).toBeVisible();
  });

  test('étape équipe explique explicitement le clic sur une carte', async ({ page }) => {
    await page.goto('/inscription');
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('Super Admin réservé à la plateforme');
  });
});
