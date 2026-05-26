import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Plus, Stethoscope, Wrench } from 'lucide-react';

/** Action principale technicien assigné — barre fixe mobile (TechMobileBar). */
export type TechMobileActionKind = 'diagnosis-start' | 'diagnosis-add' | 'status';

export interface TechMobilePrimaryAction {
  label: string;
  kind: TechMobileActionKind;
  /** Cible status si kind === 'status' */
  targetStatus?: string;
  icon: LucideIcon;
  /** canDiagnose = réception/diagnostic ; assigned = travaux / QC */
  requires: 'canDiagnose' | 'assigned';
}

/**
 * À maintenir en parité avec les transitions technicien sur la fiche OT.
 * Chaque statut où le technicien doit agir doit avoir une entrée ici.
 */
export const TECH_MOBILE_PRIMARY_BY_STATUS: Record<string, TechMobilePrimaryAction> = {
  RECEIVED: {
    label: 'Commencer',
    kind: 'diagnosis-start',
    icon: Stethoscope,
    requires: 'canDiagnose',
  },
  DIAGNOSING: {
    label: 'Constat',
    kind: 'diagnosis-add',
    icon: Plus,
    requires: 'canDiagnose',
  },
  QUOTE_APPROVED: {
    label: 'Lancer les travaux',
    kind: 'status',
    targetStatus: 'IN_PROGRESS',
    icon: Wrench,
    requires: 'assigned',
  },
  IN_PROGRESS: {
    label: 'Contrôle qualité',
    kind: 'status',
    targetStatus: 'QC_PENDING',
    icon: ArrowRight,
    requires: 'assigned',
  },
  QC_REJECTED: {
    label: 'Reprendre les travaux',
    kind: 'status',
    targetStatus: 'IN_PROGRESS',
    icon: Wrench,
    requires: 'assigned',
  },
};

export function resolveTechMobilePrimary(
  status: string,
  opts: { canDiagnose: boolean; isAssigned: boolean },
): TechMobilePrimaryAction | null {
  const action = TECH_MOBILE_PRIMARY_BY_STATUS[status];
  if (!action) return null;
  if (action.requires === 'canDiagnose' && !opts.canDiagnose) return null;
  if (action.requires === 'assigned' && !opts.isAssigned) return null;
  return action;
}
