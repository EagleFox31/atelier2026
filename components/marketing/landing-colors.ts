/** Palette marketing — landing, login, inscription (terre cuite · kente · savane). */
export const LANDING_COLORS = {
  brand: '#C8511A',
  brandDeep: '#8B3210',
  gold: '#D4A432',
  goldLight: '#F2C95A',
  earth: '#1A1209',
  sand: '#F5EDD8',
  sand2: '#EDE0C4',
  green: '#1D6A4A',
  greenLight: '#D1FAE5',
  red: '#B91C1C',
  redLight: '#FEE2E2',
  muted: '#6B5B4E',
  surface: '#FDFAF4',
  white: '#FFFFFF',
} as const;

export type LandingColorKey = keyof typeof LANDING_COLORS;
