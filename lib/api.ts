const BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('atelier_token');
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorCode?: string,
  ) {
    super(message);
  }
}

/** Messages utilisateur — le détail technique reste côté API/logs. */
const ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  DB_SCHEMA_OUTDATED:
    'Application pas à jour côté base de données. Un administrateur doit exécuter « npm run migrate » puis redémarrer le serveur.',
  DB_INIT_ERROR:
    'Impossible de joindre la base de données pour le moment. Réessayez dans quelques instants.',
  DB_VALIDATION_ERROR: 'Données invalides. Vérifiez les champs saisis.',
};

export function getApiErrorMessage(err: unknown, fallback = 'Une erreur inattendue est survenue'): string {
  if (err instanceof ApiError) {
    if (err.errorCode && ERROR_MESSAGES_BY_CODE[err.errorCode]) {
      return ERROR_MESSAGES_BY_CODE[err.errorCode];
    }
    if (err.message && !/^Erreur base de données \(P\d+\)$/.test(err.message)) {
      return err.message;
    }
    if (err.errorCode === 'DB_SCHEMA_OUTDATED' || err.message.includes('P2022')) {
      return ERROR_MESSAGES_BY_CODE.DB_SCHEMA_OUTDATED;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

// ─── Indisponibilité temporaire (déploiement, redémarrage) ─────────────────
// Caddy répond 503 { errorCode: 'MAINTENANCE' } quand l'API est arrêtée
// (deploy/docker/Caddyfile). Les 503 émis par NestJS lui-même (DB_INIT_ERROR…)
// restent des erreurs normales avec leur propre message.

export const SERVICE_STATUS_EVENT = 'atelier:service-status';
export const PASSWORD_CHANGE_PATH = '/change-password';
export type ServiceStatusDetail = { unavailable: boolean };

const SERVICE_UNAVAILABLE_MESSAGE =
  'Mise à jour en cours. Vos saisies sont conservées : réessayez dans un instant.';

/** Lectures seules : réessai automatique (~1 min au total). Jamais pour les écritures (risque de doublon). */
const GET_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 15_000, 15_000];

let serviceUnavailable = false;

function setServiceUnavailable(unavailable: boolean) {
  if (typeof window === 'undefined' || unavailable === serviceUnavailable) return;
  serviceUnavailable = unavailable;
  window.dispatchEvent(
    new CustomEvent<ServiceStatusDetail>(SERVICE_STATUS_EVENT, { detail: { unavailable } }),
  );
}

type ErrorBody = { message?: string | string[]; errorCode?: string };

/** `res === null` : réseau coupé (fetch rejeté). */
function isTemporarilyUnavailable(res: Response | null, body: ErrorBody | null): boolean {
  if (res === null) return true;
  if (res.status === 502 || res.status === 504) return true;
  if (res.status === 503) return !body?.errorCode || body.errorCode === 'MAINTENANCE';
  return false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (options.method ?? 'GET').toUpperCase();

  let res: Response | null = null;
  let errorBody: ErrorBody | null = null;

  for (let attempt = 0; ; attempt++) {
    errorBody = null;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
    } catch {
      res = null;
    }

    if (res && !res.ok) {
      errorBody = (await res.json().catch(() => ({}))) as ErrorBody;
    }

    if (!isTemporarilyUnavailable(res, errorBody)) break;

    setServiceUnavailable(true);
    if (method !== 'GET' || attempt >= GET_RETRY_DELAYS_MS.length) {
      throw new ApiError(res?.status ?? 503, SERVICE_UNAVAILABLE_MESSAGE, 'SERVICE_UNAVAILABLE');
    }
    await sleep(GET_RETRY_DELAYS_MS[attempt]);
  }

  // Inatteignable (un réseau coupé n'interrompt jamais la boucle) — rétrécit le type pour TS.
  if (!res) throw new ApiError(503, SERVICE_UNAVAILABLE_MESSAGE, 'SERVICE_UNAVAILABLE');
  // Le serveur a répondu normalement : la mise à jour est terminée.
  setServiceUnavailable(false);

  if (res.status === 401) {
    localStorage.removeItem('atelier_token');
    localStorage.removeItem('atelier_user');
    const returnPath = window.location.pathname + window.location.search;
    const pathOnly = returnPath.split('?')[0];
    const skipReturn = ['/', '/accueil', '/login', '/forgot-password', '/demo', '/inscription'];
    if (returnPath && !skipReturn.includes(pathOnly)) {
      sessionStorage.setItem('atelier_return_url', returnPath);
    }
    window.location.href = '/login';
    throw new ApiError(401, 'Session expirée');
  }

  // Mot de passe temporaire : l'API bloque tout jusqu'au changement (JwtAuthGuard).
  if (res.status === 403 && errorBody?.errorCode === 'PASSWORD_CHANGE_REQUIRED') {
    if (window.location.pathname !== PASSWORD_CHANGE_PATH) {
      window.location.href = PASSWORD_CHANGE_PATH;
    }
    const message = typeof errorBody.message === 'string' ? errorBody.message : 'Changement de mot de passe requis';
    throw new ApiError(403, message, 'PASSWORD_CHANGE_REQUIRED');
  }

  if (!res.ok) {
    const body = errorBody ?? {};
    const rawMessage = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message;
    throw new ApiError(res.status, rawMessage || `Erreur ${res.status}`, body.errorCode);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get  = <T>(path: string)                  => request<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown)  => request<T>(path, { method: 'POST',  body: JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const put  = <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) });
const del  = <T>(path: string)                  => request<T>(path, { method: 'DELETE' });

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (identifier: string, password: string) =>
    post<{ access_token: string; user: ApiUser }>('/auth/login', { identifier, password }),
  logout:  () => post('/auth/logout'),
  profile: () => get<ApiUser>('/auth/profile'),
  forgotPassword: (identifier: string) =>
    post<{ message: string }>('/auth/forgot-password', { identifier }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ access_token: string; mustChangePassword: boolean }>('/auth/change-password', { currentPassword, newPassword }),
  completeOnboarding: () =>
    patch<{ onboardingCompletedAt: string | null }>('/auth/onboarding', {}),
};

