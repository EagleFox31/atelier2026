import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3005';

// Get token + DRAFT OT via direct API
const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@atelier.cm', password: 'Atelier2026!' }),
});
const { access_token, user } = await loginRes.json();

const otsRes = await fetch('http://127.0.0.1:3001/api/workshop/ot?status=DRAFT', {
  headers: { Authorization: `Bearer ${access_token}` },
});
const ots = await otsRes.json();
const otId = ots[0]?.id;
console.log('Using OT:', ots[0]?.reference, 'id:', otId);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);

// Set localStorage BEFORE any navigation via addInitScript
await context.addInitScript(({ token, userData }) => {
  localStorage.setItem('atelier_token', token);
  localStorage.setItem('atelier_user', JSON.stringify(userData));
}, { token: access_token, userData: user });

// Navigate — use 'commit' so we don't wait for API calls to complete
await page.goto(`${BASE}/workshop/${otId}`, { waitUntil: 'commit', timeout: 30000 });
// Now wait for React to hydrate and render content (not for API calls)
await page.waitForSelector('h1, [class*="reference"], .font-mono', { timeout: 20000 });
await page.waitForTimeout(2000);

// Dismiss onboarding modal if present
const passerBtn = page.getByRole('button', { name: /Passer/i });
if (await passerBtn.count() > 0) {
  await passerBtn.click();
  await page.waitForTimeout(800);
  console.log('Onboarding dismissed');
}
await page.waitForTimeout(500);

await page.screenshot({ path: 'C:/Users/jakaa/AppData/Local/Temp/screen_ot_detail.png' });
console.log('OT detail saved');

const btns = await page.$$eval('button', els => els.map(e => e.textContent?.trim()).filter(Boolean));
console.log('Buttons:', btns);

// Click "→ Reçu"
const recuBtn = page.getByRole('button', { name: /Reçu/i });
if (await recuBtn.count() > 0) {
  await recuBtn.first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/jakaa/AppData/Local/Temp/screen_dialog_open.png' });
  console.log('Dialog screenshot saved');

  const viewport = await page.$('[data-radix-scroll-area-viewport]');
  if (viewport) {
    await viewport.evaluate(el => el.scrollTop += 280);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/jakaa/AppData/Local/Temp/screen_dialog_scrolled.png' });
    console.log('Scrolled dialog screenshot saved');
  }
} else {
  console.log('No "Reçu" button');
}

await browser.close();
console.log('Done');
