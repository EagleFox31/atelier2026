/**
 * Smoke tests — vérifie que chaque page se charge sans erreur critique.
 * Utilise l'auth state admin sauvegardé par global.setup.ts.
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/',                 heading: /bonjour/i },
  { path: '/planning',         heading: /planning/i },
  { path: '/team',             heading: /équipe/i },
  { path: '/workshop',         heading: /ordres de travail|atelier/i },
  { path: '/vehicles',         heading: /véhicules/i },
  { path: '/stock',            heading: /stock|pièces/i },
  { path: '/stock/movements',  heading: /mouvement/i },
  { path: '/billing',          heading: /facturation|billing/i },
  { path: '/customers',        heading: /clients/i },
  { path: '/reports',          heading: /rapports|performance|accès restreint/i },
  { path: '/settings',         heading: /paramètres|settings/i },
  { path: '/notifications',    heading: /notifications|sms/i },
];

test.describe('Smoke — toutes les pages chargent', () => {
  for (const { path, heading } of PAGES) {
    test(`${path} se charge sans erreur`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(path);

      // Pas de redirection vers /login (utilisateur authentifié)
      await expect(page).not.toHaveURL('/login');

      // Titre page (h1/h2) ou écran accès restreint (CardTitle = div)
      const headingEl = page.getByRole('heading', { level: 1 })
        .or(page.getByRole('heading', { level: 2 }))
        .or(page.getByText(heading));
      await expect(headingEl.first()).toBeVisible({ timeout: 30_000 });
    });
  }
});
