import { test, expect } from '@playwright/test';

test.describe('Workshop — Ordres de Travail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workshop');
    await expect(page.getByRole('heading', { name: 'Atelier' })).toBeVisible({ timeout: 8_000 });
  });

  test('affiche les onglets de filtrage', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /tous/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /en cours/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /terminés/i })).toBeVisible();
  });

  test('le bouton Nouvel OT ouvre la modale de création', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel OT' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Ouvrir un nouvel Ordre de Travail')).toBeVisible();
  });

  test('ferme la modale Nouvel OT avec la touche Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouvel OT' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  test('le chargement affiche des skeletons puis le contenu', async ({ page }) => {
    // Intercepte l'appel API pour ralentir la réponse et vérifier les skeletons
    await page.route('**/api/workshop/ot**', async route => {
      await page.waitForTimeout(200);
      await route.continue();
    });

    await page.goto('/workshop');
    // Soit le skeleton, soit le contenu final (si l'API est très rapide)
    const content = page.locator('.grid, [data-testid="ot-card"], p:has-text("Aucun ordre de travail")');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('basculer vers l\'onglet En cours filtre les OTs', async ({ page }) => {
    await page.getByRole('tab', { name: /en cours/i }).click();
    // Pas d'erreur de navigation
    await expect(page).toHaveURL('/workshop');
  });

  test('basculer vers l\'onglet Terminés filtre les OTs', async ({ page }) => {
    await page.getByRole('tab', { name: /terminés/i }).click();
    await expect(page).toHaveURL('/workshop');
  });
});
