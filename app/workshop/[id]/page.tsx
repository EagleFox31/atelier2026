'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import {
  Wrench, Clock, FileText, AlertCircle, User, Car, Loader2, ArrowLeft,
  ShieldAlert, PlusCircle, Stethoscope, ArrowRight, Gauge, Phone, Calendar, Package, CheckCircle2,
  ChevronRight, Receipt,
} from "lucide-react";
import { workshopApi, teamApi, billingApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/contexts/auth-context";
import { WORKSHOP_STATUS, QUOTE_STATUS } from "@/lib/constants";
import { cn, formatXAF } from "@/lib/utils";
import { toast } from "sonner";
import { handleApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { OTTimeline } from "@/components/workshop/OTTimeline";
import { TechMobileBar } from "@/components/workshop/TechMobileBar";
import { resolveTechMobilePrimary } from "@/lib/workshop-tech-mobile";
import { ReceptionInspectionCard } from "@/components/workshop/ReceptionInspectionCard";
import { TechDiagnosticBanner } from "@/components/workshop/TechDiagnosticBanner";
import { TechReworkBanner } from "@/components/workshop/TechReworkBanner";
import { isTechnicianProfile } from "@/lib/role-routing";

const FUEL_LABELS: Record<number, string> = {
  0: 'Vide (E)', 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8', 8: 'Plein (F)',
};

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIEUR: 'Extérieur',
  SOUS_CAPOT: 'Sous capot',
  INTERIEUR: 'Intérieur',
  DOCUMENTS: 'Documents',
};

const RESULT_CONFIG = {
  OK:       { label: 'OK',       cls: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' },
  WARNING:  { label: 'Attention', cls: 'bg-amber-100  text-amber-800  border-amber-300  hover:bg-amber-200'  },
  CRITICAL: { label: 'Critique', cls: 'bg-red-100   text-red-800   border-red-300   hover:bg-red-200'   },
  NA:       { label: 'N/A',      cls: 'bg-muted      text-muted-foreground border-border  hover:bg-muted/80'  },
} as const;

const WORK_ITEM_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'En attente', color: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: 'En cours',  color: 'bg-blue-50 text-blue-700'   },
  COMPLETED:   { label: 'Terminé',   color: 'bg-green-50 text-green-700' },
};

const PART_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'En attente', color: 'bg-slate-100 text-slate-600'  },
  ASP_ORDERED: { label: 'Commandé',  color: 'bg-violet-50 text-violet-700' },
  RECEIVED:    { label: 'Reçu',      color: 'bg-amber-50 text-amber-700'   },
  CONSUMED:    { label: 'Consommé',  color: 'bg-green-50 text-green-700'   },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  ISSUED:  { label: 'Émise',          color: 'bg-blue-50 text-blue-700'     },
  PARTIAL: { label: 'Partiel',        color: 'bg-amber-50 text-amber-700'   },
  PAID:    { label: 'Soldée',         color: 'bg-green-50 text-green-700'   },
  VOID:    { label: 'Annulée',        color: 'bg-red-50 text-red-700'       },
  OVERDUE: { label: 'En retard',      color: 'bg-orange-50 text-orange-700' },
};

const NEXT_STEP: Record<string, { action: string; role: string }> = {
  DRAFT:          { action: 'Réceptionner le véhicule',                    role: 'Réceptionnaire' },
  RECEIVED:       { action: 'Démarrer le diagnostic',                      role: "Chef d'atelier / Technicien assigné" },
  DIAGNOSING:     { action: 'Soumettre le diagnostic et créer un devis',   role: "Chef d'atelier" },
  QUOTE_PENDING:  { action: 'Approuver le devis dans Facturation',          role: "Chef d'atelier / Réception" },
  QUOTE_APPROVED: { action: 'Démarrer les travaux',                        role: "Technicien assigné / Chef d'atelier" },
  IN_PROGRESS:    { action: 'Soumettre au contrôle qualité',               role: 'Technicien assigné' },
  QC_PENDING:     { action: 'Valider le contrôle qualité',               role: "Chef d'atelier" },
  QC_REJECTED:    { action: 'Reprendre les travaux',                       role: 'Technicien assigné' },
  READY:          { action: 'Facturer le client depuis cet OT',            role: "Chef d'atelier / Admin" },
  INVOICED:       { action: "Encaisser et clôturer l'OT",                  role: 'Caissier / Admin' },
};

const OT_TRANSITIONS: Record<string, string[]> = {
  DRAFT:          ['RECEIVED', 'CANCELLED'],
  RECEIVED:       ['DIAGNOSING', 'CANCELLED'],
  DIAGNOSING:     ['QUOTE_PENDING', 'CANCELLED'],
  QUOTE_PENDING:  ['CANCELLED'],
  QUOTE_APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:    ['QC_PENDING', 'CANCELLED'],
  QC_PENDING:     ['READY', 'QC_REJECTED'],
  QC_REJECTED:    ['IN_PROGRESS', 'CANCELLED'],
  QC_DONE:        ['READY'], // legacy
  READY:          ['INVOICED'],
  INVOICED:       ['CLOSED'],
  CLOSED:         [],
  CANCELLED:      [],
};

const STATUS_ACCENT: Record<string, string> = {
  DRAFT:          'bg-slate-400',
  RECEIVED:       'bg-sky-500',
  DIAGNOSING:     'bg-indigo-500',
  QUOTE_PENDING:  'bg-violet-500',
  QUOTE_APPROVED: 'bg-cyan-500',
  IN_PROGRESS:    'bg-blue-500',
  QC_PENDING:     'bg-amber-500',
  QC_REJECTED:    'bg-orange-500',
  QC_DONE:        'bg-teal-500',
  READY:          'bg-emerald-500',
  INVOICED:       'bg-purple-500',
  CLOSED:         'bg-green-600',
  CANCELLED:      'bg-red-500',
};

