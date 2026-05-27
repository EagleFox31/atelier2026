import { test, expect } from '@playwright/test';
import path from 'path';
import { ROLE_SMOKE_PAGES } from './shared-pages';
import { prepareOtAtStatus } from '../helpers/api';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  expectForbiddenTransition,
} from '../helpers/workshop-ui';

test.use({ storageState: path.join(__dirname, '../../playwright/.auth/caissier.json') });

test.describe('Profil Caissier', () => {
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

  test('ne peut pas lancer le diagnostic (RECEIVED → En diagnostic)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'RECEIVED', `caisse-deny-diag-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'En diagnostic');
    await expectForbiddenTransition(page, 'Reçu');
  });

  test('ne facture pas — pas de bouton Facturer sur OT prêt', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'READY', `caisse-deny-inv-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await expect(page.getByRole('button', { name: 'Facturer' })).not.toBeVisible();
  });

  test('peut clôturer (INVOICED → Clôturé)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'INVOICED', `caisse-close-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, "Clôturer l'OT");
    await expectSuccessTransition(page, 'Clôturé');
  });
});
