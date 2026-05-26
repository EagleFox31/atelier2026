/**
 * Workflow OT complet — admin, transitions UI sur le cycle principal.
 * Le devis est créé via API (UI création devis non branchée).
 */
import { test, expect } from '@playwright/test';
import {
  createTestOt,
  getAdminToken,
  addOtObservation,
  type TestOtContext,
} from '../helpers/api';
import {
  gotoOtDetail,
  clickOtTransition,
  expectSuccessTransition,
  expectOtStatusBadge,
  transitionToReceivedViaModal,
} from '../helpers/workshop-ui';

test.describe.serial('Workflow OT — cycle complet admin', () => {
  test.setTimeout(180_000);
  let ctx: TestOtContext;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await getAdminToken(request);
    ctx = await createTestOt(request, adminToken, `wf-${Date.now()}`);
  });

  test('1. Réception véhicule (DRAFT → Reçu)', async ({ page }) => {
    await gotoOtDetail(page, ctx.otId);
    await expectOtStatusBadge(page, 'Brouillon');
    await transitionToReceivedViaModal(page);
  });

  test('2. En diagnostic (Reçu → En diagnostic)', async ({ page }) => {
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'En diagnostic');
    await expectSuccessTransition(page, 'En diagnostic');
  });

  test('3. Devis en attente (En diagnostic → page création devis)', async ({ page, request }) => {
    await gotoOtDetail(page, ctx.otId);
    await addOtObservation(request, adminToken, ctx.otId);
    await clickOtTransition(page, 'Générer un devis');
    await expect(page).toHaveURL(new RegExp(`/billing/quotes/new\\?serviceOrderId=${ctx.otId}`), { timeout: 30_000 });
    await expect(page.getByText(/Devis en attente/i)).toBeVisible();
  });

  test('4. Création devis via API + approbation OT', async ({ page, request }) => {
    await request.post('http://localhost:3001/api/billing/quotes', {
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      data: {
        serviceOrderId: ctx.otId,
        customerId: ctx.customerId,
        subtotal: 15_000,
        lines: [
          { lineType: 'LABOR', description: 'Vidange + filtres', quantity: 1, unitPriceXaf: 15_000 },
        ],
      },
    });

    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Devis approuvé');
    await expectSuccessTransition(page, 'Devis approuvé');
  });

  test('5. Travaux + QC (En cours → QC → Prêt)', async ({ page }) => {
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'En cours');
    await expectSuccessTransition(page, 'En cours');

    await clickOtTransition(page, 'Contrôle qualité');
    await expectSuccessTransition(page, 'Contrôle qualité');

    await clickOtTransition(page, 'QC validé');
    await expectSuccessTransition(page, 'QC validé');

    await clickOtTransition(page, 'Prêt');
    await expectSuccessTransition(page, 'Prêt');
  });

  test('6. Facturation et clôture (Prêt → Facturé → Clôturé)', async ({ page }) => {
    await gotoOtDetail(page, ctx.otId);
    await clickOtTransition(page, 'Facturé');
    await expectSuccessTransition(page, 'Facturé');

    await clickOtTransition(page, 'Clôturé');
    await expectSuccessTransition(page, 'Clôturé');
  });

  test('7. OT visible comme clôturé dans la liste atelier', async ({ page }) => {
    await page.goto('/workshop');
    await page.getByPlaceholder(/rechercher/i).fill(ctx.otReference);
    await expect(page.getByText(ctx.otReference)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Clôturé').first()).toBeVisible();
  });
});
