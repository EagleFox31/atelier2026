import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-qa',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 60_000,
  reporter: [['html', { outputFolder: 'reports/playwright-qa', open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://atelier.trigenys.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
