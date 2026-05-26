export const ELEVATED_WORKSHOP_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'CHEF_ATELIER',
  'RECEPTIONNISTE',
  'CAISSIER',
] as const;

export type WorkshopUser = {
  id: string;
  roles?: Array<{ role?: { code?: string }; code?: string }>;
};

export function getWorkshopUserRoleCodes(user?: WorkshopUser): string[] {
  if (!user?.roles?.length) return [];
  return user.roles.map(
    (ur) => ur.role?.code ?? (ur as { code?: string }).code ?? String(ur),
  );
}

export function isPureTechnicianFromCodes(roleCodes: string[]): boolean {
  return (
    roleCodes.includes('TECHNICIEN') &&
    !roleCodes.some((code) => (ELEVATED_WORKSHOP_ROLES as readonly string[]).includes(code))
  );
}

export function isPureTechnician(user?: WorkshopUser): boolean {
  return isPureTechnicianFromCodes(getWorkshopUserRoleCodes(user));
}

export function technicianAssignmentFilter(user?: WorkshopUser): { assignedChef?: string } {
  if (!user?.id || !isPureTechnician(user)) return {};
  return { assignedChef: user.id };
}