import { test as setup, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { TEST_USERS } from './fixtures/users';

const authDir = path.join(__dirname, '../playwright/.auth');
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api';
const APP_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3005';

for (const user of TEST_USERS) {
  setup(`authenticate as ${user.id}`, async ({ browser }) => {
    const api = await playwrightRequest.newContext();
    const loginRes = await api.post(`${API_BASE}/auth/login`, {
      data: { identifier: user.email, password: user.password },
    });
    expect(loginRes.ok(), `Login API ${user.email}: ${await loginRes.text()}`).toBeTruthy();
    const { access_token: token } = await loginRes.json();

    const profileRes = await api.get(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profileRes.ok()).toBeTruthy();
    const profile = await profileRes.json();

    await api.patch(`${API_BASE}/auth/onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await api.dispose();

    const context = await browser.newContext({ baseURL: APP_BASE });
    const page = await context.newPage();
    await page.goto('/login');
    await page.evaluate(
      ({ token, profile }) => {
        localStorage.setItem('atelier_token', token);
        localStorage.setItem('atelier_user', JSON.stringify({
          ...profile,
          onboardingCompletedAt: new Date().toISOString(),
        }));
      },
      { token, profile },
    );

    fs.mkdirSync(authDir, { recursive: true });
    await context.storageState({ path: user.authFile });
    await context.close();
  });
}
