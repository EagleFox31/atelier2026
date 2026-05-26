import { test, expect } from '@playwright/test';
import path from 'path';
import { ROLE_SMOKE_PAGES } from './shared-pages';
import { prepareOtAtStatus, getAuthProfile, readTokenFromAuthFile } from '../helpers/api';
import { TEST_USERS } from '../fixtures/users';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  expectForbiddenTransition,
} from '../helpers/workshop-ui';

const TECH_USER = TEST_USERS.find((u) => u.id === 'technicien')!;

async function prepareAssignedOt(
  request: import('@playwright/test').APIRequestContext,
  status: string,
  tag: string,
) {
  const techToken = readTokenFromAuthFile(TECH_USER);
  const profile = await getAuthProfile(request, techToken);
  return prepareOtAtStatus(request, status, tag, profile.id);
}

test.use({ storageState: path.join(__dirname, '../../playwright/.auth/technicien.json') });

test.describe('Profil Technicien', () => {
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

  test('ne peut pas réceptionner (DRAFT → Reçu)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'DRAFT', `tech-deny-rec-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Reçu');
    await expectForbiddenTransition(page, 'Brouillon');
  });

  test('peut lancer le diagnostic (RECEIVED → En diagnostic)', async ({ page, request }) => {
    const ctx = await prepareAssignedOt(request, 'RECEIVED', `tech-diag-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'En diagnostic');
    await expectSuccessTransition(page, 'En diagnostic');
  });

  test('ne peut pas créer le devis (DIAGNOSING → Devis en attente)', async ({ page, request }) => {
    const ctx = await prepareOtAtStatus(request, 'DIAGNOSING', `tech-deny-quote-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Devis en attente');
    await expectForbiddenTransition(page, 'En diagnostic');
  });

  test('peut envoyer en QC (IN_PROGRESS → Contrôle qualité)', async ({ page, request }) => {
    const ctx = await prepareAssignedOt(request, 'IN_PROGRESS', `tech-qc-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Contrôle qualité');
    await expectSuccessTransition(page, 'Contrôle qualité');
  });

  test('peut lancer les travaux (QUOTE_APPROVED → Travaux en cours)', async ({ page, request }) => {
    const ctx = await prepareAssignedOt(request, 'QUOTE_APPROVED', `tech-start-${Date.now()}`);
    await gotoOtDetail(page, ctx.otId);
    await page.getByRole('button', { name: 'Lancer les travaux' }).click();
    await expectSuccessTransition(page, 'En cours');
  });
});
