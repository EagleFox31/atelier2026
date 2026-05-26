export type ReceptionCheckResult = 'OK' | 'WARNING' | 'CRITICAL' | 'NA';
export type ReceptionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ReceptionDraftItem {
  catalogId: string;
  result: ReceptionCheckResult;
  note?: string;
}

export interface ReceptionDraft {
  complaint: string;
  priority: ReceptionPriority;
  mileage: string;
  step: 1 | 2;
  items: ReceptionDraftItem[];
  fuelLevel: number;
  notes: string;
  savedAt: string;
}

export function receptionDraftKey(vehicleId: string) {
  return `reception_draft_${vehicleId}`;
}

export function loadReceptionDraft(vehicleId: string): ReceptionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(receptionDraftKey(vehicleId));
    if (!raw) return null;
    return JSON.parse(raw) as ReceptionDraft;
  } catch {
    localStorage.removeItem(receptionDraftKey(vehicleId));
    return null;
  }
}

export function saveReceptionDraft(vehicleId: string, draft: Omit<ReceptionDraft, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  const payload: ReceptionDraft = { ...draft, savedAt: new Date().toISOString() };
  localStorage.setItem(receptionDraftKey(vehicleId), JSON.stringify(payload));
}

export function clearReceptionDraft(vehicleId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(receptionDraftKey(vehicleId));
}

export function hasReceptionDraft(vehicleId: string): boolean {
  return loadReceptionDraft(vehicleId) !== null;
}

export function mergeReceptionDraftItems<T extends { id: string }>(
  catalog: T[],
  saved: ReceptionDraftItem[] | undefined,
): ReceptionDraftItem[] {
  const savedById = new Map((saved ?? []).map(item => [item.catalogId, item]));
  return catalog.map(c => savedById.get(c.id) ?? { catalogId: c.id, result: 'NA' as const });
}