// ─── Workshop ──────────────────────────────────────────────────────────────
export const workshopApi = {
  listOTs:         (params?: { status?: string; search?: string }) =>
    get(`/workshop/ot${toQuery(params)}`),
  getOT:           (id: string) => get(`/workshop/ot/${id}`),
  createOT:        (body: unknown) => post('/workshop/ot', body),
  updateOT:        (id: string, body: unknown) => patch(`/workshop/ot/${id}`, body),
  updateStatus:    (id: string, body: unknown) => patch(`/workshop/ot/${id}/status`, body),
  assign:          (id: string, body: unknown) => patch(`/workshop/ot/${id}/assign`, body),
  addObservation:  (id: string, body: unknown) => post(`/workshop/ot/${id}/observation`, body),
  addWorkItem:     (id: string, body: unknown) => post(`/workshop/ot/${id}/work-item`, body),
  removeWorkItem:  (id: string, itemId: string) => del(`/workshop/ot/${id}/work-item/${itemId}`),
  addReception:    (id: string, body: unknown) => post(`/workshop/ot/${id}/reception-check`, body),
  receptionCatalog: () => get('/workshop/reception-catalog'),
  addQC:           (id: string, body: unknown) => post(`/workshop/ot/${id}/quality-control`, body),
  laborCatalog:    () => get('/workshop/labor-catalog'),
};

// ─── Customers ─────────────────────────────────────────────────────────────
export const customersApi = {
  list:   (params?: { search?: string; type?: string }) =>
    get(`/customers${toQuery(params)}`),
  get:    (id: string) => get(`/customers/${id}`),
  create: (body: unknown) => post('/customers', body),
  update: (id: string, body: unknown) => patch(`/customers/${id}`, body),
  delete: (id: string) => del(`/customers/${id}`),
};

