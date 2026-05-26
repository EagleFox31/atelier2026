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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('atelier_token');
    localStorage.removeItem('atelier_user');
    const returnPath = window.location.pathname + window.location.search;
    if (returnPath && returnPath !== '/login') {
      sessionStorage.setItem('atelier_return_url', returnPath);
    }
    window.location.href = '/login';
    throw new ApiError(401, 'Session expirée');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      message?: string | string[];
      errorCode?: string;
    };
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
const del  = <T>(path: string)                  => request<T>(path, { method: 'DELETE' });

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (identifier: string, password: string) =>
    post<{ access_token: string; user: ApiUser }>('/auth/login', { identifier, password }),
  logout:  () => post('/auth/logout'),
  profile: () => get<ApiUser>('/auth/profile'),
  completeOnboarding: () =>
    patch<{ onboardingCompletedAt: string | null }>('/auth/onboarding', {}),
};

// ─── Workshop ──────────────────────────────────────────────────────────────
export const workshopApi = {
  listOTs:         (params?: { status?: string; search?: string }) =>
    get(`/workshop/ot${toQuery(params)}`),
  getOT:           (id: string) => get(`/workshop/ot/${id}`),
  createOT:        (body: unknown) => post('/workshop/ot', body),
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
};

// ─── Team ──────────────────────────────────────────────────────────────────
export const teamApi = {
  list:   (params?: { search?: string; roleId?: string }) =>
    get(`/team${toQuery(params)}`),
  get:    (id: string) => get(`/team/${id}`),
  create: (body: unknown) => post('/team', body),
  update: (id: string, body: unknown) => patch(`/team/${id}`, body),
  delete: (id: string) => del(`/team/${id}`),
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
export const reportsApi = {
  revenue:     (params?: { startDate?: string; endDate?: string }) =>
    get(`/reports/revenue${toQuery(params)}`),
  performance: () => get('/reports/workshop-performance'),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const settingsApi = {
  getWorkshop: () => get<import('./workshop-settings').WorkshopSettings>('/settings/workshop'),
  updateWorkshop: (body: unknown) =>
    patch<import('./workshop-settings').WorkshopSettings>('/settings/workshop', body),
};

// ─── Audit ─────────────────────────────────────────────────────────────────
export const auditApi = {
  logs: (params?: { entityType?: string; entityId?: string; action?: string; limit?: number; offset?: number }) =>
    get(`/audit${toQuery(params)}`),
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
export function handleApiError(err: unknown, fallback = 'Une erreur inattendue est survenue'): void {
  import('sonner').then(({ toast }) => {
    if (err instanceof ApiError && err.status === 401) return;
    toast.error(getApiErrorMessage(err, fallback));
  });
}

export { ApiError };
