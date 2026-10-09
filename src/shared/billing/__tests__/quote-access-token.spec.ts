import { QUOTE_LINK_TTL_DAYS, quoteLinkExpiry, quoteValidityEnd } from '../quote-access-token';

const NOW = new Date('2026-10-09T10:00:00Z');
const DAY = 24 * 60 * 60_000;

describe('quoteLinkExpiry', () => {
  it('sans date de validité : durée par défaut', () => {
    expect(quoteLinkExpiry(NOW, null).getTime()).toBe(NOW.getTime() + QUOTE_LINK_TTL_DAYS * DAY);
  });

  it('bornée par la fin du dernier jour de validité, à Douala', () => {
    // Valable jusqu'au 15/10 inclus : fin à minuit, heure de Douala (23 h UTC).
    expect(quoteLinkExpiry(NOW, new Date('2026-10-15')).toISOString()).toBe('2026-10-15T23:00:00.000Z');
  });

  it('une validité plus lointaine que la durée par défaut ne la prolonge pas', () => {
    expect(quoteLinkExpiry(NOW, new Date('2027-06-01')).getTime()).toBe(NOW.getTime() + QUOTE_LINK_TTL_DAYS * DAY);
  });

  it('quoteValidityEnd : null sans date', () => {
    expect(quoteValidityEnd(null)).toBeNull();
  });
});
