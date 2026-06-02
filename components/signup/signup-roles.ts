import {
  ClipboardList,
  UsersRound,
  Wrench,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type SignupTeamRoleCode =
  | 'CHEF_ATELIER'
  | 'RECEPTIONNISTE'
  | 'TECHNICIEN'
  | 'CAISSIER';

export interface SignupRoleCard {
  code: SignupTeamRoleCode;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  ring: string;
  iconBg: string;
}

export const SIGNUP_TEAM_ROLES: SignupRoleCard[] = [
  {
    code: 'CHEF_ATELIER',
    label: "Chef d'atelier",
    description: 'Planning, validation OT, contrôle qualité',
    icon: UsersRound,
    accent: 'border-[var(--afrique-forest)]/40 bg-[var(--afrique-forest-soft)]',
    ring: 'ring-[var(--afrique-forest-ring)]',
    iconBg: 'bg-[var(--afrique-forest)]/15 text-[var(--afrique-forest)]',
  },
  {
    code: 'RECEPTIONNISTE',
    label: 'Réception',
    description: 'Accueil client, création OT, rendez-vous',
    icon: ClipboardList,
    accent: 'border-[var(--afrique-brand)]/35 bg-[var(--afrique-brand-soft)]',
    ring: 'ring-[var(--afrique-brand-ring)]',
    iconBg: 'bg-brand/15 text-brand',
  },
  {
    code: 'TECHNICIEN',
    label: 'Technicien',
    description: 'Interventions, diagnostics, suivi atelier',
    icon: Wrench,
    accent: 'border-[var(--afrique-gold)]/35 bg-[var(--afrique-gold-soft)]',
    ring: 'ring-[var(--afrique-gold-ring)]',
    iconBg: 'bg-[var(--afrique-gold)]/15 text-[#8a6914]',
  },
  {
    code: 'CAISSIER',
    label: 'Caissier',
    description: 'Encaissements, factures, clôture caisse',
    icon: Wallet,
    accent: 'border-[var(--afrique-terracotta)]/35 bg-[var(--afrique-terra-soft)]',
    ring: 'ring-[var(--afrique-terra-ring)]',
    iconBg: 'text-[var(--afrique-terracotta)] bg-[var(--afrique-terra-soft)]',
  },
];

export const SIGNUP_ROLE_LABEL: Record<string, string> = Object.fromEntries(
  SIGNUP_TEAM_ROLES.map((r) => [r.code, r.label]),
);
