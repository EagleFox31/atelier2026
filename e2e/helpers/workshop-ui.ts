import { expect, type Page } from '@playwright/test';

export async function gotoOtDetail(page: Page, otId: string): Promise<void> {
  await page.goto(`/workshop/${otId}`);
  await expect(page.locator('h1.font-mono')).toBeVisible({ timeout: 30_000 });
}

export async function clickOtTransition(page: Page, statusLabel: string): Promise<void> {
  await page.getByRole('button', { name: `→ ${statusLabel}` }).click();
}

/** Ouvre la modale réception et valide le passage en Reçu (UI récente). */
export async function transitionToReceivedViaModal(page: Page): Promise<void> {
  await clickOtTransition(page, 'Reçu');
  await expect(page.getByRole('dialog', { name: /Fiche de réception/i })).toBeVisible({ timeout: 15_000 });
  await page.locator('#mileage').fill('45320');
  await page.getByRole('button', { name: /Enregistrer et passer en Reçu/i }).click();
  await expectSuccessTransition(page, 'Reçu');
}

export async function expectOtStatusBadge(page: Page, statusLabel: string): Promise<void> {
  const badge = page.locator('h1.font-mono').locator('xpath=ancestor::div[contains(@class,"flex-wrap")]')
    .locator('[class*="font-bold"]').filter({ hasText: statusLabel });
  await expect(badge.first()).toBeVisible({ timeout: 15_000 });
}

export async function expectSuccessTransition(page: Page, statusLabel: string): Promise<void> {
  await expect(page.getByText(new RegExp(`Statut → ${statusLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeVisible({
    timeout: 30_000,
  });
  await expectOtStatusBadge(page, statusLabel);
}

export async function expectForbiddenTransition(page: Page, currentStatusLabel: string): Promise<void> {
  await expect(page.getByText(/Accès refusé|n'avez pas le rôle/i)).toBeVisible({ timeout: 30_000 });
  await expectOtStatusBadge(page, currentStatusLabel);
}
