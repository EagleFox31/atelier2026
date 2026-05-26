/**
 * CRUD véhicule — client créé via API, véhicule ajouté via UI fiche client.
 */
import { test, expect } from '@playwright/test';
import { createTestCustomer, getAdminToken } from '../helpers/api';

test.describe('CRUD Véhicules', () => {
  test.setTimeout(180_000);

  test('ajoute un véhicule sur la fiche client', async ({ page, request }) => {
    const tag = String(Date.now());
    const adminToken = await getAdminToken(request);
    const customer = await createTestCustomer(request, adminToken, tag);

    const plate = `LT-${tag.slice(-4)}-PW`;
    await page.goto(`/customers/${customer.id}`);
    await expect(page.getByRole('heading', { name: new RegExp(customer.lastName) })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /nouveau véhicule/i }).click();
    await page.getByPlaceholder('ex: LT-123-AA').fill(plate);
    await page.getByPlaceholder('ex: Toyota').fill('Toyota');
    await page.getByPlaceholder('ex: Hilux').fill('Hilux');
    await page.getByLabel(/kilométrage actuel/i).fill('52000');

    await page.getByRole('button', { name: /enregistrer le véhicule/i }).click();
    await expect(page.getByText('Véhicule enregistré avec succès')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(plate)).toBeVisible({ timeout: 30_000 });
  });

  test('liste les véhicules du parc', async ({ page }) => {
    await page.goto('/vehicles');
    await expect(page.getByRole('heading', { name: /véhicules/i })).toBeVisible();
    await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible();
  });
});