/** Libellés d'action sur les boutons de transition (≠ badge statut) */
const TRANSITION_BUTTON_LABELS: Record<string, string> = {
  'DRAFT->RECEIVED':              'Confirmer la réception',
  'RECEIVED->DIAGNOSING':         'Démarrer le diagnostic',
  'DIAGNOSING->QUOTE_PENDING':    'Générer un devis',
  'QUOTE_APPROVED->IN_PROGRESS':  'Démarrer les travaux',
  'IN_PROGRESS->QC_PENDING':      'Soumettre au contrôle qualité',
  'QC_PENDING->READY':            'Valider le contrôle qualité',
  'QC_PENDING->QC_REJECTED':      'Refuser — retour atelier',
  'QC_REJECTED->IN_PROGRESS':     'Reprendre les travaux',
  'QC_DONE->READY':               'Marquer le véhicule prêt', // legacy
  'READY->INVOICED':              'Marquer comme facturé',
  'INVOICED->CLOSED':             'Clôturer l\'OT',
};

function transitionButtonLabel(fromStatus: string, toStatus: string, fallback: string) {
  return TRANSITION_BUTTON_LABELS[`${fromStatus}->${toStatus}`] ?? fallback;
}

function vehicleName(v: any) {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || '—';
}
function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function CustomerVipBadge() {
  return (
    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-none shrink-0">
      VIP
    </Badge>
  );
}