// ─── Notifications client (consentement, historique, préférences) ─────────
export const customerNotificationsApi = {
  consents: (customerId: string) =>
    get<import('./customer-notifications').CustomerConsents>(`/customers/${customerId}/notification-consents`),
  recordConsent: (customerId: string, body: import('./customer-notifications').RecordConsentBody) =>
    put<{ changed: boolean; consent: import('./customer-notifications').ChannelConsent }>(
      `/customers/${customerId}/notification-consents/WHATSAPP`, body),
  history: (customerId: string, limit?: number) =>
    get<import('./customer-notifications').CustomerNotificationRow[]>(
      `/customers/${customerId}/notifications${toQuery({ limit })}`),
  settings: () =>
    get<import('./customer-notifications').NotificationPreference[]>('/settings/notifications'),
  updateSettings: (settings: { eventType: import('./customer-notifications').CustomerNotificationEvent; enabled: boolean }[]) =>
    patch<import('./customer-notifications').NotificationPreference[]>('/settings/notifications', { settings }),
};

// ─── Vehicles ──────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list:   (params?: { search?: string; customerId?: string }) =>
    get(`/vehicles${toQuery(params)}`),
  get:    (id: string) => get(`/vehicles/${id}`),
  create: (body: unknown) => post('/vehicles', body),
  update: (id: string, body: unknown) => patch(`/vehicles/${id}`, body),
  delete: (id: string) => del(`/vehicles/${id}`),
  makes:  () => get('/vehicles/makes'),
  models: (makeId: string) => get(`/vehicles/models?makeId=${makeId}`),
};

// ─── Stock ─────────────────────────────────────────────────────────────────
export const stockApi = {
  listParts:     (params?: { search?: string; category?: string; lowStock?: boolean }) =>
    get(`/stock/parts${toQuery(params)}`),
  getPart:       (id: string) => get(`/stock/parts/${id}`),
  createPart:    (body: unknown) => post('/stock/parts', body),
  updatePart:    (id: string, body: unknown) => patch(`/stock/parts/${id}`, body),
  lowStock:      () => get('/stock/parts/low-stock'),
  listMovements: (params?: { partId?: string; serviceOrderId?: string }) =>
    get(`/stock/movements${toQuery(params)}`),
  applyMovement: (body: unknown) => post('/stock/movement', body),
  recordASP:     (body: unknown) => post('/stock/asp', body),
  suppliers:     () => get('/stock/suppliers'),
};

// ─── Billing ───────────────────────────────────────────────────────────────
export const billingApi = {
  compute:              (subtotal: number) => post('/billing/quote/compute', { subtotal }),
  listQuotes:           (params?: { serviceOrderId?: string }) =>
    get(`/billing/quotes${toQuery(params)}`),
  getQuote:             (id: string) => get(`/billing/quotes/${id}`),
  createQuote:          (body: unknown) => post('/billing/quotes', body),
  sendQuote:            (id: string) => post(`/billing/quotes/${id}/send`, {}),
  approveQuote:         (id: string, body: unknown) => post(`/billing/quotes/${id}/approve`, body),
  listInvoices:         (params?: { customerId?: string; status?: string }) =>
    get(`/billing/invoices${toQuery(params)}`),
  getInvoice:           (id: string) => get(`/billing/invoices/${id}`),
  createInvoiceFromQuote: (quoteId: string) =>
    post(`/billing/invoice/from-quote/${quoteId}`),
  recordPayment:        (body: unknown) => post('/billing/payment', body),
  cashClosureSummary:   (params?: { date?: string }) =>
    get(`/billing/cash-closure/summary${toQuery(params)}`),
  closeCashDay:         (body: unknown) => post('/billing/cash-closure', body),
};

// ─── Team ──────────────────────────────────────────────────────────────────
export const teamApi = {
  list:          (params?: { search?: string; roleId?: string }) =>
    get(`/team${toQuery(params)}`),
  get:           (id: string) => get(`/team/${id}`),
  create:        (body: unknown) => post('/team', body),
  update:        (id: string, body: unknown) => patch(`/team/${id}`, body),
  resetPassword:  (id: string, password?: string) => post(`/team/${id}/reset-password`, { password }),
  /** Renvoie l'invitation par e-mail (ADMIN) : nouveau lien, l'ancien devient invalide. */
  resendInvitation: (id: string) => post<InvitationDelivery>(`/team/${id}/invite`),
  toggleStatus:   (id: string) => patch(`/team/${id}/toggle-status`, {}),
  delete:         (id: string) => del(`/team/${id}`),
};

