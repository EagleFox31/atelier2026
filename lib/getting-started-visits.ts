export function markGettingStartedVisit(page: string, userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`atelier_gs_visit_${userId}_${page}`, '1');
}

export function hasGettingStartedVisit(page: string, userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`atelier_gs_visit_${userId}_${page}`) === '1';
}
