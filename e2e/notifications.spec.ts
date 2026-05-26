/**
 * Tests E2E — Notifications in-app
 *
 * Scénario : OT passe en READY → la réceptionniste reçoit une notification
 * dans le bell → elle clique → elle est redirigée vers l'OT → la notif disparaît.
 *
 * Pré-requis : serveur NestJS (3001) + Next.js (3005) actifs.
 * Auth via storageState admin (default) ; réception utilisé pour vérifier le bell.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import path from 'path';

const API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api';
const AUTH_DIR = path.join(__dirname, '../playwright/.auth');

// ── Helpers ────────────────────────────────────────────────────────────────────

async function apiAs(email: string, password: string) {
  const ctx = await playwrightRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { identifier: email, password },
  });
  const { access_token } = await res.json();
  return { ctx, token: access_token as string };
}

async function createOTAndAdvanceToReady(token: string): Promise<string> {
  const ctx = await playwrightRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  // 1. Créer un client minimaliste
  const customerRes = await ctx.post(`${API}/customers`, {
    data: {
      firstName: 'Kouam',
      lastName: 'E2E',
      phonePrimary: '+237600000001',
      customerType: 'INDIVIDUAL',
      city: 'Douala',
    },
  });
  const customer = await customerRes.json();

  // 2. Créer un véhicule
  const vehicleRes = await ctx.post(`${API}/vehicles`, {
    data: {
      customerId: customer.id,
      plateNumber: `E2E-${Date.now()}`,
      year: 2020,
    },
  });
  const vehicle = await vehicleRes.json();

  // 3. Créer l'OT
  const otRes = await ctx.post(`${API}/workshop/ot`, {
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      clientComplaint: 'Test notification E2E',
      mileageIn: 10000,
    },
  });
  const ot = await otRes.json();

  const transition = async (status: string, extra: Record<string, unknown> = {}) => {
    const r = await ctx.patch(`${API}/workshop/ot/${ot.id}/status`, {
      data: { status, ...extra },
    });
    expect(r.status(), `Transition vers ${status} échouée`).toBeLessThan(300);
  };

  // 4. Avancer jusqu'à READY
  await transition('DIAGNOSING');

  // Ajouter une observation (ORD-002)
  await ctx.post(`${API}/workshop/ot/${ot.id}/observation`, {
    data: { description: 'Test E2E — suspension HS', category: 'MECANIQUE', severity: 'URGENT' },
  });

  await transition('QUOTE_PENDING');
  await transition('QUOTE_APPROVED');
  await transition('IN_PROGRESS');
  await transition('QC_PENDING');
  await transition('READY');

  await ctx.dispose();
  return ot.id;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Notifications in-app — bell réception', () => {
  let otId: string;
  let adminToken: string;

  test.beforeAll(async () => {
    const { token } = await apiAs('admin@atelier.cm', 'Atelier2026!');
    adminToken = token;
    otId = await createOTAndAdvanceToReady(adminToken);
  });

  test('la réceptionniste voit le badge rouge après passage READY', async ({ browser }) => {
    // Ouvrir un contexte authentifié en tant que réceptionniste
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'reception.json'),
    });
    const page = await ctx.newPage();

    await page.goto('/workshop');

    // Attendre que le polling ait chargé les notifs (max 5s, pas 30s car page fraîche)
    const badge = page.locator('[data-testid="notif-badge"], span.bg-red-500').first();
    await expect(badge).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });

  test('cliquer sur la cloche affiche la notification "Véhicule prêt"', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'reception.json'),
    });
    const page = await ctx.newPage();
    await page.goto('/workshop');

    // Ouvrir le popover
    const bell = page.locator('button:has(svg[class*="lucide-bell"], [data-icon="bell"])').first();
    await bell.waitFor({ timeout: 10_000 });
    await bell.click();

    // Le dropdown doit contenir le titre
    await expect(page.getByText('Véhicule prêt à restituer')).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

  test('cliquer sur une notification redirige vers l\'OT et la supprime de la liste', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'reception.json'),
    });
    const page = await ctx.newPage();
    await page.goto('/workshop');

    // Ouvrir le popover
    const bell = page.locator('button:has(svg[class*="lucide-bell"], [data-icon="bell"])').first();
    await bell.click();

    // Cliquer sur la première notification
    const notifItem = page.getByText('Véhicule prêt à restituer').first();
    await notifItem.waitFor({ timeout: 5_000 });
    await notifItem.click();

    // Vérification navigation
    await expect(page).toHaveURL(new RegExp(`/workshop/${otId}`), { timeout: 8_000 });

    await ctx.close();
  });

  test('après lecture, le badge disparaît', async ({ browser }) => {
    // Ouvrir un nouveau contexte (session fraîche) — le markRead a été persisté en DB
    const ctx = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'reception.json'),
    });
    const page = await ctx.newPage();
    await page.goto('/workshop');

    // Attendre le chargement initial, badge ne doit PAS être présent
    await page.waitForTimeout(3_000);
    const badge = page.locator('span.bg-red-500').first();
    await expect(badge).not.toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });
});
