/**
 * Admin — transitions OT complètes (RBAC bypass via rôle ADMIN).
 */
import { test, expect } from '@playwright/test';
import { ROLE_SMOKE_PAGES } from './shared-pages';
import { prepareOtAtStatus } from '../helpers/api';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  transitionToReceivedViaModal,
} from '../helpers/workshop-ui';

test.describe('Profil Admin — RBAC OT', () => {
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

  test('enchaîne DRAFT → Reçu → En diagnostic', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'DRAFT', `admin-flow-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);

    await transitionToReceivedViaModal(page);

    await clickOtTransition(page, 'En diagnostic');
    await expectSuccessTransition(page, 'En diagnostic');
  });

  test('peut facturer et clôturer (READY → Facturé → Clôturé)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'READY', `admin-bill-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);

    await clickOtTransition(page, 'Facturé');
    await expectSuccessTransition(page, 'Facturé');

    await clickOtTransition(page, 'Clôturé');
    await expectSuccessTransition(page, 'Clôturé');
  });
});
