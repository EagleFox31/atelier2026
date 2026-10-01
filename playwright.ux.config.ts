import { defineConfig, devices } from '@playwright/test';

/**
 * Garde-fous UX/UI/CX AVANT merge (workflow ux-guardrails.yml, PR touchant le front).
 * L'API est entièrement simulée via page.route (e2e-ux/) : ni base ni NestJS requis.
 * Complément de e2e-qa/ (playwright.qa.config.ts), qui teste la prod chaque matin.
 *
 * Port dédié pour ne pas entrer en collision avec un `npm run dev` local (3000).
 * En CI : build de production + `next start` (déterministe, valide aussi le build).
 */
const PORT = Number(process.env.UX_PORT ?? 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e-ux',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-ux', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? `npm run build && npx next start --port ${PORT}`
          : `npx next dev --port ${PORT}`,
        url: `${BASE_URL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 600_000,
      },
});
