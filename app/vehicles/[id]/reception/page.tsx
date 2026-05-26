'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { workshopApi, vehiclesApi, handleApiError } from '@/lib/api';
import {
  clearReceptionDraft,
  loadReceptionDraft,
  mergeReceptionDraftItems,
  saveReceptionDraft,
  type ReceptionCheckResult,
  type ReceptionPriority,
  type ReceptionDraftItem,
} from '@/lib/reception-draft';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle, XCircle,
  MinusCircle, ChevronRight, ChevronLeft, Fuel, FileText,
  Car, User, Wrench, ClipboardList,
} from 'lucide-react';

type CheckResult = ReceptionCheckResult;
type Priority    = ReceptionPriority;
type DraftItem   = ReceptionDraftItem;

interface CatalogItem {
  id: string; category: string; labelFr: string; helpText?: string; isBlocking: boolean;
}

function emptyDraftState() {
  return {
    step: 1 as 1 | 2,
    complaint: '',
    priority: 'NORMAL' as Priority,
    mileage: '',
    fuelLevel: 4,
    notes: '',
    items: [] as DraftItem[],
  };
}
const CATEGORY_LABELS: Record<string, string> = {
  EXTERIEUR:  'Extérieur',
  SOUS_CAPOT: 'Sous capot',
  INTERIEUR:  'Intérieur',
  DOCUMENTS:  'Documents',
};
function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function isUsableHelpText(text?: string): boolean {
  if (!text) return false;
  if (text.includes('_')) return false;    // contains snake_case field names
  if (text.startsWith('*')) return false;  // internal marker
  if (text.length > 100) return false;     // internal notes tend to be long
  return true;
}