// ─── Planning ──────────────────────────────────────────────────────────────
export const planningApi = {
  list:   (params?: { date?: string; status?: string }) =>
    get(`/planning/appointments${toQuery(params)}`),
  create: (body: unknown) => post('/planning/appointments', body),
  update: (id: string, body: unknown) => patch(`/planning/appointments/${id}`, body),
  delete: (id: string) => del(`/planning/appointments/${id}`),
};

// ─── Notifications ─────────────────────────────────────────────────────────
export const notificationsApi = {
  smsHistory:  (params?: { phone?: string }) => get(`/notifications/sms${toQuery(params)}`),
  sendSms:     (body: unknown) => post('/notifications/sms/send', body),
  inbox:       () => get<InAppNotification[]>('/notifications/inbox'),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead:    (id: string) => patch(`/notifications/${id}/read`),
  markAllRead: () => patch('/notifications/read-all'),
};

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  serviceOrderId: string | null;
  createdAt: string;
}

// ─── Reports ───────────────────────────────────────────────────────────────
export interface MonthlyTargetRow {
  month: number;
  label: string;
  shortLabel: string;
  revenue: number;
  targetXaf: number | null;
  targetId: string | null;
  achievementPct: number | null;
  status: 'none' | 'exceeded' | 'close' | 'missed';
}

export const reportsApi = {
  revenue:        (params?: { startDate?: string; endDate?: string }) =>
    get(`/reports/revenue${toQuery(params)}`),
  performance:    () => get('/reports/workshop-performance'),
  dashboardStats: () => get<{ stats: { title: string; value: string; trend: string }[] }>('/reports/dashboard-stats'),
  targets:        (year?: number) => get<MonthlyTargetRow[]>(`/reports/targets${year ? `?year=${year}` : ''}`),
  upsertTarget:   (body: { year: number; month: number; targetXaf: number }) =>
    post('/reports/targets', body),
  deleteTarget:   (id: string) => del(`/reports/targets/${id}`),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const settingsApi = {
  getWorkshop:    () => get<import('./workshop-settings').WorkshopSettings>('/settings/workshop'),
  updateWorkshop: (body: unknown) =>
    patch<import('./workshop-settings').WorkshopSettings>('/settings/workshop', body),
  updateLogo:     (logoUrl: string | null) =>
    post<import('./workshop-settings').WorkshopSettings>('/settings/workshop/logo', { logoUrl }),
};

// ─── Audit ─────────────────────────────────────────────────────────────────
export const auditApi = {
  logs: (params?: { entityType?: string; entityId?: string; action?: string; limit?: number; offset?: number }) =>
    get(`/audit${toQuery(params)}`),
};


// ─── Abonnement / pilote ───────────────────────────────────────────────────
export type SubscriptionStatus =
  | 'TRIAL'
  | 'GRACE_PERIOD'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED';

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  plan: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  subscriptionStartedAt: string | null;
  subscriptionEndsAt: string | null;
  dataRetentionEndsAt: string | null;
  daysRemaining: number | null;
  readOnly: boolean;
  blocked: boolean;
  /** Droits du forfait, calculés côté API — source unique pour griser l'UI. */
  features: { sms: boolean; branding: boolean; whatsapp?: boolean };
}

export type SubscriptionBillingCycle = 'monthly' | 'annual';

export interface SubscriptionCheckout {
  paymentId: string;
  reference: string;
  amountXaf: number;
  currency: 'XAF';
  billingCycle: SubscriptionBillingCycle;
  garageCount: number;
  authorizationUrl: string;
}

export const subscriptionApi = {
  status: () => get<SubscriptionSummary>('/subscription/status'),
  createCheckout: (billingCycle: SubscriptionBillingCycle) =>
    post<SubscriptionCheckout>('/subscription/checkout', { billingCycle }),
  /** Fait vérifier par l'API les paiements en attente auprès de NotchPay (retour du checkout). */
  reconcilePayments: () =>
    post<{ checked: number; activated: number; closed: number; stillPending: number; expired: number; failed: number }>(
      '/subscription/payments/reconcile',
      {},
    ),
};

