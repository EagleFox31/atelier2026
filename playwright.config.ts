import { defineConfig, devices } from '@playwright/test';

const reuseServer = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 180_000,
  reporter: [['html', { outputFolder: 'reports/playwright' }], ['list']],

  use: {
    // Aligné sur npm run dev:next (3005). npm run dev utilise 3000 — lancer dev:next ou laisser webServer démarrer.
    baseURL: 'http://localhost:3005',
    storageState: 'playwright/.auth/admin.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3001/api/docs',
      reuseExistingServer: reuseServer,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:next',
      url: 'http://localhost:3005/login',
      reuseExistingServer: reuseServer,
      timeout: 120_000,
      env: { BACKEND_URL: 'http://localhost:3001' },
    },
  ],
});