export default function OrderDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;
  const { user, hasRole } = useAuth();
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelReason, setCancelReason]   = useState('');
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const [isDiagnosisOpen, setIsDiagnosisOpen]       = useState(false);
  const [diagMode, setDiagMode]                     = useState<'start' | 'add'>('add');
  const [diagDescription, setDiagDescription]       = useState('');
  const [diagCategory, setDiagCategory]             = useState('MECANIQUE');
  const [diagSeverity, setDiagSeverity]             = useState('WARNING');
  const [diagInQuote, setDiagInQuote]               = useState(true);
  const [diagSubmitting, setDiagSubmitting]         = useState(false);

  const [isAssignOpen, setIsAssignOpen]             = useState(false);
  const [assignLoading, setAssignLoading]           = useState(false);
  const [teamMembers, setTeamMembers]               = useState<any[]>([]);
  const [selectedChefId, setSelectedChefId]         = useState('');

  const [isReceptionOpen, setIsReceptionOpen]       = useState(false);
  const [catalogLoading, setCatalogLoading]          = useState(false);
  const [catalogItems, setCatalogItems]              = useState<any[]>([]);
  const [receptionMileage, setReceptionMileage]      = useState('');
  const [receptionFuel, setReceptionFuel]            = useState(4);
  const [receptionNotes, setReceptionNotes]          = useState('');
  const [checkResults, setCheckResults]              = useState<Record<string, { result: string; note: string }>>({});
  const [receptionSubmitting, setReceptionSubmitting] = useState(false);

  const [isQcDialogOpen, setIsQcDialogOpen]             = useState(false);
  const [isQcRejectDialogOpen, setIsQcRejectDialogOpen] = useState(false);
  const [qcRejectReason, setQcRejectReason]             = useState('');
  const [qcItems, setQcItems] = useState<Array<{
    quoteLineId: string;
    label: string;
    used: boolean;
    isAsp: boolean;
    aspPurchasePrice?: number;
  }>>([]);

  function openDiagnosisDialog(mode: 'start' | 'add') {
    setDiagMode(mode);
    setDiagDescription('');
    setDiagCategory('MECANIQUE');
    setDiagSeverity('WARNING');
    setDiagInQuote(true);
    setIsDiagnosisOpen(true);
  }

  async function handleSubmitDiagnosis() {
    if (!diagDescription.trim()) {
      toast.error('La description du diagnostic est obligatoire');
      return;
    }
    setDiagSubmitting(true);
    try {
      await workshopApi.addObservation(id, {
        description:  diagDescription.trim(),
        category:     diagCategory,
        severity:     diagSeverity,
        includeInQuote: diagInQuote,
      });
      if (diagMode === 'start') {
        await workshopApi.updateStatus(id, { status: 'DIAGNOSING' });
        toast.success('Diagnostic démarré');
      } else {
        toast.success('Constat enregistré');
      }
      setIsDiagnosisOpen(false);
      setDiagDescription('');
      refetch();
    } catch (err) {
      handleApiError(err, "Erreur lors de l'enregistrement du diagnostic");
    } finally {
      setDiagSubmitting(false);
    }
  }

  async function openReceptionDialog() {
    setReceptionMileage(order?.mileageIn ? String(order.mileageIn) : '');
    setIsReceptionOpen(true);
    if (catalogItems.length > 0) return;
    setCatalogLoading(true);
    try {
      const items = await workshopApi.receptionCatalog() as any[];
      setCatalogItems(items);
      const initial: Record<string, { result: string; note: string }> = {};
      items.forEach((item: any) => { initial[item.id] = { result: 'NA', note: '' }; });
      setCheckResults(initial);
    } catch (err) {
      handleApiError(err, 'Impossible de charger la fiche de réception');
      setIsReceptionOpen(false);
    } finally {
      setCatalogLoading(false);
    }
  }

  function setItemResult(catalogId: string, result: string) {
    setCheckResults(prev => ({ ...prev, [catalogId]: { ...prev[catalogId], result } }));
  }

  async function handleSubmitReception() {
    const mileage = Number(receptionMileage);
    if (!receptionMileage || mileage <= 0) {
      toast.error('Le kilométrage est obligatoire');
      return;
    }
    setReceptionSubmitting(true);
    try {
      await workshopApi.addReception(id, {
        mileageAtReception: mileage,
        fuelLevel: receptionFuel,
        globalNotes: receptionNotes.trim() || undefined,
        checkItems: catalogItems.map((item: any) => ({
          catalogId: item.id,
          result: checkResults[item.id]?.result ?? 'NA',
          note: checkResults[item.id]?.note?.trim() || undefined,
        })),
      });
      await workshopApi.updateStatus(id, { status: 'RECEIVED' });
      toast.success('Fiche de réception enregistrée — statut → Reçu');
      setIsReceptionOpen(false);
      refetch();
    } catch (err) {
      handleApiError(err, 'Erreur lors de la réception');
    } finally {
      setReceptionSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isAssignOpen || teamMembers.length > 0) return;
    teamApi.list({})
      .then((data: any) => setTeamMembers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isAssignOpen]);

  function openAssignDialog() {
    setIsAssignOpen(true);
  }

  async function handleAssign() {
    if (!selectedChefId) return;
    setAssignLoading(true);
    try {
      await workshopApi.assign(id, { assignedChefId: selectedChefId });
      toast.success('Chef de chantier assigné');
      setIsAssignOpen(false);
      refetch();
    } catch (err) {
      handleApiError(err, "Erreur lors de l'assignation");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelReason.trim()) {
      toast.error("Un motif d'annulation est requis");
      return;
    }
    setStatusLoading(true);
    try {
      await workshopApi.updateStatus(id, { status: 'CANCELLED', cancellationReason: cancelReason });
      toast.success('Statut → Annulé');
      setIsCancelDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      handleApiError(err, "Erreur lors de l'annulation");
    } finally {
      setStatusLoading(false);
    }
  }

  const { data: order, loading, refetch } = useApi(
    () => workshopApi.getOT(id) as Promise<any>,
    [id]
  );

  async function changeStatus(
    newStatus: string,
    extra?: {
      partsReconciliation?: Array<{ quoteLineId: string; used: boolean; aspPurchasePrice?: number }>;
      reason?: string;
    },
  ) {
    if (newStatus === 'CANCELLED' && !cancelReason) {
      toast.error("Un motif d'annulation est requis");
      return;
    }
    if (order?.status === newStatus) {
      await refetch();
      return;
    }
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await workshopApi.updateStatus(id, {
        status: newStatus,
        cancellationReason: cancelReason || undefined,
        ...extra,
      });
      await refetch();
      toast.success(`Statut → ${WORKSHOP_STATUS[newStatus]?.label ?? newStatus}`);
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors du changement de statut');
    } finally {
      setStatusLoading(false);
    }
  }

  function openQcDialog(partLines: any[]) {
    const items = partLines
      .filter((l) =>
        l.lineType === 'PART'
        && (l.partStatus === 'CONSUMED'
          || l.partStatus === 'ASP_ORDERED'
          || l.partStatus === 'STOCK_RESERVED'),
      )
      .map((l) => ({
        quoteLineId: l.id,
        label: l.part?.nameFr ?? l.description ?? 'Pièce',
        used: l.partStatus === 'CONSUMED',
        isAsp: l.partStatus === 'ASP_ORDERED' || !l.partId,
        aspPurchasePrice: undefined as number | undefined,
      }));
    if (items.length === 0) {
      changeStatus('READY');
      return;
    }
    setQcItems(items);
    setIsQcDialogOpen(true);
  }

  async function handleSubmitQc() {
    setStatusLoading(true);
    try {
      await workshopApi.updateStatus(id, {
        status: 'READY',
        partsReconciliation: qcItems.map((item) => ({
          quoteLineId: item.quoteLineId,
          used: item.used,
          aspPurchasePrice: item.isAsp ? item.aspPurchasePrice : undefined,
        })),
      });
      toast.success('Statut → Prêt');
      setIsQcDialogOpen(false);
      await refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de la validation QC');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleConfirmQcReject() {
    if (!qcRejectReason.trim()) {
      toast.error('Le motif de refus est obligatoire');
      return;
    }
    setStatusLoading(true);
    try {
      await workshopApi.updateStatus(id, {
        status: 'QC_REJECTED',
        reason: qcRejectReason.trim(),
      });
      toast.success('Statut → QC refusé');
      setIsQcRejectDialogOpen(false);
      setQcRejectReason('');
      await refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors du refus du contrôle qualité');
    } finally {
      setStatusLoading(false);
    }
  }

  function handleStatusClick(newStatus: string, partLines: any[], currentOrderStatus: string) {
    if (newStatus === 'READY' && currentOrderStatus === 'QC_PENDING') {
      openQcDialog(partLines);
      return;
    }
    if (newStatus === 'QC_REJECTED' && currentOrderStatus === 'QC_PENDING') {
      setQcRejectReason('');
      setIsQcRejectDialogOpen(true);
      return;
    }
    changeStatus(newStatus);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <Skeleton className="h-1 w-full" />
        <div className="p-5 flex items-start gap-4">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  );

  if (!order) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertCircle size={28} className="text-red-400" strokeWidth={1.5} />
      </div>
      <p className="text-muted-foreground text-sm">Ordre de travail introuvable</p>
      <Button variant="outline" className="rounded-xl" onClick={() => router.back()}>Retour</Button>
    </div>
  );

  const st            = WORKSHOP_STATUS[order.status] ?? { label: order.status, color: '', dot: '' };
  const nextStatuses  = OT_TRANSITIONS[order.status] ?? [];
  const observations: any[] = order.observations ?? [];
  const receptionChecks: any[] = order.receptionChecks ?? [];
  const workItems: any[]    = order.workItems ?? [];
  const quotes: any[]       = order.quotes ?? [];
  const invoices: any[]     = order.invoices ?? [];
  const partLines: any[] = quotes.flatMap((q: any) => q.lines ?? []).filter(
    (l: any) => l.lineType === 'PART' && l.partStatus !== 'CANCELLED',
  );
  const statusHistory: any[] = order.statusHistory ?? [];
  const latestQcRejection = [...statusHistory]
    .filter((h: { toStatus?: string }) => h.toStatus === 'QC_REJECTED')
    .sort((a: { changedAt: string }, b: { changedAt: string }) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    )[0];
  const isClosed    = order.status === 'CLOSED';
  const isCancelled = order.status === 'CANCELLED';

  const isAdmin    = hasRole('ADMIN');
  const isChef     = hasRole('CHEF_ATELIER');
  const isAssigned = !!user?.id && user.id === order.assignedChef;
  const canDiagnose = isAdmin || isChef || isAssigned;
  const canSubmitQuote = isAdmin || isChef;
  const canCancel   = isAdmin || isChef;
  const canValidateQc = isAdmin || isChef || hasRole('SUPER_ADMIN');
  const isTechnician = isTechnicianProfile(user);
  const techMobilePrimary = isTechnician
    ? resolveTechMobilePrimary(order.status, { canDiagnose, isAssigned })
    : null;
  const showReceptionForDiag = ['RECEIVED', 'DIAGNOSING'].includes(order.status);
  const showReworkBanner = order.status === 'QC_REJECTED' && (isAssigned || isAdmin || isChef);
  const canResumeWork = isAssigned || isAdmin || isChef;
  const canInvoice    = isAdmin || isChef || hasRole('SUPER_ADMIN');

  async function handleFacturer() {
    const approvedQuote = quotes.find((q: any) => q.status === 'APPROVED');
    if (!approvedQuote) {
      toast.error('Aucun devis approuvé trouvé sur cet OT');
      return;
    }
    setStatusLoading(true);
    try {
      await billingApi.createInvoiceFromQuote(approvedQuote.id);
      await workshopApi.updateStatus(id, { status: 'INVOICED' });
      toast.success('Facture émise — OT marqué comme facturé');
      refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de la facturation');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleGenerateQuote() {
    if (observations.length === 0) {
      toast.error('Le technicien doit enregistrer au moins un constat avant de générer le devis');
      return;
    }
    const quoteUrl = `/billing/quotes/new?serviceOrderId=${id}`;
    if (order.status === 'QUOTE_PENDING') {
      router.push(quoteUrl);
      return;
    }
    setStatusLoading(true);
    try {
      await workshopApi.updateStatus(id, { status: 'QUOTE_PENDING' });
      toast.success('Statut → Devis en attente');
      router.push(quoteUrl);
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors du passage en devis en attente');
    } finally {
      setStatusLoading(false);
    }
  }

  const accentCls = STATUS_ACCENT[order.status] ?? 'bg-brand';

  return (
    <div className={cn('space-y-6', isTechnician && 'pb-28 md:pb-0')}>

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Status color strip */}
        <div className={cn('h-1 w-full', accentCls)} />

        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: identity */}
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}
                className="shrink-0 rounded-xl h-9 w-9 mt-0.5">
                <ArrowLeft size={18} />
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">
                    {order.reference}
                  </h1>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border-none',
                    st.color
                  )}>
                    {!isClosed && !isCancelled && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    )}
                    {st.label}
                  </span>
                  <Badge variant="outline" className={cn('border text-[10px] font-bold rounded-full',
                    order.priority === 'URGENT' ? 'border-red-200 bg-red-50 text-red-700' :
                    order.priority === 'HIGH'   ? 'border-orange-200 bg-orange-50 text-orange-700' :
                    'border-border text-muted-foreground'
                  )}>{order.priority}</Badge>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar size={11} />
                    Ouvert le {new Date(order.openedAt).toLocaleDateString('fr-FR')}
                  </span>
                  {order.promisedAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock size={11} />
                      Promis le {new Date(order.promisedAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {order.mileageIn && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Gauge size={11} />
                      {order.mileageIn.toLocaleString()} km à l&apos;entrée
                    </span>
                  )}
                </div>

                {/* Mobile : client dans l'en-tête OT */}
                {order.customer && (
                  <div className="md:hidden mt-3 pt-3 border-t border-border/60 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                      {initials(customerName(order.customer))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <Link
                          href={`/customers/${order.customerId}`}
                          className="font-semibold text-sm text-brand hover:underline leading-tight truncate"
                        >
                          {customerName(order.customer)}
                        </Link>
                        {order.customer.isVip && <CustomerVipBadge />}
                      </div>
                      {order.customer.phonePrimary && (
                        <a
                          href={`tel:${order.customer.phonePrimary.replace(/\s/g, '')}`}
                          className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-foreground transition-colors"
                        >
                          <Phone size={10} className="shrink-0" />
                          {order.customer.phonePrimary}
                        </a>
                      )}
                    </div>
                    <Link
                      href={`/customers/${order.customerId}`}
                      className="shrink-0 text-muted-foreground hover:text-brand transition-colors p-1"
                      aria-label="Voir la fiche client"
                    >
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0 shrink-0">
              {statusLoading && <Loader2 size={15} className="animate-spin text-muted-foreground" />}

              {order.status === 'QUOTE_PENDING' && quotes.length === 0 && (isAdmin || isChef) && (
                <Button size="sm" className="bg-brand hover:bg-brand-hover gap-1.5 font-bold rounded-xl"
                  disabled={statusLoading}
                  onClick={() => handleGenerateQuote()}>
                  <PlusCircle size={14} /> Créer le devis
                </Button>
              )}

              {order.status === 'RECEIVED' && canDiagnose && (
                <Button size="sm" className="bg-brand hover:bg-brand-hover gap-1.5 font-bold rounded-xl hidden md:inline-flex"
                  onClick={() => openDiagnosisDialog('start')}>
                  <Stethoscope size={14} /> Commencer le diagnostic
                </Button>
              )}

              {order.status === 'DIAGNOSING' && canDiagnose && (
                <Button size="sm" variant="outline" className="gap-1.5 font-bold rounded-xl hidden md:inline-flex"
                  onClick={() => openDiagnosisDialog('add')}>
                  <PlusCircle size={14} /> Ajouter un constat
                </Button>
              )}

              {/* Bouton Facturer — READY→INVOICED, visible uniquement chef/admin */}
              {order.status === 'READY' && canInvoice && (
                <Button
                  size="sm"
                  className="bg-brand hover:bg-brand-hover gap-1.5 font-bold rounded-xl"
                  disabled={statusLoading}
                  onClick={handleFacturer}
                >
                  <Receipt size={14} /> Facturer
                </Button>
              )}

              {nextStatuses.filter(s => s !== 'CANCELLED').map(s => {
                const nst = WORKSHOP_STATUS[s];
                const isReceptionTransition = order.status === 'DRAFT'      && s === 'RECEIVED';
                const isStartDiagTransition = order.status === 'RECEIVED'   && s === 'DIAGNOSING';
                const isDiagnosisTransition = order.status === 'DIAGNOSING' && s === 'QUOTE_PENDING';
                // READY→INVOICED géré par le bouton Facturer ci-dessus
                if (order.status === 'READY' && s === 'INVOICED') return null;
                if (isStartDiagTransition) return null;
                if (isDiagnosisTransition && !canSubmitQuote) return null;
                if (isReceptionTransition && isTechnician) return null;
                if (
                  order.status === 'QC_PENDING'
                  && (s === 'READY' || s === 'QC_REJECTED')
                  && !canValidateQc
                ) return null;
                if (order.status === 'QC_REJECTED' && s === 'IN_PROGRESS' && !canResumeWork) return null;
                const hideStatusOnMobile = isTechnician
                  && techMobilePrimary?.kind === 'status'
                  && techMobilePrimary.targetStatus === s;
                return (
                  <Button key={s} size="sm" variant="outline"
                    className={cn(
                      'border font-bold text-xs rounded-xl gap-1.5',
                      nst?.color,
                      hideStatusOnMobile && 'hidden md:inline-flex',
                    )}
                    disabled={statusLoading}
                    onClick={() => {
                      if (isReceptionTransition) return openReceptionDialog();
                      if (isDiagnosisTransition) return handleGenerateQuote();
                      handleStatusClick(s, partLines, order.status);
                    }}>
                    <ArrowRight size={13} /> {transitionButtonLabel(order.status, s, nst?.label ?? s)}
                  </Button>
                );
              })}

              {nextStatuses.includes('CANCELLED') && canCancel && (
                <Button size="sm" variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs rounded-xl border border-red-200"
                  disabled={statusLoading}
                  onClick={() => { setCancelReason(''); setIsCancelDialogOpen(true); }}>
                  Annuler l&apos;OT
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ligne 1 : Plainte client + Client (même hauteur) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
              <FileText size={12} /> Plainte client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {order.clientComplaint
                ? <span className="italic">&ldquo;{order.clientComplaint}&rdquo;</span>
                : <span className="text-muted-foreground italic">Aucune description</span>
              }
            </p>
          </CardContent>
        </Card>

        <Card className="hidden lg:block rounded-2xl border-border shadow-sm">
          <CardContent className="pt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <User size={11} /> Client
            </p>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 select-none">
                {initials(customerName(order.customer))}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-sm text-foreground leading-tight">
                    {customerName(order.customer)}
                  </p>
                  {order.customer?.isVip && <CustomerVipBadge />}
                </div>
                {order.customer?.phonePrimary && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Phone size={10} /> {order.customer.phonePrimary}
                  </p>
                )}
                <Button variant="link" className="p-0 h-auto text-xs text-brand mt-1.5 block"
                  onClick={() => router.push(`/customers/${order.customerId}`)}>
                  Voir la fiche →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile : véhicule avant l'inspection réception */}
      {order.vehicle && (
        <Link
          href={`/vehicles/${order.vehicle.id}`}
          className="lg:hidden block rounded-2xl border border-border bg-card shadow-sm p-4 hover:border-brand/40 hover:bg-brand/5 transition-all group"
        >
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <Car size={11} /> Véhicule
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Car size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground group-hover:text-brand transition-colors leading-tight truncate">
                {vehicleName(order.vehicle)}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                  {order.vehicle.plateNumber ?? '—'}
                </span>
                {order.mileageIn && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Gauge size={10} /> {order.mileageIn.toLocaleString()} km
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-brand shrink-0 transition-colors" />
          </div>
        </Link>
      )}

      {(receptionChecks.length > 0 || showReceptionForDiag) && (
        <ReceptionInspectionCard
          receptionChecks={receptionChecks}
          highlight={showReceptionForDiag && (isTechnician || canDiagnose)}
        />
      )}

      {isTechnician && showReceptionForDiag && (
        <TechDiagnosticBanner
          status={order.status}
          canDiagnose={canDiagnose}
          observationCount={observations.length}
          onStartDiagnosis={() => openDiagnosisDialog('start')}
          onAddConstat={() => openDiagnosisDialog('add')}
        />
      )}

      {showReworkBanner && (
        <TechReworkBanner
          rejectionReason={latestQcRejection?.reason}
          onResume={() => changeStatus('IN_PROGRESS')}
          loading={statusLoading}
        />
      )}

      {/* ── Ligne 2+ : contenu principal + sidebar ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Observations */}
          {observations.length > 0 && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                  <AlertCircle size={12} className="text-amber-500" /> Constats technicien ({observations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {observations.map(obs => (
                  <div key={obs.id} className={cn(
                    'p-3.5 rounded-xl bg-muted/30 border-l-4',
                    obs.severity === 'URGENT'  ? 'border-l-red-400'   :
                    obs.severity === 'WARNING' ? 'border-l-amber-400' :
                                                'border-l-blue-400'
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] border-border rounded-full py-0">
                        {obs.category}
                      </Badge>
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide',
                        obs.severity === 'URGENT'  ? 'text-red-500'   :
                        obs.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500'
                      )}>{obs.severity}</span>
                    </div>
                    <p className="text-sm text-foreground">{obs.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Travaux */}
          {workItems.length > 0 && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                  <Wrench size={12} className="text-brand" /> Travaux ({workItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="pl-6 text-xs">Prestation</TableHead>
                      <TableHead className="text-xs">Technicien</TableHead>
                      <TableHead className="text-xs">Heures</TableHead>
                      <TableHead className="text-right pr-6 text-xs">P.U.</TableHead>
                      <TableHead className="text-xs">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workItems.map(wi => {
                      const wst = WORK_ITEM_STATUS[wi.status] ?? { label: wi.status, color: 'bg-slate-100 text-slate-600' };
                      return (
                        <TableRow key={wi.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="pl-6 font-medium text-sm">
                            {wi.laborCatalog?.descriptionFr ?? wi.customDescription ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {wi.technician ? `${wi.technician.firstName} ${wi.technician.lastName}` : '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{wi.estimatedHours ?? '—'}h</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold pr-6 tabular-nums">
                            {formatXAF(wi.unitPriceXaf)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px] border-none rounded-full', wst.color)}>
                              {wst.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Pièces */}
          {(() => {
            if (partLines.length === 0) return null;
            return (
              <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                    <Package size={12} className="text-brand" /> Pièces ({partLines.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="pl-6 text-xs">Désignation</TableHead>
                        <TableHead className="text-xs">Réf.</TableHead>
                        <TableHead className="text-xs">Qté</TableHead>
                        <TableHead className="text-right pr-6 text-xs">P.U.</TableHead>
                        <TableHead className="text-xs">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partLines.map((line: any) => {
                        const pst = PART_STATUS[line.partStatus ?? 'PENDING'] ?? PART_STATUS.PENDING;
                        return (
                          <TableRow key={line.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="pl-6 font-medium text-sm">
                              {line.part?.nameFr ?? line.description ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {line.part?.reference ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {Number(line.quantity)} {line.part?.unit ?? ''}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold pr-6 tabular-nums">
                              {formatXAF(line.unitPriceXaf)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-[10px] border-none rounded-full', pst.color)}>
                                {pst.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}

          {/* Devis */}
          {quotes.length > 0 && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                  <FileText size={12} className="text-brand" /> Devis ({quotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quotes.map(q => (
                  <div key={q.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all group"
                    onClick={() => router.push(`/billing/quotes/${q.id}`)}>
                    <div>
                      <span className="text-sm font-mono font-bold text-foreground group-hover:text-brand transition-colors">
                        {q.reference}
                      </span>
                      <span className="text-xs text-muted-foreground ml-3">
                        {new Date(q.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono tabular-nums">{formatXAF(q.totalXaf)}</span>
                      <Badge className={cn("text-[10px] border-none rounded-full", (QUOTE_STATUS[q.status] ?? QUOTE_STATUS.DRAFT).color)}>
                        {(QUOTE_STATUS[q.status] ?? { label: q.status }).label}
                      </Badge>
                      <ArrowRight size={14} className="text-muted-foreground group-hover:text-brand transition-colors" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Factures */}
          {invoices.length > 0 && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                  <Receipt size={12} className="text-brand" /> Factures ({invoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoices.map((inv: any) => {
                  const ist = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: 'bg-muted text-muted-foreground' };
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all group"
                      onClick={() => router.push(`/billing/invoices/${inv.id}`)}
                    >
                      <div>
                        <span className="text-sm font-mono font-bold text-foreground group-hover:text-brand transition-colors">
                          {inv.reference}
                        </span>
                        <span className="text-xs text-muted-foreground ml-3">
                          {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('fr-FR') : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono tabular-nums">{formatXAF(inv.totalXaf)}</span>
                        <Badge className={cn('text-[10px] border-none rounded-full', ist.color)}>
                          {ist.label}
                        </Badge>
                        <ArrowRight size={14} className="text-muted-foreground group-hover:text-brand transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {observations.length === 0 && workItems.length === 0 && quotes.length === 0 && invoices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/20">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Wrench size={22} strokeWidth={1.5} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">Aucun contenu pour le moment</p>
              <p className="text-xs text-muted-foreground/70">Les observations et travaux apparaîtront ici</p>
            </div>
          )}

          {/* Prochaine étape — toujours visible tant que l'OT est actif */}
          {NEXT_STEP[order.status] && !isClosed && !isCancelled && (
            <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/5 to-transparent p-5 space-y-2">
              <p className="text-[10px] font-bold text-brand uppercase tracking-widest flex items-center gap-1.5">
                <ArrowRight size={10} />
                Prochaine étape
              </p>
              <p className="text-sm font-semibold text-foreground">
                {NEXT_STEP[order.status].action}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User size={11} />
                {NEXT_STEP[order.status].role}
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Véhicule — desktop sidebar */}
          <Card className="hidden lg:block rounded-2xl border-border shadow-sm">
            <CardContent className="pt-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Car size={11} /> Véhicule
              </p>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Car size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">
                    {vehicleName(order.vehicle)}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted px-1.5 py-0.5 rounded-md inline-block">
                    {order.vehicle?.plateNumber ?? '—'}
                  </p>
                  {order.mileageIn && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Gauge size={10} /> {order.mileageIn.toLocaleString()} km
                    </p>
                  )}
                  {order.vehicle?.id && (
                    <Button variant="link" className="p-0 h-auto text-xs text-brand mt-1.5 block"
                      onClick={() => router.push(`/vehicles/${order.vehicle.id}`)}>
                      Voir la fiche →
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chef de chantier */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Wrench size={11} /> Chef de chantier
                </p>
                {(isAdmin || isChef) && !isClosed && !isCancelled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-semibold border-brand/30 text-brand hover:bg-brand/5 px-3 rounded-lg"
                    onClick={openAssignDialog}
                  >
                    {order.chef ? 'Changer' : 'Assigner'}
                  </Button>
                )}
              </div>
              {order.chef ? (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 select-none">
                    {initials(`${order.chef.firstName ?? ''} ${order.chef.lastName ?? ''}`)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {order.chef.firstName} {order.chef.lastName}
                    </p>
                    {order.chef.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{order.chef.email}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Non assigné</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                <Clock size={12} className="text-brand" /> Parcours de l&apos;OT
              </CardTitle>
              <p className="text-xs text-muted-foreground">Étapes passées, actuelle et à venir</p>
            </CardHeader>
            <CardContent>
              <OTTimeline
                currentStatus={order.status}
                statusHistory={statusHistory}
                receptionChecks={receptionChecks}
                observations={observations}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialog diagnostic ─────────────────────────────────────────────── */}
      <Dialog open={isDiagnosisOpen} onOpenChange={setIsDiagnosisOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope size={18} className="text-amber-500" />
              Diagnostic — {order.reference}
            </DialogTitle>
            <DialogDescription>
              {diagMode === 'start' && (
                <>Saisissez votre premier constat technique. L&apos;OT passera en <strong>Diagnostic</strong> une fois enregistré.</>
              )}
              {diagMode === 'add' && (
                <>Documentez un constat complémentaire pour le chef d&apos;atelier.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Constat du technicien <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Ex: Démarreur défaillant — dents d'engrenage usées. Courroie de distribution à remplacer impérativement."
                value={diagDescription}
                onChange={e => setDiagDescription(e.target.value)}
                className="min-h-[100px] bg-muted border-border text-sm rounded-xl"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Catégorie</Label>
                <Select value={diagCategory} onValueChange={v => v && setDiagCategory(v)}>
                  <SelectTrigger className="bg-muted border-border rounded-xl">
                    <SelectValue>{diagCategory.charAt(0) + diagCategory.slice(1).toLowerCase()}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {['MECANIQUE','ELECTRIQUE','CARROSSERIE','PNEUMATIQUE','CLIMATISATION','TRANSMISSION','SUSPENSION','AUTRE'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Sévérité</Label>
                <Select value={diagSeverity} onValueChange={v => v && setDiagSeverity(v)}>
                  <SelectTrigger className="bg-muted border-border rounded-xl">
                    <SelectValue>
                      {diagSeverity === 'INFO' ? 'Info' : diagSeverity === 'WARNING' ? 'Attention' : 'Urgent'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARNING">Attention</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={diagInQuote}
                onChange={e => setDiagInQuote(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-brand"
              />
              <span className="text-sm text-foreground">
                Inclure dans le devis{' '}
                <span className="text-xs text-muted-foreground">(visible par le client)</span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsDiagnosisOpen(false)} disabled={diagSubmitting}>
              Annuler
            </Button>
            <Button
              className="rounded-xl font-bold"
              onClick={handleSubmitDiagnosis}
              disabled={diagSubmitting || !diagDescription.trim()}
            >
              {diagSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
              {diagMode === 'start' && 'Démarrer le diagnostic'}
              {diagMode === 'add' && 'Enregistrer le constat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog réception ──────────────────────────────────────────────── */}
      <Dialog open={isReceptionOpen} onOpenChange={setIsReceptionOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-brand" />
              Fiche de réception — {order.reference}
            </DialogTitle>
            <DialogDescription>
              Renseignez l&apos;état du véhicule à l&apos;entrée. Les points{' '}
              <span className="text-red-600 font-semibold">Critique</span> seront signalés au client.
            </DialogDescription>
          </DialogHeader>

          {catalogLoading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
              Chargement de la fiche…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mileage" className="text-sm font-semibold">
                    Kilométrage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="mileage"
                    type="number"
                    placeholder="87400"
                    value={receptionMileage}
                    onChange={e => setReceptionMileage(e.target.value)}
                    className="bg-muted border-border rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Niveau carburant</Label>
                  <Select value={String(receptionFuel)} onValueChange={v => setReceptionFuel(Number(v))}>
                    <SelectTrigger className="bg-muted border-border rounded-xl">
                      <SelectValue>{FUEL_LABELS[receptionFuel]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FUEL_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ScrollArea className="h-[380px] rounded-xl border border-border pr-3">
                <div className="space-y-5 p-1">
                  {Object.entries(
                    catalogItems.reduce((acc: Record<string, any[]>, item: any) => {
                      (acc[item.category] = acc[item.category] || []).push(item);
                      return acc;
                    }, {})
                  ).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                        {CATEGORY_LABELS[category] ?? category}
                      </p>
                      <div className="space-y-1.5">
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-xl px-2.5 py-1.5 hover:bg-muted/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-foreground">{item.labelFr}</span>
                              {item.isBlocking && (
                                <Badge variant="outline" className="ml-2 text-[10px] border-red-200 text-red-600 py-0 rounded-full">
                                  bloquant
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {(['NA', 'OK', 'WARNING', 'CRITICAL'] as const).map(result => {
                                const cfg = RESULT_CONFIG[result];
                                const active = (checkResults[item.id]?.result ?? 'NA') === result;
                                return (
                                  <button
                                    key={result}
                                    type="button"
                                    onClick={() => setItemResult(item.id, result)}
                                    className={cn(
                                      'px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition-all',
                                      active ? cfg.cls : 'bg-transparent text-muted-foreground border-transparent hover:border-border'
                                    )}
                                  >
                                    {cfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Notes globales</Label>
                <Textarea
                  placeholder="Observations générales sur l'état du véhicule…"
                  value={receptionNotes}
                  onChange={e => setReceptionNotes(e.target.value)}
                  className="min-h-[72px] bg-muted border-border text-sm rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsReceptionOpen(false)} disabled={receptionSubmitting}>
              Annuler
            </Button>
            <Button
              className="rounded-xl font-bold"
              onClick={handleSubmitReception}
              disabled={receptionSubmitting || catalogLoading || !receptionMileage}
            >
              {receptionSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
              Enregistrer et passer en Reçu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQcRejectDialogOpen} onOpenChange={setIsQcRejectDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle>Refuser le contrôle qualité</DialogTitle>
            <DialogDescription>
              Indiquez ce que le technicien doit corriger sur{' '}
              <span className="font-mono font-bold">{order.reference}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Ex: Fuite persistante, serrage insuffisant, pièce mal montée…"
              value={qcRejectReason}
              onChange={(e) => setQcRejectReason(e.target.value)}
              className="min-h-[100px] bg-muted border-border rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => { setIsQcRejectDialogOpen(false); setQcRejectReason(''); }}
              disabled={statusLoading}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-bold"
              onClick={handleConfirmQcReject}
              disabled={statusLoading || !qcRejectReason.trim()}
            >
              {statusLoading && <Loader2 size={15} className="animate-spin mr-2" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog annulation ─────────────────────────────────────────────── */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle>Annuler l&apos;Ordre de Travail</DialogTitle>
            <DialogDescription>
              Saisissez le motif d&apos;annulation pour{' '}
              <span className="font-mono font-bold">{order.reference}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Ex: Le client a changé d'avis, pièces introuvables…"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="min-h-[100px] bg-muted border-border rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl"
              onClick={() => { setIsCancelDialogOpen(false); setCancelReason(''); }}
              disabled={statusLoading}>
              Fermer
            </Button>
            <Button variant="destructive" className="rounded-xl font-bold"
              onClick={handleConfirmCancel}
              disabled={statusLoading || !cancelReason.trim()}>
              {statusLoading && <Loader2 size={15} className="animate-spin mr-2" />}
              Confirmer l&apos;annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog assignation chef de chantier ───────────────────────────── */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={16} className="text-brand" />
              Assigner un responsable
            </DialogTitle>
            <DialogDescription>
              Chef d&apos;atelier ou technicien responsable de cet OT.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            {teamMembers.length === 0 ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Chargement…</span>
              </div>
            ) : (() => {
              const eligible = teamMembers
                .filter((m: any) => {
                  const code = m.roles?.[0]?.role?.code ?? '';
                  return code === 'CHEF_ATELIER' || code === 'TECHNICIEN';
                })
                .filter((m: any, i: number, arr: any[]) =>
                  arr.findIndex((x: any) => x.id === m.id) === i
                );
              return (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {eligible.map((m: any) => {
                    const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim();
                    const roleLabel = m.roles?.[0]?.role?.label ?? '';
                    const isChefRole = m.roles?.[0]?.role?.code === 'CHEF_ATELIER';
                    const selected = selectedChefId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedChefId(m.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border',
                          selected
                            ? 'bg-brand/8 border-brand/40'
                            : 'border-transparent hover:bg-muted/60'
                        )}
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
                          isChefRole ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {initials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{roleLabel}</p>
                        </div>
                        {selected && <CheckCircle2 size={16} className="text-brand shrink-0" />}
                      </button>
                    );
                  })}
                  {eligible.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun technicien disponible</p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsAssignOpen(false)} disabled={assignLoading}>
              Annuler
            </Button>
            <Button
              className="rounded-xl font-bold"
              onClick={handleAssign}
              disabled={assignLoading || !selectedChefId}
            >
              {assignLoading && <Loader2 size={14} className="animate-spin mr-2" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQcDialogOpen} onOpenChange={setIsQcDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Contrôle qualité — pièces</DialogTitle>
            <DialogDescription>
              Cochez les pièces réellement utilisées. Les pièces non cochées seront remises en stock.
              Pour les achats spéciaux (ASP), indiquez le prix d&apos;achat réel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
            {qcItems.map((item, idx) => (
              <div key={item.quoteLineId} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  {!item.isAsp && (
                    <Checkbox
                      id={`qc-used-${item.quoteLineId}`}
                      checked={item.used}
                      onCheckedChange={(checked) => {
                        setQcItems((prev) => prev.map((p, i) =>
                          i === idx ? { ...p, used: checked === true } : p,
                        ));
                      }}
                    />
                  )}
                  <Label htmlFor={`qc-used-${item.quoteLineId}`} className="text-sm font-medium flex-1 cursor-pointer">
                    {item.label}
                    {item.isAsp && (
                      <Badge className="ml-2 text-[10px] bg-amber-500/10 text-amber-600 border-none">ASP</Badge>
                    )}
                  </Label>
                </div>
                {item.isAsp && (
                  <div className="pl-7">
                    <Label className="text-xs text-muted-foreground">Prix d&apos;achat réel (XAF)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1 rounded-xl"
                      placeholder="Ex. 45000"
                      value={item.aspPurchasePrice ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        setQcItems((prev) => prev.map((p, i) =>
                          i === idx ? { ...p, aspPurchasePrice: val } : p,
                        ));
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setIsQcDialogOpen(false)} disabled={statusLoading}>
              Annuler
            </Button>
            <Button className="rounded-xl font-bold" onClick={handleSubmitQc} disabled={statusLoading}>
              {statusLoading && <Loader2 size={14} className="animate-spin mr-2" />}
              Valider le contrôle qualité
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isTechnician && (
        <TechMobileBar
          status={order.status}
          canDiagnose={canDiagnose}
          isAssigned={isAssigned}
          loading={statusLoading}
          onOpenDiagnosis={openDiagnosisDialog}
          onStatusChange={changeStatus}
        />
      )}
    </div>
  );
}
