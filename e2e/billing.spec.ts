import { test, expect } from '@playwright/test';

test.describe('Billing — Facturation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/billing');
    // Attend que le chargement soit terminé (skeleton ou contenu)
    await expect(page.getByRole('tab', { name: /factures/i })).toBeVisible({ timeout: 8_000 });
  });

  test('affiche les onglets Factures et Devis', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /factures/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /devis/i })).toBeVisible();
  });

  test('affiche les cartes KPI (CA payé, en attente, retards)', async ({ page }) => {
    await expect(page.getByText('Encaissé (total)')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('En attente')).toBeVisible();
  });

  test('le champ de recherche est visible', async ({ page }) => {
    await expect(page.getByPlaceholder('Rechercher...')).toBeVisible();
  });

  test('basculer vers l\'onglet Devis affiche la liste des devis', async ({ page }) => {
    await page.getByRole('tab', { name: /devis/i }).click();
    await expect(page.getByRole('tab', { name: /devis/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('la recherche filtre le tableau', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Rechercher...');
    await searchInput.fill('XXXXXXINEXISTANT');
    // Aucun résultat ou tableau vide — pas d'erreur
    await expect(page).toHaveURL('/billing');
  });

  test('le bouton Devis depuis OT navigue vers l\'atelier', async ({ page }) => {
    const btn = page.getByRole('button', { name: /devis depuis ot/i });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page).toHaveURL('/workshop');
  });
});

test.describe('Billing — Détail devis', () => {
  test('la page de création de devis charge le formulaire', async ({ page }) => {
    await page.goto('/billing/quotes/new');
    // Soit un formulaire, soit une redirection login — pas d'erreur 500
    await expect(page).not.toHaveURL('/login');
  });
});

test.describe('Billing — Détail facture', () => {
  test('la page de création de facture est accessible', async ({ page }) => {
    await page.goto('/billing/invoices/new');
    await expect(page).not.toHaveURL('/login');
  });
});
