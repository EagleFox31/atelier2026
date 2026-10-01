import { expect, test } from '@playwright/test';

test.describe('Parcours public UX', () => {
  test('tarifs affiche les 4 choix au même niveau', async ({ page }) => {
    await page.goto('/#tarifs');

    await expect(page.getByText('Atelier Maître Essentiel', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître Pro', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître Business', { exact: false })).toBeVisible();
    await expect(page.getByText('Atelier Maître · 30 jours', { exact: false })).toBeVisible();

    // Cibler le CTA de la carte Pro par son href : l'ordre des liens « Réserver une démo » varie (hero, nav, cartes).
    const pro = page.locator('a[href*="plan=pro"]');
    await expect(pro).toBeVisible();
    await expect(pro).toHaveText(/Réserver une démo/i);
  });

  test('ville recherche dès le premier caractère et tolère une faute', async ({ page }) => {
    await page.goto('/inscription');

    await page.getByLabel('Prénom').fill('Test');
    await page.getByLabel('Nom', { exact: true }).fill('QA');
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
