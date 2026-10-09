import {
  customerDisplayName,
  formatNotificationAmount,
  formatNotificationDate,
  formatNotificationTime,
} from '../notification-format';

describe('notification-format', () => {
  it('date et heure à Douala (UTC+1), sans dépendre du fuseau du serveur', () => {
    const lateEvening = new Date('2026-10-12T23:30:00Z'); // 00:30 le 13 à Douala
    expect(formatNotificationDate(lateEvening)).toBe('13/10/2026');
    expect(formatNotificationTime(lateEvening)).toBe('00:30');
  });

  it('montants arrondis, espaces ordinaires (règle jsPDF / Meta)', () => {
    expect(formatNotificationAmount(119250)).toBe('119 250 FCFA');
    expect(formatNotificationAmount('1000000.4')).toBe('1 000 000 FCFA');
    expect(formatNotificationAmount(950)).toBe('950 FCFA');
    expect(formatNotificationAmount(119250)).not.toMatch(/[  ]/);
  });

  it('nom du client : raison sociale pour une entreprise, sinon prénom + nom', () => {
    expect(customerDisplayName({ customerType: 'COMPANY', companyName: ' SOTRACAM ', firstName: 'Paul' })).toBe('SOTRACAM');
    expect(customerDisplayName({ customerType: 'INDIVIDUAL', firstName: 'Awa', lastName: 'Ngono' })).toBe('Awa Ngono');
    expect(customerDisplayName({ customerType: 'INDIVIDUAL', lastName: 'Ngono' })).toBe('Ngono');
    expect(customerDisplayName({})).toBe('');
  });
});
