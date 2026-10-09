import {
  CustomerNotificationsConfigurationError,
  DEFAULT_MONTHLY_CAP,
  loadCustomerNotificationsConfig,
} from '../customer-notifications.config';

const LIVE = {
  CUSTOMER_NOTIFICATIONS_MODE: 'live',
  WHATSAPP_PROVIDER: 'whatsapp-cloud',
  WHATSAPP_APPROVED_TEMPLATES: 'am_vehicle_ready_v1:fr, am_vehicle_ready_v1:EN',
  CUSTOMER_NOTIFICATIONS_MONTHLY_CAP: '150',
};

describe('loadCustomerNotificationsConfig', () => {
  it('défaut : mode off, plafond 300, aucun modèle', () => {
    const config = loadCustomerNotificationsConfig({});
    expect(config.mode).toBe('off');
    expect(config.monthlyCap).toBe(DEFAULT_MONTHLY_CAP);
    expect(config.approvedTemplates.size).toBe(0);
  });

  it('live complet : modèles normalisés en minuscules, plafond explicite', () => {
    const config = loadCustomerNotificationsConfig(LIVE);
    expect(config.mode).toBe('live');
    expect([...config.approvedTemplates]).toEqual(['am_vehicle_ready_v1:fr', 'am_vehicle_ready_v1:en']);
    expect(config.monthlyCap).toBe(150);
  });

  it('sandbox : destinataires normalisés en E.164, entrées invalides ignorées', () => {
    const config = loadCustomerNotificationsConfig({
      CUSTOMER_NOTIFICATIONS_MODE: 'sandbox',
      WHATSAPP_TEST_RECIPIENTS: '690000001, n/a',
    });
    expect([...config.testRecipients]).toEqual(['+237690000001']);
  });

  it.each([
    ['mode inconnu', { CUSTOMER_NOTIFICATIONS_MODE: 'prod' }],
    ['repli SMS demandé', { CUSTOMER_NOTIFICATIONS_SMS_FALLBACK: 'on' }],
    ['plafond invalide', { CUSTOMER_NOTIFICATIONS_MONTHLY_CAP: '-1' }],
    ['modèle mal formé', { WHATSAPP_APPROVED_TEMPLATES: 'am_vehicle_ready_v1' }],
    ['live sans fournisseur Cloud', { ...LIVE, WHATSAPP_PROVIDER: 'simulator' }],
    ['live sans modèle approuvé', { ...LIVE, WHATSAPP_APPROVED_TEMPLATES: '' }],
    ['live sans plafond explicite', { ...LIVE, CUSTOMER_NOTIFICATIONS_MONTHLY_CAP: '' }],
  ])('refuse de démarrer : %s', (_, env) => {
    expect(() => loadCustomerNotificationsConfig(env)).toThrow(CustomerNotificationsConfigurationError);
  });
});
