import {
  LayoutDashboard,
  Car,
  Wrench,
  Package,
  FileText,
  Settings,
  Users,
  History,
  Bell,
  UsersRound,
  Calendar,
  ClipboardList,
  Presentation,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;      // hasPermission(code) doit retourner true
  roles?: string[];         // OU hasRole(role) doit retourner true pour l'un d'eux
  hideForRoles?: string[];  // Masqué si l'utilisateur a l'un de ces rôles
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
    hideForRoles: ["TECHNICIEN"],
  },
  {
    title: "Planning",
    href: "/planning",
    icon: Calendar,
    permission: "ORD_VIEW",
    hideForRoles: ["TECHNICIEN", "CAISSIER"],
  },
  {
    title: "Équipe",
    href: "/team",
    icon: UsersRound,
    roles: ["ADMIN", "CHEF_ATELIER", "SUPER_ADMIN"],
  },
  {
    title: "Réception express",
    href: "/reception",
    icon: ClipboardList,
    permission: "ORD_CREATE",
    hideForRoles: ["TECHNICIEN", "CAISSIER"],
  },
  {
    title: "Ordres de Travail",
    href: "/workshop",
    icon: Wrench,
    permission: "ORD_VIEW",
  },
  {
    title: "Véhicules",
    href: "/vehicles",
    icon: Car,
    permission: "VEH_VIEW",
    hideForRoles: ["CAISSIER"],
  },
  {
    title: "Stock & Pièces",
    href: "/stock",
    icon: Package,
    permission: "STK_VIEW",
  },
  {
    title: "Mouvements Stock",
    href: "/stock/movements",
    icon: History,
    permission: "STK_CREATE",
  },
  {
    title: "Facturation",
    href: "/billing",
    icon: FileText,
    permission: "FAC_VIEW",
  },
  {
    title: "Encaisser",
    href: "/cashier/collect",
    icon: FileText,
    roles: ["CAISSIER"],
  },
  {
    title: "Impayés",
    href: "/cashier/receivables",
    icon: Bell,
    roles: ["CAISSIER"],
  },
  {
    title: "Historique caisse",
    href: "/cashier/history",
    icon: History,
    roles: ["CAISSIER"],
    hideForRoles: ["TECHNICIEN"],
  },
  {
    title: "Clôture caisse",
    href: "/cashier/closing",
    icon: FileText,
    roles: ["CAISSIER"],
  },
  {
    title: "Clients",
    href: "/customers",
    icon: Users,
    permission: "VEH_VIEW",
    hideForRoles: ["TECHNICIEN"],
  },
  {
    title: "Historique",
    href: "/history",
    icon: History,
    permission: "ORD_VIEW",
    hideForRoles: ["TECHNICIEN", "CAISSIER"],
  },
  {
    title: "Demandes démo",
    href: "/demo-requests",
    icon: Presentation,
    roles: ["SUPER_ADMIN"],
  },
  {
    title: "Journal d'Audit",
    href: "/audit",
    icon: History,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    title: "Rapports",
    href: "/reports",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SUPER_ADMIN", "CHEF_ATELIER"],
  },
];

export const SETTINGS_ITEMS: NavItem[] = [
  {
    title: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
];

// Statuts OT — alignés sur l'enum OTStatus du backend (Prisma)
export const WORKSHOP_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:          { label: "Brouillon",       color: "bg-slate-100 text-slate-500",    dot: "bg-slate-400" },
  RECEIVED:       { label: "Reçu",            color: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  DIAGNOSING:     { label: "En diagnostic",   color: "bg-amber-50 text-amber-700",     dot: "bg-amber-500" },
  QUOTE_PENDING:  { label: "Devis en attente",color: "bg-orange-50 text-orange-700",   dot: "bg-orange-500" },
  QUOTE_APPROVED: { label: "Devis approuvé",  color: "bg-indigo-50 text-indigo-700",   dot: "bg-indigo-500" },
  IN_PROGRESS:    { label: "En cours",        color: "bg-blue-50 text-blue-700",       dot: "bg-blue-500 animate-pulse" },
  QC_PENDING:     { label: "Contrôle qualité",color: "bg-purple-50 text-purple-700",   dot: "bg-purple-500" },
  QC_REJECTED:    { label: "QC refusé",       color: "bg-red-50 text-red-700",         dot: "bg-red-500" },
  QC_DONE:        { label: "QC validé",       color: "bg-teal-50 text-teal-700",       dot: "bg-teal-500" },
  READY:          { label: "Prêt",            color: "bg-green-50 text-green-700",     dot: "bg-green-500" },
  INVOICED:       { label: "Facturé",         color: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  CLOSED:         { label: "Clôturé",         color: "bg-slate-100 text-slate-500",    dot: "bg-slate-300" },
  CANCELLED:      { label: "Annulé",          color: "bg-red-50 text-red-500",         dot: "bg-red-400" },
};

export const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Brouillon', color: 'bg-slate-100 text-slate-600' },
  SENT:     { label: 'Envoyé',    color: 'bg-blue-50 text-blue-700'    },
  APPROVED: { label: 'Approuvé',  color: 'bg-green-50 text-green-700'  },
  REJECTED: { label: 'Refusé',    color: 'bg-red-50 text-red-700'      },
  REVISED:  { label: 'Révisé',    color: 'bg-amber-50 text-amber-700'  },
  BILLED:   { label: 'Facturé',   color: 'bg-slate-100 text-slate-600' },
};

export function quoteStatusDisplay(status: string) {
  return QUOTE_STATUS[status] ?? { label: status, color: 'bg-muted text-muted-foreground' };
}

/** Mode de validation client (codes SQL → libellés affichés) */
export const QUOTE_APPROVAL_METHOD_LABELS: Record<string, string> = {
  PHYSICAL:     'Bon de devis signé',
  DIGITAL:      'Validation SMS ou email',
  VERBAL_NOTED: 'Accord verbal noté',
};

export function quoteApprovalMethodLabel(method: string | null | undefined): string {
  if (!method) return '';
  return QUOTE_APPROVAL_METHOD_LABELS[method] ?? method.replace(/_/g, ' ').toLowerCase();
}

/** Offset vertical pour barres d'action au-dessus de la BottomNav mobile (68px + safe area). */
export const MOBILE_BOTTOM_NAV_OFFSET = 'calc(68px + env(safe-area-inset-bottom, 0px))';

/** Empilement z-index — popups portés > modales > barre formulaire > bottom nav. */
export const Z_BOTTOM_NAV = 100;
export const Z_DIALOG = 105;
export const Z_MOBILE_FORM_BAR = 110;
export const Z_POPOVER = 120;

/** Statuts sans action atelier possible — exclus des listes « actives ». */
export const OT_TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'] as const;

export function isActiveOT(status: string): boolean {
  return !(OT_TERMINAL_STATUSES as readonly string[]).includes(status);
}
