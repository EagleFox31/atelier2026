import { test, expect } from '@playwright/test';
import path from 'path';
import { ROLE_SMOKE_PAGES } from './shared-pages';
import { prepareOtAtStatus, getAdminToken, addOtObservation } from '../helpers/api';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  expectForbiddenTransition,
} from '../helpers/workshop-ui';

test.use({ storageState: path.join(__dirname, '../../playwright/.auth/chef.json') });

test.describe('Profil Chef d\'atelier', () => {
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

  test('peut valider le devis OT (DIAGNOSING → Devis en attente + page devis)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'DIAGNOSING', `chef-quote-${Date.now()}`);
    const adminToken = await getAdminToken(request);
    await addOtObservation(request, adminToken, ctx.otId);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Générer un devis');
    await expect(page).toHaveURL(new RegExp(`/billing/quotes/new\\?serviceOrderId=${ctx.otId}`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Nouveau devis/i })).toBeVisible();
    await expect(page.getByText(/Constats technicien/i)).toBeVisible();
    await expect(page.getByText(/Devis en attente/i)).toBeVisible();
  });

  test('peut valider le QC et marquer prêt (QC_PENDING → Prêt)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'QC_PENDING', `chef-ready-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Valider le contrôle qualité');
    await expectSuccessTransition(page, 'Prêt');
  });

  test('ne peut pas facturer (READY → Facturé)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'READY', `chef-deny-inv-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Facturé');
    await expectForbiddenTransition(page, 'Prêt');
  });
});
