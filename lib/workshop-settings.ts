/** Paramètres atelier exposés par GET /api/settings/workshop */
export interface WorkshopSettings {
  shopName: string;
  tagline: string;
  niu: string | null;
  email: string;
  phone: string;
  address: string;
  defaultLaborRateXaf: number | null;
  taxRatePct: number;
  updatedAt: string;
}

export const FALLBACK_WORKSHOP_SETTINGS: WorkshopSettings = {
  shopName: 'Atelier Maître',
  tagline: 'Garage automobile — Yaoundé, Cameroun',
  niu: 'M012345678901X',
  email: 'contact@atelier2026.cm',
  phone: '+237 699 00 00 00',
  address: 'Bastos, Rue 1.042, Yaoundé, Cameroun',
  defaultLaborRateXaf: 15000,
  taxRatePct: 19.25,
  updatedAt: new Date(0).toISOString(),
};

/** Ligne contact compacte pour en-tête PDF (adresse · tel · email). */
export function workshopContactLine(s: Pick<WorkshopSettings, 'address' | 'phone' | 'email'>): string {
  return [s.address, s.phone, s.email].filter(Boolean).join(' - ');
}
