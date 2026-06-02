export type GuideRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'CHEF_ATELIER'
  | 'RECEPTIONNISTE'
  | 'TECHNICIEN'
  | 'CAISSIER';

const ROLE_PRIORITY: GuideRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CHEF_ATELIER',
  'CAISSIER',
  'RECEPTIONNISTE',
  'TECHNICIEN',
];

export function resolveGuideRole(roles: string[]): GuideRole {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? 'RECEPTIONNISTE';
}

export const GUIDE_ROLE_LABELS: Record<GuideRole, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  ADMIN: 'Administrateur',
  CHEF_ATELIER: "Chef d'atelier",
  RECEPTIONNISTE: 'Réceptionnaire',
  TECHNICIEN: 'Technicien',
  CAISSIER: 'Caissier',
};
