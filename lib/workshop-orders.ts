import type { ApiUser } from '@/lib/api';
import { isTechnicianProfile, isReceptionnisteProfile } from '@/lib/role-routing';

const INACTIVE_STATUSES = ['CLOSED', 'CANCELLED'] as const;

/** OT visibles selon le profil :
 *  - Technicien     → uniquement les OT qui lui sont assignés
 *  - Réceptionniste → uniquement les OT qu'il a ouverts
 *  - Autres         → tous
 */
export function scopeOrdersForUser<T extends { chef?: { id?: string } | null; openedBy?: string }>(
  orders: T[],
  user: ApiUser | null | undefined,
): T[] {
  if (isTechnicianProfile(user)) return orders.filter((o) => o.chef?.id === user?.id);
  if (isReceptionnisteProfile(user)) return orders.filter((o) => o.openedBy === user?.id);
  return orders;
}

/** Compte les OT actifs (hors clôturés / annulés). */
export function countActiveOrders<T extends { status: string }>(orders: T[]): number {
  return orders.filter((o) => !INACTIVE_STATUSES.includes(o.status as typeof INACTIVE_STATUSES[number])).length;
}
