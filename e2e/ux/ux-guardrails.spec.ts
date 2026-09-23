import { expect, test, type Page } from '@playwright/test';

const PROFILE = {
  id: 'user-ux-admin',
  firstName: 'Test',
  lastName: 'Admin',
  email: 'test@example.com',
  employeeCode: 'test.admin',
  status: 'ACTIVE',
  roles: ['ADMIN'],
  permissions: ['ORD_VIEW', 'ORD_CREATE', 'VEH_VIEW', 'VEH_CREATE'],
  onboardingCompletedAt: '2026-09-23T08:00:00.000Z',
  tenantId: 'tenant-ux',
  garageId: 'garage-ux',
  garage: { id: 'garage-ux', name: 'Garage UX', slug: 'principal' },
  tenant: { id: 'tenant-ux', name: 'Garage UX', slug: 'garage-ux' },
};

const SETTINGS = {
  id: 'garage_garage-ux',
  garageId: 'garage-ux',
  logoUrl: null,
  shopName: 'Garage UX',
  tagline: 'Garage automobile — Douala',
  niu: null,
  email: 'garage@example.com',
  phone: '690000000',
  address: 'Douala',
  defaultLaborRateXaf: 15000,
  taxRatePct: 19.25,
  updatedAt: '2026-09-23T08:00:00.000Z',
};

async function mockPublicSignup(page: Page) {
  await page.route('**/api/public/signup/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
  });
}

async function mockAuthenticatedApp(
  page: Page,
  options: {
    auditLogs?: unknown[];
    trial?: boolean;
    customerCreate?: boolean;
  } = {},
) {
  await page.addInitScript((profile) => {
    localStorage.setItem('atelier_token', 'ux-token');
    localStorage.setItem('atelier_user', JSON.stringify(profile));
  }, PROFILE);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/auth/profile') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE) });
    }
    if (path === '/api/subscription/status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: options.trial === false ? 'ACTIVE' : 'TRIAL',
          plan: 'pro',
          trialStartedAt: '2026-09-23T08:00:00.000Z',
          trialEndsAt: '2026-10-23T08:00:00.000Z',
          graceEndsAt: '2026-10-30T08:00:00.000Z',
          subscriptionStartedAt: null,
          subscriptionEndsAt: null,
          dataRetentionEndsAt: '2027-01-21T08:00:00.000Z',
          daysRemaining: 30,
          readOnly: false,
          blocked: false,
        }),
      });
    }
    if (path === '/api/settings/workshop' && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) });
    }
    if (path === '/api/notifications/unread-count') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
    }
    if (path === '/api/notifications/inbox') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (path === '/api/audit') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.auditLogs ?? []),
      });
    }
    if (path === '/api/customers' && method === 'POST' && options.customerCreate) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'customer-new',
          customerType: 'INDIVIDUAL',
          firstName: 'Jean',
          lastName: 'Mbarga',
          phonePrimary: '+237690000000',
        }),
      });
    }

    const arrayEndpoints = [
      '/api/team',
      '/api/customers',
      '/api/vehicles',
      '/api/workshop/ot',
      '/api/reports/targets',
      '/api/billing/quotes',
      '/api/billing/invoices',
      '/api/stock/parts',
      '/api/planning/appointments',
    ];
    if (arrayEndpoints.some((endpoint) => path.startsWith(endpoint))) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

function signupDraft(step: 2 | 3) {
  return {
    step,
    adminData: {
      firstName: 'Test',
      lastName: 'Admin',
      email: 'test@example.com',
      phone: '690000000',
      password: 'Atelier2026!',
      confirmPassword: 'Atelier2026!',
    },
    workshopData: {
      shopName: 'Garage UX',
      tagline: '',
      niu: '',
      email: 'garage@example.com',
      phone: '690000000',
      address: 'Bonapriso',
      city: '',
      defaultLaborRateXaf: '15000',
    },
    selectedRoles: [],
    teamDrafts: {},
  };
}

