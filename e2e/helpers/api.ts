import { expect, type APIRequestContext } from '@playwright/test';
import fs from 'fs';
import { ADMIN_USER, type TestUser } from '../fixtures/users';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function loginApi(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { identifier, password },
  });
  expect(res.ok(), `Login failed for ${identifier}: ${await res.text()}`).toBeTruthy();
  const json = await res.json();
  return json.access_token as string;
}

export function readTokenFromAuthFile(user: TestUser): string {
  const state = JSON.parse(fs.readFileSync(user.authFile, 'utf8')) as {
    origins: { origin: string; localStorage: { name: string; value: string }[] }[];
  };
  const origin = state.origins.find((o) => o.localStorage.some((e) => e.name === 'atelier_token'));
  const token = origin?.localStorage.find((e) => e.name === 'atelier_token')?.value;
  if (!token) throw new Error(`Token introuvable dans ${user.authFile}`);
  return token;
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  token: string,
  data?: unknown,
): Promise<T> {
  const res = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(token),
    data: data !== undefined ? data : undefined,
  });
  expect(res.ok(), `${method} ${path} → ${res.status()}: ${await res.text()}`).toBeTruthy();
  if (res.status() === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function randomPhone(): string {
  const n = Math.floor(Math.random() * 90_000_000) + 10_000_000;
  const s = String(n).padStart(8, '0');
  return `+237 6${s[0]}${s[1]} ${s.slice(2, 4)} ${s.slice(4, 6)} ${s.slice(6, 8)}`;
}

export interface TestOtContext {
  otId: string;
  otReference: string;
  customerId: string;
  vehicleId: string;
  quoteId?: string;
}

export async function createTestCustomer(
  request: APIRequestContext,
  token: string,
  tag: string,
): Promise<{ id: string; lastName: string }> {
  const customer = await apiJson<{ id: string; lastName: string }>(
    request,
    'POST',
    '/customers',
    token,
    {
      customerType: 'INDIVIDUAL',
      firstName: 'PW',
      lastName: `E2E${tag}`,
      phonePrimary: randomPhone(),
      email: `pw-e2e-${tag}@test.cm`,
      city: 'Yaoundé',
    },
  );
  return customer;
}

export async function createTestVehicle(
  request: APIRequestContext,
  token: string,
  customerId: string,
  tag: string,
): Promise<{ id: string; plateNumber: string }> {
  return apiJson(request, 'POST', '/vehicles', token, {
    customerId,
    plateNumber: `PW-${tag.slice(-6).toUpperCase()}`,
    year: 2020,
    currentMileage: 45_000,
  });
}

export async function createTestOt(
  request: APIRequestContext,
  token: string,
  tag: string,
): Promise<TestOtContext> {
  const customer = await createTestCustomer(request, token, tag);
  const vehicle = await createTestVehicle(request, token, customer.id, tag);
  const ot = await apiJson<{ id: string; reference: string }>(request, 'POST', '/workshop/ot', token, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    clientComplaint: `Test Playwright ${tag}`,
    priority: 'NORMAL',
  });
  return {
    otId: ot.id,
    otReference: ot.reference,
    customerId: customer.id,
    vehicleId: vehicle.id,
  };
}

async function patchOtStatus(
  request: APIRequestContext,
  token: string,
  otId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<{ status: string }> {
  return apiJson(request, 'PATCH', `/workshop/ot/${otId}/status`, token, { status, ...extra });
}

export async function ensureReceptionCheck(
  request: APIRequestContext,
  token: string,
  otId: string,
): Promise<void> {
  await apiJson(request, 'POST', `/workshop/ot/${otId}/reception-check`, token, {
    mileageAtReception: 45_320,
    fuelLevel: 6,
    globalNotes: 'Réception E2E Playwright',
    checkItems: [],
  });
}

export async function addOtObservation(
  request: APIRequestContext,
  token: string,
  otId: string,
  description = 'Constat technicien E2E',
): Promise<void> {
  await apiJson(request, 'POST', `/workshop/ot/${otId}/observation`, token, {
    description,
    category: 'MECANIQUE',
    severity: 'WARNING',
  });
}

async function createQuoteForOt(
  request: APIRequestContext,
  token: string,
  ctx: TestOtContext,
): Promise<string> {
  const quote = await apiJson<{ id: string }>(request, 'POST', '/billing/quotes', token, {
    serviceOrderId: ctx.otId,
    customerId: ctx.customerId,
    subtotal: 12_000,
    lines: [
      {
        lineType: 'LABOR',
        description: 'Main d\'œuvre test E2E',
        quantity: 1,
        unitPriceXaf: 12_000,
      },
    ],
  });
  ctx.quoteId = quote.id;
  return quote.id;
}

async function createInvoiceForQuote(
  request: APIRequestContext,
  token: string,
  quoteId: string,
): Promise<{ id: string }> {
  return apiJson(request, 'POST', `/billing/invoice/from-quote/${quoteId}`, token, {});
}

/**
 * Prépare un OT jusqu'au statut cible (via API admin).
 */
export async function advanceOtToStatus(
  request: APIRequestContext,
  adminToken: string,
  ctx: TestOtContext,
  targetStatus: string,
): Promise<TestOtContext> {
  const order = ['DRAFT', 'RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_APPROVED', 'IN_PROGRESS', 'QC_PENDING', 'READY', 'INVOICED', 'CLOSED'];
  const targetIdx = order.indexOf(targetStatus);
  if (targetIdx < 0) throw new Error(`Statut inconnu: ${targetStatus}`);

  let currentIdx = 0;

  while (currentIdx < targetIdx) {
    const next = order[currentIdx + 1]!;

    if (next === 'RECEIVED') {
      await ensureReceptionCheck(request, adminToken, ctx.otId);
      await patchOtStatus(request, adminToken, ctx.otId, 'RECEIVED');
    } else if (next === 'QUOTE_PENDING') {
      await patchOtStatus(request, adminToken, ctx.otId, 'QUOTE_PENDING');
    } else if (next === 'QUOTE_APPROVED') {
      await patchOtStatus(request, adminToken, ctx.otId, 'QUOTE_APPROVED');
    } else if (next === 'INVOICED') {
      await patchOtStatus(request, adminToken, ctx.otId, 'INVOICED');
    } else {
      await patchOtStatus(request, adminToken, ctx.otId, next);
    }

    currentIdx += 1;
  }

  return ctx;
}

export async function getAdminToken(request: APIRequestContext): Promise<string> {
  try {
    return readTokenFromAuthFile(ADMIN_USER);
  } catch {
    return loginApi(request, ADMIN_USER.email, ADMIN_USER.password);
  }
}

export async function prepareOtAtStatus(
  request: APIRequestContext,
  targetStatus: string,
  tag?: string,
  assignToChefId?: string,
): Promise<TestOtContext> {
  const adminToken = await getAdminToken(request);
  const ctx = await createTestOt(request, adminToken, tag ?? String(Date.now()));
  if (targetStatus !== 'DRAFT') {
    await advanceOtToStatus(request, adminToken, ctx, targetStatus);
  }
  if (assignToChefId) {
    await apiJson(request, 'PATCH', `/workshop/ot/${ctx.otId}/assign`, adminToken, {
      assignedChefId: assignToChefId,
    });
  }
  return ctx;
}

export async function getAuthProfile(
  request: APIRequestContext,
  token: string,
): Promise<{ id: string }> {
  return apiJson(request, 'GET', '/auth/profile', token);
}
