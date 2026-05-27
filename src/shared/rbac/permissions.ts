/** FAC_CREATE inclut la consultation (devis/factures en lecture). */
export const PERMISSION_IMPLIES: Record<string, readonly string[]> = {
  FAC_CREATE: ['FAC_VIEW'],
};

export function permissionGranted(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(required)) return true;
  return userPermissions.some((p) => PERMISSION_IMPLIES[p]?.includes(required));
}