// ─── Types ─────────────────────────────────────────────────────────────────
export interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  status: string;
  roles: string[];
  permissions: string[];
  onboardingCompletedAt: string | null;
  /** Mot de passe temporaire : changement imposé avant tout accès (page /change-password). */
  mustChangePassword?: boolean;
  tenantId: string | null;
  garageId: string | null;
  garage: { id: string; name: string; slug: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

/**
 * Gestionnaire d'erreur centralisé pour les appels API côté client.
 * Utilise sonner pour afficher un toast d'erreur uniforme.
 * 
 * @param err       - L'erreur capturée (any)
 * @param fallback  - Message par défaut si err ne contient pas de message
 */
// ─── Marketing (public) ─────────────────────────────────────────────────────
export type DemoRequestedPlan = 'essential' | 'pro' | 'business';
export type DemoBillingCycle = 'monthly' | 'annual';

export interface DemoBookingPayload {
  fullName: string;
  email: string;
  phone: string;
  garageName: string;
  city?: string;
  message?: string;
  requestedPlan?: DemoRequestedPlan;
  billingCycle?: DemoBillingCycle;
}

export const marketingApi = {
  requestDemo: (body: DemoBookingPayload) =>
    post<{ received: true }>('/public/demo-booking', body),
};

// ─── Invitations d'équipe ───────────────────────────────────────────────────
export type InvitationStatus = 'none' | 'pending' | 'expired' | 'accepted';

/** Résultat d'un envoi d'invitation (création d'un membre avec e-mail, renvoi). */
export interface InvitationDelivery {
  status: 'pending';
  email: string;
  expiresAt: string;
  /** skipped : e-mail non configuré côté serveur ; failed : erreur d'envoi. */
  emailStatus: 'sent' | 'skipped' | 'failed';
}

export interface PublicInvitation {
  firstName: string;
  employeeCode: string | null;
  workshopName: string | null;
  expiresAt: string;
}

/** Routes publiques (sans session) de la page /invitation/[token]. */
export const invitationsApi = {
  get: (token: string) => get<PublicInvitation>(`/public/invitations/${encodeURIComponent(token)}`),
  accept: (token: string, password: string) =>
    post<{ access_token: string; user: { id: string; mustChangePassword: boolean } }>(
      `/public/invitations/${encodeURIComponent(token)}/accept`,
      { password },
    ),
};

// ─── Lien public de devis (client) ──────────────────────────────────────────
export type PublicQuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'REVISED' | 'BILLED';

export interface PublicQuote {
  garageName: string;
  customerName: string;
  reference: string;
  status: PublicQuoteStatus;
  issuedAt: string;
  validUntil: string | null;
  approvedAt: string | null;
  vehicle: { plate: string; label: string | null } | null;
  notes: string | null;
  lines: Array<{
    lineType: string;
    description: string | null;
    quantity: number;
    unitPriceXaf: number;
    discountPct: number;
    lineTotalXaf: number;
  }>;
  subtotalXaf: number;
  taxRate: number;
  taxAmountXaf: number;
  stampDutyXaf: number;
  totalXaf: number;
  /** Faux si le devis a déjà reçu une réponse ou si le garage ne peut pas l'enregistrer. */
  canDecide: boolean;
}

export const publicQuotesApi = {
  get: (token: string) => get<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}`),
  approve: (token: string) =>
    post<{ status: 'APPROVED' }>(`/public/quotes/${encodeURIComponent(token)}/approve`, {}),
  reject: (token: string, reason?: string) =>
    post<{ status: 'REJECTED' }>(`/public/quotes/${encodeURIComponent(token)}/reject`, reason ? { reason } : {}),
};

// ─── Inscription atelier (public) ───────────────────────────────────────────
export interface SignupTeamCreated {
  roleCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeCode: string;
  /** Membre sans e-mail : mot de passe temporaire affiché une seule fois. */
  tempPassword?: string;
  /** Membre avec e-mail : invitation envoyée (aucun mot de passe). */
  invitation?: InvitationDelivery;
}

export interface SignupPayload {
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  };
  workshop: {
    shopName: string;
    tagline?: string;
    niu?: string;
    email: string;
    phone: string;
    address: string;
    city?: string;
    defaultLaborRateXaf?: number;
  };
  team?: Array<{
    roleCode: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  }>;
}

export const signupApi = {
  status: () => get<{ available: boolean; reason?: string }>('/public/signup/status'),
  register: (body: SignupPayload) =>
    post<{
      access_token: string;
      user: { id: string; firstName: string; lastName: string; email: string | null; employeeCode: string | null };
      teamCreated: SignupTeamCreated[];
    }>('/public/signup', body),
};

export type DemoRequestStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'SCHEDULED'
  | 'CONVERTED'
  | 'REJECTED';

export interface DemoRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  garageName: string;
  city: string | null;
  message: string | null;
  requestedPlan: DemoRequestedPlan | null;
  billingCycle: DemoBillingCycle | null;
  status: DemoRequestStatus;
  adminNotes: string | null;
  handledById: string | null;
  createdAt: string;
  updatedAt: string;
  handledBy: { id: string; firstName: string; lastName: string } | null;
}

export const demoRequestsApi = {
  list: (params?: { status?: DemoRequestStatus; q?: string; limit?: number; offset?: number }) =>
    get<DemoRequest[]>(`/demo-requests${toQuery(params)}`),
  stats: () => get<{ new: number }>('/demo-requests/stats'),
  get: (id: string) => get<DemoRequest>(`/demo-requests/${id}`),
  update: (id: string, body: { status?: DemoRequestStatus; adminNotes?: string }) =>
    patch<DemoRequest>(`/demo-requests/${id}`, body),
};

export const superAdminApi = {
  listTenants:        () => get<TenantSummary[]>('/admin/tenants'),
  toggleTenantStatus: (id: string) =>
    patch<{ tenantId: string; status: 'active' | 'suspended'; subscriptionStatus: string }>(`/admin/tenants/${id}/toggle-status`, {}),
  customerNotificationsHealth: () => get<CustomerNotificationsHealth>('/admin/customer-notifications/health'),
};

export type HealthLevel = 'ok' | 'warning' | 'critical';

/** Contrat de `GET /admin/customer-notifications/health` (aucune donnée client). */
export interface CustomerNotificationsHealth {
  generatedAt: string;
  status: HealthLevel;
  alerts: { level: Exclude<HealthLevel, 'ok'>; code: string; message: string }[];
  config: {
    mode: 'off' | 'sandbox' | 'live';
    whatsappProvider: string;
    providerSimulated: boolean;
    monthlyCap: number;
    sandboxRecipientCount: number;
  };
  templates: { eventType: string; name: string; language: string; approved: boolean; defaultEnabled: boolean }[];
  queue:
    | { available: true; waiting: number; active: number; delayed: number; failed: number }
    | { available: false };
  outbox: {
    windowHours: number;
    byStatus: Partial<Record<string, number>>;
    skippedByReason: { reason: string; count: number }[];
    failedByCode: { code: string; count: number }[];
    backlog: number;
    oldestPendingAt: string | null;
  };
  /** Absent sur une API antérieure au webhook Meta. */
  webhook?: {
    configured: boolean;
    receiptTimeoutMinutes: number;
    acceptedWithoutReceipt: number;
    pendingEvents: number;
    stuckEvents: number;
    unmatchedEvents: number;
    optOuts: number;
    lastEventAt: string | null;
  };
  quota: {
    monthStart: string;
    cap: number;
    garages: { garageId: string; garageName: string; used: number; ratio: number }[];
  };
}

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  email: string;
  plan: string;
  /** 'suspended' si l'atelier est suspendu par la plateforme. */
  status: 'active' | 'suspended';
  subscriptionStatus: string;
  createdAt: string;
  userCount: number;
  garageCount: number;
  garages: {
    id: string;
    name: string;
    city: string;
    address: string;
    status: string;
    activeOTs: number;
    totalOTs: number;
  }[];
}

export function handleApiError(err: unknown, fallback = 'Une erreur inattendue est survenue'): void {
  import('sonner').then(({ toast }) => {
    if (err instanceof ApiError && err.status === 401) return;
    toast.error(getApiErrorMessage(err, fallback));
  });
}

export { ApiError };
