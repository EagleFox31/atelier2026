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
    onboardingPending?: boolean;
    mustChangePassword?: boolean;
    /** Aucune session au départ (pages publiques : invitation…). */
    loggedOut?: boolean;
    /** Champs du profil renvoyé par /api/auth/profile (rôles…). */
    profileOverrides?: Record<string, unknown>;
  } = {},
) {
  // Profil mutable (onboarding, changement de mot de passe) : type ouvert volontairement.
  let profile: Record<string, unknown> = options.onboardingPending
    ? { ...PROFILE, onboardingCompletedAt: null }
    : { ...PROFILE };
  if (options.mustChangePassword) profile = { ...profile, mustChangePassword: true };
  if (options.profileOverrides) profile = { ...profile, ...options.profileOverrides };

  if (!options.loggedOut) {
    await page.addInitScript((profile) => {
      localStorage.setItem('atelier_token', 'ux-token');
      localStorage.setItem('atelier_user', JSON.stringify(profile));
    }, profile);
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/auth/change-password' && method === 'POST') {
      // Le mot de passe est changé : le profil suivant n'impose plus rien.
      profile = { ...profile, mustChangePassword: false };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'ux-token-2', mustChangePassword: false }),
      });
    }
    if (path === '/api/auth/profile') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
    }
    if (path === '/api/auth/onboarding' && method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ onboardingCompletedAt: '2026-09-23T08:30:00.000Z' }),
      });
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
          features: options.trial === false ? { sms: true, branding: true } : { sms: false, branding: false },
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

    const pilotCard = page.getByText('Atelier Maître · 30 jours', { exact: true });
    await expect(pilotCard).toBeVisible();
    await expect(pilotCard).toHaveCount(1); // pas de doublon (bannière + carte)
    await expect(page.getByText('Atelier Maître Essentiel', { exact: true })).toBeVisible();
    await expect(page.getByText('Atelier Maître Pro', { exact: true })).toBeVisible();
    await expect(page.getByText('Atelier Maître Business', { exact: true })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('la ville recherche dès le premier caractère et tolère une faute de frappe', async ({ page }) => {
    await mockPublicSignup(page);
    await page.addInitScript((draft) => {
      // addInitScript rejoue à chaque chargement : ne pas écraser le brouillon sauvegardé par l'app.
      if (!sessionStorage.getItem('atelier_signup_draft_v1')) {
        sessionStorage.setItem('atelier_signup_draft_v1', JSON.stringify(draft));
      }
    }, signupDraft(2));

    await page.goto('/inscription');
    const city = page.getByLabel('Ville');
    await expect(city).toBeVisible();

    await city.fill('B');
    await expect(page.getByText('Bafoussam', { exact: true })).toBeVisible();

    await city.fill('Bertuo');
    await expect(page.getByText('Bertoua', { exact: true })).toBeVisible();
  });

  test('la création équipe explique le clic sur les cartes et survit à un refresh', async ({ page }) => {
    await mockPublicSignup(page);
    await page.addInitScript((draft) => {
      // addInitScript rejoue à chaque chargement : ne pas écraser le brouillon sauvegardé par l'app.
      if (!sessionStorage.getItem('atelier_signup_draft_v1')) {
        sessionStorage.setItem('atelier_signup_draft_v1', JSON.stringify(draft));
      }
    }, signupDraft(3));

    await page.goto('/inscription');
    await expect(page.getByText(/Cliquez sur une carte de rôle pour ajouter la personne/i)).toBeVisible();
    await expect(page.getByText(/Super Admin réservé/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Technicien/i }).click();
    await page.getByPlaceholder('Prénom', { exact: true }).fill('Norom');
    await page.getByPlaceholder('Nom', { exact: true }).fill('Gandi');

    await page.reload();
    await expect(page.getByPlaceholder('Prénom', { exact: true })).toHaveValue('Norom');
    await expect(page.getByPlaceholder('Nom', { exact: true })).toHaveValue('Gandi');
  });

  test('Créer et sélectionner garde immédiatement le nouveau client sans rechargement', async ({ page }) => {
    await mockAuthenticatedApp(page, { customerCreate: true, trial: true });

    await page.goto('/workshop');
    await page.getByRole('button', { name: /Nouvel OT/i }).click();
    await page.evaluate(() => { (window as unknown as { __noReload?: boolean }).__noReload = true; });

    const customerSearch = page.getByPlaceholder('Téléphone ou nom du client…');
    await customerSearch.fill('samuel');
    await expect(page.getByText(/Aucun résultat pour « samuel »/i)).toBeVisible();

    await page.getByPlaceholder('Jean').fill('Jean');
    await page.getByPlaceholder('Mbarga').fill('Mbarga');
    await page.getByPlaceholder('+237 6XX XX XX XX').fill('+237690000000');
    await page.getByRole('button', { name: 'Créer et sélectionner' }).click();

    await expect(page.getByText('Jean Mbarga', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Plaque ou modèle…')).toBeEnabled();
    // La modale « Nouvel OT » reste ouverte (bug du <form> imbriqué) et la page n'a pas été rechargée.
    await expect(page.getByText('Ouvrir un nouvel Ordre de Travail')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
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

  test('les droits renvoyés par l’API (features) déverrouillent les SMS d’un forfait actif', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: false });
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Notifications/i }).click();

    const buttons = page.getByRole('button', { name: 'Configurer le template' });
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(0)).toBeEnabled();
    await expect(buttons.nth(1)).toBeEnabled();
  });


  test('le premier accès impose le tour interactif puis ne le marque terminé qu’à la fin', async ({ page }) => {
    let onboardingWrites = 0;
    await mockAuthenticatedApp(page, { trial: true, onboardingPending: true });

    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        new URL(request.url()).pathname === '/api/auth/onboarding'
      ) {
        onboardingWrites += 1;
      }
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('dialog').getByText(/^Bonjour, Test/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog').getByText(/^Bonjour, Test/)).toBeVisible();
    expect(onboardingWrites).toBe(0);

    for (let i = 0; i < 8; i += 1) {
      const done = page.getByRole('button', { name: 'Commencer' });
      if (await done.isVisible().catch(() => false)) {
        await done.click();
        break;
      }
      await page.getByRole('button', { name: 'Suivant' }).click();
    }

    await expect.poll(() => onboardingWrites).toBe(1);
    await expect(page.getByRole('dialog').getByText(/^Bonjour, Test/)).toHaveCount(0);
  });

  test('un mot de passe temporaire impose son changement avant tout accès à l’app', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: false, mustChangePassword: true });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByText('Choisissez votre mot de passe')).toBeVisible();

    const save = page.getByRole('button', { name: 'Enregistrer mon mot de passe' });
    await page.getByLabel('Mot de passe temporaire', { exact: true }).fill('Xk7m-Pq4r-Zt9w');
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('court1');
    await expect(save).toBeDisabled(); // règles serveur reprises côté front

    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Garage-Akwa-2026');
    await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill('Garage-Akwa-2026');
    await save.click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('un employé invité choisit son mot de passe et arrive connecté sur son espace', async ({ page }) => {
    const token = 'Q2hhbmdlTWVJbW1lZGlhdGVseS1BdGVsaWVyTWFpdHJl';
    await mockAuthenticatedApp(page, {
      trial: false,
      loggedOut: true,
      profileOverrides: { firstName: 'Marie', lastName: 'Nkolo', roles: ['TECHNICIEN'], permissions: ['ORD_VIEW', 'VEH_VIEW', 'STK_VIEW'] },
    });
    let acceptedPassword: string | null = null;
    await page.route(`**/api/public/invitations/${token}**`, async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        acceptedPassword = (request.postDataJSON() as { password: string }).password;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ access_token: 'ux-token-invited', user: { id: 'user-ux-admin', mustChangePassword: false } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          firstName: 'Marie',
          employeeCode: 'marie.nkolo',
          workshopName: 'Garage UX',
          expiresAt: '2026-10-05T09:00:00.000Z',
        }),
      });
    });

    await page.goto(`/invitation/${token}`);
    await expect(page.getByText('Bienvenue, Marie')).toBeVisible();
    await expect(page.getByText('marie.nkolo', { exact: true })).toBeVisible();

    const activate = page.getByRole('button', { name: 'Activer mon compte' });
    await page.getByLabel('Mot de passe', { exact: true }).fill('court1');
    await expect(activate).toBeDisabled(); // règles serveur reprises côté front

    await page.getByLabel('Mot de passe', { exact: true }).fill('Garage-Akwa-2026');
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('Garage-Akwa-2026');
    await activate.click();

    await expect(page).toHaveURL(/\/workshop$/); // accueil du profil technicien
    expect(acceptedPassword).toBe('Garage-Akwa-2026');
  });

  test('un lien d’invitation expiré explique quoi faire au lieu d’afficher le formulaire', async ({ page }) => {
    await page.route('**/api/public/invitations/**', (route) =>
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 410, errorCode: 'INVITATION_EXPIRED', message: 'Ce lien d’invitation a expiré.' }),
      }),
    );

    await page.goto('/invitation/Q2hhbmdlTWVJbW1lZGlhdGVseS1BdGVsaWVyTWFpdHJl');

    await expect(page.getByText('Invitation expirée')).toBeVisible();
    await expect(page.getByText(/valables 72 heures/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activer mon compte' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Aller à la connexion' })).toBeVisible();
    await expect(page).toHaveURL(/\/invitation\//); // page publique : pas de redirection vers /login
  });

  test('le login parle d’identifiant employé et non de code employé', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Email ou identifiant employé', { exact: true })).toBeVisible();
    await expect(page.getByText('Email ou code employé', { exact: true })).toHaveCount(0);
  });

  test('les champs du login sont reliés à leur libellé (lecteurs d’écran)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email ou identifiant employé')).toHaveAttribute('autocomplete', 'username');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  });

  // LESSON-2026-004 répétée (login) : contrôle générique plutôt qu'au cas par cas.
  for (const path of ['/login', '/forgot-password', '/inscription']) {
    test(`chaque champ de ${path} a un nom accessible`, async ({ page }) => {
      await mockPublicSignup(page);
      await page.goto(path);
      await page.locator('input:visible').first().waitFor();
      const unnamed = await page.locator('input:visible, select:visible, textarea:visible').evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .filter((el) => {
            const input = el as HTMLInputElement;
            return !(input.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
          })
          .map((el) => `${el.tagName.toLowerCase()}[type=${(el as HTMLInputElement).type}] placeholder="${(el as HTMLInputElement).placeholder}"`),
      );
      expect(unnamed, `champs sans libellé relié sur ${path}`).toEqual([]);
    });
  }

  test('après le pilote, le logo verrouillé ne parle plus du pilote en cours', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: true });
    await page.route('**/api/subscription/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'GRACE_PERIOD',
          plan: 'pro',
          trialStartedAt: '2026-09-01T08:00:00.000Z',
          trialEndsAt: '2026-10-01T08:00:00.000Z',
          graceEndsAt: '2026-10-08T08:00:00.000Z',
          subscriptionStartedAt: null,
          subscriptionEndsAt: null,
          dataRetentionEndsAt: '2027-01-01T08:00:00.000Z',
          daysRemaining: 3,
          readOnly: true,
          blocked: false,
          features: { sms: false, branding: false },
        }),
      }),
    );
    await page.goto('/settings');

    await expect(page.getByText('Logo verrouillé sans forfait actif')).toBeVisible();
    await expect(page.getByText('Logo verrouillé pendant le pilote')).toHaveCount(0);
  });

  test('au retour de NotchPay, l’app fait vérifier le paiement sans attendre le webhook', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: true });
    const reconcileCalls: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/subscription/payments/reconcile') reconcileCalls.push(request.method());
    });

    await page.goto('/settings?payment=return');

    await expect.poll(() => reconcileCalls.length).toBeGreaterThan(0);
    expect(reconcileCalls[0]).toBe('POST');
  });

  test('les onglets des paramètres tiennent sur une seule ligne', async ({ page }) => {
    await mockAuthenticatedApp(page, { trial: true });
    await page.goto('/settings');

    const first = await page.getByRole('tab', { name: /Atelier/ }).boundingBox();
    const subscription = page.getByRole('tab', { name: /Abonnement/ });
    await subscription.scrollIntoViewIfNeeded();
    const last = await subscription.boundingBox();
    expect(first && last && Math.abs(first.y - last.y) < 4).toBe(true);
  });
});