test.describe('Atelier Maître — garde-fous UX/UI/CX', () => {
  test('les tarifs présentent le pilote comme une vraie 4e carte sans doublon', async ({ page }) => {
    await page.goto('/#tarifs');

    await expect(page.getByText('Atelier Maître Pilote', { exact: true })).toBeVisible();
    await expect(page.getByText('Atelier Maître Essentiel', { exact: true })).toBeVisible();
    await expect(page.getByText('Atelier Maître Pro', { exact: true })).toBeVisible();
    await expect(page.getByText('Atelier Maître Business', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tester 30 jours gratuitement/i })).toHaveCount(1);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('la ville recherche dès le premier caractère et tolère une faute de frappe', async ({ page }) => {
    await mockPublicSignup(page);
    await page.addInitScript((draft) => {
      sessionStorage.setItem('atelier_signup_draft_v1', JSON.stringify(draft));
    }, signupDraft(2));

    await page.goto('/inscription');
    const city = page.getByPlaceholder('Saisissez une ville…');
    await expect(city).toBeVisible();

    await city.fill('B');
    await expect(page.getByText('Bafoussam', { exact: true })).toBeVisible();

    await city.fill('Bertuo');
    await expect(page.getByText('Bertoua', { exact: true })).toBeVisible();
  });

  test('la création équipe explique le clic sur les cartes et survit à un refresh', async ({ page }) => {
    await mockPublicSignup(page);
    await page.addInitScript((draft) => {
      sessionStorage.setItem('atelier_signup_draft_v1', JSON.stringify(draft));
    }, signupDraft(3));

    await page.goto('/inscription');
    await expect(page.getByText(/Cliquez sur une carte pour ajouter ce profil/i)).toBeVisible();
    await expect(page.getByText(/Super Admin réservé/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Technicien/i }).click();
    await page.getByPlaceholder('Prénom').fill('Norom');
    await page.getByPlaceholder('Nom').fill('Gandi');

    await page.reload();
    await expect(page.getByPlaceholder('Prénom')).toHaveValue('Norom');
    await expect(page.getByPlaceholder('Nom')).toHaveValue('Gandi');
  });

  test('Créer et sélectionner garde immédiatement le nouveau client sans rechargement', async ({ page }) => {
    await mockAuthenticatedApp(page, { customerCreate: true, trial: true });
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });

    await page.goto('/workshop');
    await page.getByRole('button', { name: /Nouvel OT/i }).click();

    const customerSearch = page.getByPlaceholder('Téléphone ou nom du client…');
    await customerSearch.fill('samuel');
    await expect(page.getByText(/Aucun résultat pour « samuel »/i)).toBeVisible();

    await page.getByPlaceholder('Jean').fill('Jean');
    await page.getByPlaceholder('Mbarga').fill('Mbarga');
    await page.getByPlaceholder('+237 6XX XX XX XX').fill('+237690000000');
    await page.getByRole('button', { name: 'Créer et sélectionner' }).click();

    await expect(page.getByText('Jean Mbarga', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Plaque ou modèle…')).toBeEnabled();
    expect(navigations).toBe(1);
  });

  test('le journal d’audit n’expose plus les codes techniques avec underscores', async ({ page }) => {
    await mockAuthenticatedApp(page, {
      auditLogs: [
        {
          id: 'audit-1',
          action: 'STATUS_CHANGE',
          entityType: 'service_orders',
          entityId: '12345678-aaaa-bbbb-cccc-123456789012',
          performedAt: '2026-09-23T08:30:00.000Z',
          performer: { firstName: 'Test', lastName: 'Admin' },
          fieldChanges: {
            status: { from: 'QUOTE_PENDING', to: 'IN_PROGRESS' },
          },
          metadata: { reason: 'Devis validé par le client' },
        },
      ],
    });

    await page.goto('/audit');
    await expect(page.getByText('Changement de statut', { exact: true })).toBeVisible();
    await expect(page.getByText(/Statut : Devis à préparer → Travaux en cours/)).toBeVisible();
    await expect(page.getByText('STATUS_CHANGE', { exact: true })).toHaveCount(0);
    await expect(page.getByText('QUOTE_PENDING', { exact: true })).toHaveCount(0);
  });

  test('pendant le pilote les réglages SMS expliquent clairement le verrouillage', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: true });
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Notifications/i }).click();

    await expect(page.getByText(/SMS sont désactivés pendant le pilote gratuit/i)).toBeVisible();
    const buttons = page.getByRole('button', { name: 'Configurer le template' });
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(0)).toBeDisabled();
    await expect(buttons.nth(1)).toBeDisabled();
  });

  test('le login parle d’identifiant employé et non de code employé', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Email ou identifiant employé', { exact: true })).toBeVisible();
    await expect(page.getByText('Email ou code employé', { exact: true })).toHaveCount(0);
  });
});