const RESULT_CFG: Record<CheckResult, { label: string; icon: React.ElementType; active: string; idle: string }> = {
  OK:       { label: 'OK',    icon: CheckCircle2,  active: 'bg-green-500  text-white border-green-500',  idle: 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600 hover:bg-green-500/10' },
  WARNING:  { label: 'Attn', icon: AlertTriangle, active: 'bg-amber-400  text-white border-amber-400',  idle: 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600 hover:bg-amber-400/10' },
  CRITICAL: { label: 'Crit', icon: XCircle,       active: 'bg-red-500    text-white border-red-500',    idle: 'border-border text-muted-foreground hover:border-red-400  hover:text-red-600  hover:bg-red-500/10'   },
  NA:       { label: 'N/A',  icon: MinusCircle,   active: 'bg-muted text-foreground border-border',     idle: 'border-border text-muted-foreground/50 hover:bg-muted'                                               },
};

const PRIORITY_CFG: { value: Priority; label: string; idle: string; active: string }[] = [
  { value: 'LOW',    label: 'Basse',   idle: 'border-border text-muted-foreground hover:bg-muted', active: 'border-slate-400 bg-slate-500/10 text-slate-700 dark:text-slate-200' },
  { value: 'NORMAL', label: 'Normale', idle: 'border-border text-muted-foreground hover:bg-muted', active: 'border-blue-500  bg-blue-500/10  text-blue-700  dark:text-blue-300'  },
  { value: 'HIGH',   label: 'Haute',   idle: 'border-border text-muted-foreground hover:bg-muted', active: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { value: 'URGENT', label: 'Urgent',  idle: 'border-border text-muted-foreground hover:bg-muted', active: 'border-red-500   bg-red-500/10   text-red-700   dark:text-red-300'   },
];

const FUEL_LABELS: Record<number, string> = {
  0: 'E', 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞', 8: 'F',
};

function vehicleName(v: any) { return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || 'Véhicule'; }
function ownerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY' ? (c.companyName || '—') : ([c.firstName, c.lastName].filter(Boolean).join(' ') || '—');
}

export default function ReceptionPage() {
  const params    = useParams();
  const router    = useRouter();
  const vehicleId = params.id as string;

  const initialDraftRef = useRef(loadReceptionDraft(vehicleId));
  const initialDraft = initialDraftRef.current;
  const restoredOnMount = useRef(!!initialDraft);

  const { data: vehicle, loading: vLoading } = useApi(
    () => vehiclesApi.get(vehicleId) as Promise<any>, [vehicleId]
  );

  const [step, setStep]           = useState<1 | 2>(initialDraft?.step ?? 1);
  const [complaint, setComplaint] = useState(initialDraft?.complaint ?? '');
  const [priority,  setPriority]  = useState<Priority>(initialDraft?.priority ?? 'NORMAL');
  const [mileage,   setMileage]   = useState(initialDraft?.mileage ?? '');
  const [catalog,   setCatalog]   = useState<CatalogItem[]>([]);
  const [items,     setItems]     = useState<DraftItem[]>(initialDraft?.items ?? []);
  const [fuelLevel, setFuelLevel] = useState(initialDraft?.fuelLevel ?? 4);
  const [notes,     setNotes]     = useState(initialDraft?.notes ?? '');
  const [noteOpen,  setNoteOpen]  = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!restoredOnMount.current) {
      setDraftReady(true);
      return;
    }
    restoredOnMount.current = false;
    toast('Brouillon restauré', {
      description: 'Votre saisie précédente a été récupérée.',
      action: {
        label: 'Effacer',
        onClick: () => {
          clearReceptionDraft(vehicleId);
          location.reload();
        },
      },
    });
    setDraftReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const empty = emptyDraftState();
    if (
      complaint === empty.complaint &&
      priority === empty.priority &&
      mileage === empty.mileage &&
      step === empty.step &&
      fuelLevel === empty.fuelLevel &&
      notes === empty.notes &&
      items.length === 0
    ) {
      return;
    }
    saveReceptionDraft(vehicleId, { complaint, priority, mileage, step, items, fuelLevel, notes });
  }, [draftReady, vehicleId, complaint, priority, mileage, step, items, fuelLevel, notes]);

  useEffect(() => {
    setLoadingCatalog(true);
    (workshopApi.receptionCatalog() as Promise<CatalogItem[]>)
      .then(d => {
        setCatalog(d);
        setItems(prev => mergeReceptionDraftItems(d, prev.length ? prev : initialDraftRef.current?.items));
      })
      .catch(() => toast.error('Impossible de charger le catalogue'))
      .finally(() => setLoadingCatalog(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = catalog.reduce<Record<string, CatalogItem[]>>((acc, ci) => {
    (acc[ci.category] ??= []).push(ci); return acc;
  }, {});

  function setResult(id: string, r: CheckResult) { setItems(p => p.map(i => i.catalogId === id ? { ...i, result: r } : i)); }
  function setItemNote(id: string, note: string)  { setItems(p => p.map(i => i.catalogId === id ? { ...i, note: note || undefined } : i)); }

  const criticals = items.filter(i => i.result === 'CRITICAL').length;
  const warnings  = items.filter(i => i.result === 'WARNING').length;
  const okCount   = items.filter(i => i.result === 'OK').length;
  const filled    = items.filter(i => i.result !== 'NA').length;

  async function handleSubmit() {
    if (!vehicle) return;
    setSubmitting(true);
    try {
      const ot = await workshopApi.createOT({
        customerId: vehicle.customerId, vehicleId,
        clientComplaint: complaint, priority,
        mileageIn: mileage ? Number(mileage) : undefined,
      }) as any;
      await workshopApi.addReception(ot.id, {
        mileageAtReception: mileage ? Number(mileage) : 0,
        fuelLevel, globalNotes: notes || undefined, checkItems: items,
      });
      clearReceptionDraft(vehicleId);
      toast.success('OT créé et réception enregistrée');
      router.replace(`/workshop/${ot.id}`);
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de la création');
    } finally { setSubmitting(false); }
  }

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'tween', duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="space-y-6"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Wrench size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Réception du véhicule</h1>
            {vLoading
              ? <p className="text-sm text-muted-foreground">Chargement…</p>
              : vehicle && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">{vehicle.plateNumber}</span>
                  {' · '}{vehicleName(vehicle)}{' · '}{ownerName(vehicle.customer)}
                </p>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Stepper ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 max-w-sm">
        {([
          { n: 1 as const, label: 'Ordre de travail',   icon: FileText      },
          { n: 2 as const, label: 'Contrôle réception', icon: ClipboardList },
        ]).map(({ n, label }, idx) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => n < step && setStep(n)}
              disabled={n > step}
              className={cn('flex items-center gap-2', n <= step ? 'cursor-pointer' : 'cursor-default')}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0',
                step === n ? 'bg-brand border-brand text-white shadow shadow-brand/30'
                : step > n  ? 'bg-green-500 border-green-500 text-white'
                : 'border-muted-foreground/30 text-muted-foreground'
              )}>
                {step > n ? <CheckCircle2 size={14} /> : n}
              </span>
              <span className={cn(
                'text-sm font-medium whitespace-nowrap',
                step === n ? 'text-brand' : step > n ? 'text-green-600' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </button>
            {idx === 0 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ════════════════ ÉTAPE 1 ════════════════ */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {vLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ─ Left: context + meta ─ */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car size={14} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Véhicule</span>
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold text-foreground">{vehicle?.plateNumber}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{vehicleName(vehicle)}</p>
                      {vehicle?.currentMileage && (
                        <p className="text-xs text-muted-foreground mt-1">{vehicle.currentMileage.toLocaleString()} km enregistrés</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User size={14} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Client</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{ownerName(vehicle?.customer)}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{vehicle?.customer?.phonePrimary ?? '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priorité</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PRIORITY_CFG.map(p => (
                        <button key={p.value} onClick={() => setPriority(p.value)}
                          className={cn('py-2.5 rounded-lg border text-xs font-medium transition-all', priority === p.value ? p.active : p.idle)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Kilométrage <span className="normal-case font-normal text-muted-foreground/70">(optionnel)</span>
                    </p>
                    <Input
                      type="number"
                      placeholder={vehicle?.currentMileage ? vehicle.currentMileage.toLocaleString() : 'ex : 87 450'}
                      value={mileage} onChange={e => setMileage(e.target.value)}
                      className="bg-muted border-border font-mono"
                    />
                  </div>
                </div>

                {/* ─ Right: complaint ─ */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Symptômes / travaux demandés <span className="text-red-500">*</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Décrivez les plaintes du client et les travaux à réaliser</p>
                    </div>
                    <Textarea
                      placeholder="ex : Bruit métallique au freinage avant droit lors du ralentissement. Fumée noire à l'accélération depuis 3 jours. Le client demande également une vidange..."
                      value={complaint} onChange={e => setComplaint(e.target.value)}
                      className="flex-1 min-h-[220px] bg-muted border-border resize-none text-sm leading-relaxed"
                    />
                    <p className={cn('text-xs', complaint.length >= 10 ? 'text-muted-foreground' : 'text-red-400')}>
                      {complaint.length < 10 ? `${10 - complaint.length} caractères manquants` : `${complaint.length} caractères`}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="border-border" onClick={() => router.back()}>
                      Annuler
                    </Button>
                    <Button
                      className="flex-1 bg-brand hover:bg-brand-hover gap-2"
                      disabled={complaint.trim().length < 10 || vLoading}
                      onClick={() => setStep(2)}
                    >
                      Passer au contrôle <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════ ÉTAPE 2 ════════════════ */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {/* Progress summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border flex-wrap">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avancement</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[80px]">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300"
                  style={{ width: items.length ? `${(filled / items.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">{filled}/{items.length}</span>
              {okCount   > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 border-green-200 dark:border-green-800 dark:text-green-400">{okCount} OK</Badge>}
              {warnings  > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-amber-400/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400">{warnings} Attention</Badge>}
              {criticals > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-700 border-red-200 dark:border-red-800 dark:text-red-400">{criticals} Critique{criticals > 1 ? 's' : ''}</Badge>}
            </div>

            {/* Fuel gauge */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Fuel size={15} className="text-muted-foreground" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Niveau carburant</span>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {FUEL_LABELS[fuelLevel]} ({fuelLevel}/8)
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 9 }, (_, i) => (
                  <button
                    key={i} onClick={() => setFuelLevel(i)} title={`${FUEL_LABELS[i]} (${i}/8)`}
                    className={cn(
                      'flex-1 h-8 rounded transition-all border flex items-center justify-center text-[10px] font-bold',
                      i <= fuelLevel
                        ? fuelLevel <= 1 ? 'bg-red-500 border-red-400 text-white'
                        : fuelLevel <= 3 ? 'bg-amber-400 border-amber-300 text-white'
                        : 'bg-green-500 border-green-400 text-white'
                        : 'bg-muted border-border text-muted-foreground/40 hover:bg-muted/80'
                    )}>
                    {FUEL_LABELS[i]}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog — 2 columns on lg */}
            {loadingCatalog ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(grouped).map(([category, catItems]) => {
                  const done = catItems.filter(ci => items.find(i => i.catalogId === ci.id)?.result !== 'NA').length;
                  return (
                    <div key={category} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">{categoryLabel(category)}</span>
                        <span className={cn('text-[11px] font-mono font-bold', done === catItems.length ? 'text-green-600' : 'text-muted-foreground')}>
                          {done}/{catItems.length}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {catItems.map(ci => {
                          const item   = items.find(i => i.catalogId === ci.id);
                          const result = item?.result ?? 'NA';
                          const help   = isUsableHelpText(ci.helpText) ? ci.helpText : undefined;
                          return (
                            <div key={ci.id}>
                              <div className="flex items-center gap-2 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground leading-snug">
                                    {ci.isBlocking && <span className="text-red-500 mr-1">*</span>}
                                    {ci.labelFr}
                                  </p>
                                  {help && <p className="text-[11px] text-muted-foreground mt-0.5">{help}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {(['OK', 'WARNING', 'CRITICAL', 'NA'] as CheckResult[]).map(r => {
                                    const cfg  = RESULT_CFG[r];
                                    const Icon = cfg.icon;
                                    return (
                                      <button key={r} title={cfg.label} onClick={() => setResult(ci.id, r)}
                                        className={cn(
                                          'w-8 h-8 rounded-lg border flex items-center justify-center transition-all active:scale-90',
                                          result === r ? cfg.active : cfg.idle
                                        )}>
                                        <Icon size={14} strokeWidth={2} />
                                      </button>
                                    );
                                  })}
                                  <button
                                    onClick={() => setNoteOpen(noteOpen === ci.id ? null : ci.id)}
                                    title="Note"
                                    className={cn(
                                      'w-8 h-8 rounded-lg border flex items-center justify-center transition-all ml-0.5',
                                      item?.note ? 'bg-brand/10 text-brand border-brand/30' : 'border-border text-muted-foreground hover:bg-muted'
                                    )}>
                                    <FileText size={13} />
                                  </button>
                                </div>
                              </div>
                              {noteOpen === ci.id && (
                                <div className="px-3 pb-2.5 bg-muted/30">
                                  <Input
                                    autoFocus placeholder="Note sur ce point…"
                                    value={item?.note ?? ''}
                                    onChange={e => setItemNote(ci.id, e.target.value)}
                                    className="bg-background border-border text-sm h-8"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Global notes */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Notes globales <span className="normal-case font-normal text-muted-foreground/70">(optionnel)</span>
              </p>
              <Textarea
                placeholder="Observations générales sur l'état du véhicule…"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="min-h-[80px] bg-muted border-border resize-none text-sm"
              />
            </div>

            {criticals > 0 && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex gap-3 items-start">
                <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  <span className="font-bold">{criticals} point{criticals > 1 ? 's' : ''} critique{criticals > 1 ? 's' : ''} détecté{criticals > 1 ? 's' : ''}.</span>
                  {' '}L'OT sera automatiquement signalé en priorité haute.
                </p>
              </div>
            )}

            <div className="flex gap-3 pb-6">
              <Button variant="outline" className="gap-1.5 border-border" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Retour
              </Button>
              <Button
                className="flex-1 bg-brand hover:bg-brand-hover gap-2"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" />Création en cours…</>
                  : <><Wrench size={16} />Créer l'OT et enregistrer</>
                }
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
