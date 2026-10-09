import { CustomerNotificationEvent } from '@prisma/client';
import {
  MissingNotificationVariableError,
  NOTIFICATION_CATALOG,
  orderedTemplateVariables,
  sanitizeTemplateVariable,
  templateLanguages,
  templateName,
} from '../customer-notification-catalog';
import { epochSeconds, notificationKeys, scheduledEpochFromKey } from '../notification-keys';

describe('catalogue des notifications client', () => {
  it('couvre chaque événement Prisma', () => {
    expect(Object.keys(NOTIFICATION_CATALOG).sort()).toEqual(Object.values(CustomerNotificationEvent).sort());
  });

  it('« OT pris en charge » est désactivé par défaut, le reste activé', () => {
    const disabled = Object.entries(NOTIFICATION_CATALOG).filter(([, e]) => !e.defaultEnabled).map(([k]) => k);
    expect(disabled).toEqual(['SERVICE_ORDER_RECEIVED']);
  });

  it('nom de modèle versionné', () => {
    expect(templateName('VEHICLE_READY')).toBe('am_vehicle_ready_v1');
  });

  it.each([
    ['en', ['en', 'fr']],
    ['FR', ['fr']],
    [null, ['fr']],
    ['  ', ['fr']],
  ])('langues candidates pour %p', (lang, expected) => {
    expect(templateLanguages(lang)).toEqual(expected);
  });

  it('variables : ordre du modèle et règles Meta (pas de saut de ligne ni de longue suite d’espaces)', () => {
    expect(
      orderedTemplateVariables('VEHICLE_READY', {
        garageName: 'Garage\tCentral',
        plate: 'LT 123     AB',
        customerName: 'Jean\nDupont',
      }),
    ).toEqual(['Jean Dupont', 'LT 123 AB', 'Garage Central']);
    expect(sanitizeTemplateVariable('  a\r\n\r\nb  ')).toBe('a b');
  });

  it('variable manquante ou vide : échec immédiat', () => {
    expect(() => orderedTemplateVariables('VEHICLE_READY', { customerName: 'Jean', plate: ' ' })).toThrow(
      MissingNotificationVariableError,
    );
  });
});

describe('clés d’idempotence', () => {
  const at = new Date('2026-10-12T08:30:00Z');

  it('format documenté', () => {
    expect(notificationKeys.appointmentReminder('a1', at)).toBe(`appointment.reminder:a1:${epochSeconds(at)}`);
    expect(notificationKeys.quoteSent('q1', 2)).toBe('quote.sent:q1:r2');
    expect(notificationKeys.vehicleReady('o1', 4)).toBe('ot.ready:o1:v4');
    expect(notificationKeys.invoiceReminder('i1', 1)).toBe('invoice.reminder:i1:s1');
  });

  it('relit l’horaire du RDV encodé dans la clé', () => {
    expect(scheduledEpochFromKey(notificationKeys.appointmentConfirmed('a1', at))).toBe(epochSeconds(at));
    expect(scheduledEpochFromKey('ot.received:o1')).toBeNull();
  });
});
