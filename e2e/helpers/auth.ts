import { expect, type Page } from '@playwright/test';
import type { TestUser } from '../fixtures/users';

export async function dismissOnboarding(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Passer' });
  if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skip.click();
  }
}

export async function loginUser(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await expect(page.getByPlaceholder('admin@atelier.cm ou EMP-001')).toBeVisible();

  await page.getByPlaceholder('admin@atelier.cm ou EMP-001').fill(user.email);
  await page.getByPlaceholder('••••••••').click();
  await page.getByPlaceholder('••••••••').fill(user.password);
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('/', { timeout: 90_000, waitUntil: 'domcontentloaded' });

  await dismissOnboarding(page);
}
