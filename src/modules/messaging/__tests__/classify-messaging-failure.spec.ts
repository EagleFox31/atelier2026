import {
  PermanentMessagingError,
  TemporaryMessagingError,
  classifyMessagingFailure,
} from '../messaging.errors';
import { SimulatorSmsProvider } from '../sms/simulator-sms.provider';
import { SmsToSmsProvider } from '../sms/smsto-sms.provider';
import { SimulatorWhatsAppProvider } from '../whatsapp/simulator-whatsapp.provider';
import { WhatsAppCloudApiProvider } from '../whatsapp/cloud-api-whatsapp.provider';

describe('classifyMessagingFailure', () => {
  it('erreur définitive → permanent, quel que soit le nombre de tentatives restantes', () => {
    const error = new PermanentMessagingError('INVALID_RECIPIENT', 'Numéro inconnu.', 'smsto');
    expect(classifyMessagingFailure(error, { attemptsMade: 0, opts: { attempts: 3 } })).toEqual({
      kind: 'permanent',
      code: 'INVALID_RECIPIENT',
      provider: 'smsto',
      message: 'Numéro inconnu.',
    });
  });

  it('erreur temporaire typée → temporary, non épuisée avant la dernière tentative', () => {
    const error = new TemporaryMessagingError('TIMEOUT', 'Délai.', 'smsto');
    expect(classifyMessagingFailure(error, { attemptsMade: 1, opts: { attempts: 3 } })).toEqual({
      kind: 'temporary',
      code: 'TIMEOUT',
      attempt: 2,
      maxAttempts: 3,
      exhausted: false,
      typed: true,
    });
  });

  it('dernière tentative → exhausted', () => {
    const error = new TemporaryMessagingError('UNAVAILABLE', '5xx.', 'smsto');
    expect(classifyMessagingFailure(error, { attemptsMade: 2, opts: { attempts: 3 } })).toMatchObject({
      exhausted: true,
      attempt: 3,
    });
  });

  it('erreur non typée → temporaire UNEXPECTED ; sans opts, une seule tentative', () => {
    expect(classifyMessagingFailure(new Error('boom'), {})).toEqual({
      kind: 'temporary',
      code: 'UNEXPECTED',
      attempt: 1,
      maxAttempts: 1,
      exhausted: true,
      typed: false,
    });
  });
});

describe('drapeau simulated des fournisseurs', () => {
  it('seuls les simulateurs se déclarent simulés', () => {
    expect(new SimulatorSmsProvider().simulated).toBe(true);
    expect(new SimulatorWhatsAppProvider().simulated).toBe(true);
    expect(
      new WhatsAppCloudApiProvider({ accessToken: 't', phoneNumberId: '1', apiUrl: 'u', apiVersion: 'v' }).simulated,
    ).toBe(false);
    expect(new SmsToSmsProvider({ apiKey: 'k', senderId: 'Atelier', apiUrl: 'u' }).simulated).toBe(false);
  });
});
