/**
 * CRUD client — création via UI, lecture liste + fiche détail.
 */
import { test, expect } from '@playwright/test';

test.describe('CRUD Clients', () => {
  test.setTimeout(180_000);

  test('crée un client et le retrouve dans la liste', async ({ page }) => {
    const tag = Date.now();
    const fullName = `Playwright Client ${tag}`;
    const email = `pw-client-${tag}@test.cm`;
    const phone = '+237 670 11 22 33';

    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /nouveau client/i }).click();
    await page.getByPlaceholder('ex: Saliou Diallo').fill(fullName);
    await page.getByPlaceholder('client@email.cm').fill(email);
    await page.getByPlaceholder('+237 6XX XX XX XX').fill(phone);
    await page.getByPlaceholder('ex: Bastos, Yaoundé').fill('Bastos, Yaoundé');

    await page.getByRole('button', { name: /enregistrer le client/i }).click();
    await expect(page.getByText('Client enregistré avec succès')).toBeVisible({ timeout: 30_000 });

    await page.getByPlaceholder(/rechercher par nom/i).fill(email);
    await page.waitForTimeout(400);
    await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 30_000 });
    await page.locator('tr', { hasText: email }).click();

    await expect(page).toHaveURL(/\/customers\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(String(tag));
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
  });

  test('recherche un client existant (seed)', async ({ page }) => {
    await page.goto('/customers');
    await page.getByPlaceholder(/rechercher par nom/i).fill('Kengne');
    await expect(page.getByText(/Kengne/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
