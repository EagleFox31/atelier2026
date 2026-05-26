/**
 * Smoke + transitions OT autorisées pour le réceptionniste.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { ROLE_SMOKE_PAGES } from './shared-pages';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  expectForbiddenTransition,
  transitionToReceivedViaModal,
} from '../helpers/workshop-ui';
import { prepareOtAtStatus } from '../helpers/api';

test.use({ storageState: path.join(__dirname, '../../playwright/.auth/reception.json') });

test.describe('Profil Réceptionniste', () => {
  test.setTimeout(180_000);

  for (const { path: pagePath, heading } of ROLE_SMOKE_PAGES) {
    test(`${pagePath} se charge`, async ({ page }) => {
      await page.goto(pagePath);
      await expect(page).not.toHaveURL('/login');
      await expect(
        page.getByRole('heading', { level: 1 }).or(page.getByText(heading)).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  }

  test('peut réceptionner un OT (DRAFT → Reçu)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'DRAFT', `rec-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await transitionToReceivedViaModal(page);
  });

  test('ne peut pas passer en En diagnostic (RECEIVED → En diagnostic)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'RECEIVED', `rec-deny-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'En diagnostic');
    await expectForbiddenTransition(page, 'Reçu');
  });
});
