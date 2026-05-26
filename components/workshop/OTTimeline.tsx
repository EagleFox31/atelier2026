'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, Circle, Clock, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';

// ── Pipeline principal (ordre linéaire) ────────────────────────────────────────

const PIPELINE: { status: string; label: string; description: string }[] = [
  { status: 'DRAFT',          label: 'Brouillon',             description: 'OT créé, en attente de réception' },
  { status: 'RECEIVED',       label: 'Reçu',                  description: 'Véhicule réceptionné, contrôle effectué' },
  { status: 'DIAGNOSING',     label: 'En diagnostic',         description: 'Technicien en cours d\'analyse' },
  { status: 'QUOTE_PENDING',  label: 'Devis en attente',      description: 'Devis à préparer et envoyer au client' },
  { status: 'QUOTE_APPROVED', label: 'Devis approuvé',        description: 'Client a validé le devis' },
  { status: 'IN_PROGRESS',    label: 'Travaux en cours',      description: 'Réparations en cours' },
  { status: 'QC_PENDING',     label: 'Contrôle qualité',      description: 'Validation chef d\'atelier — pièces et travaux' },
  { status: 'READY',          label: 'Prêt',                  description: 'Client prévenu, véhicule prêt à restituer' },
  { status: 'INVOICED',       label: 'Facturé',               description: 'Facture émise, paiement en attente' },
  { status: 'CLOSED',         label: 'Clôturé',               description: 'Paiement reçu, véhicule restitué' },
];

const STATUS_TO_IDX = Object.fromEntries(PIPELINE.map((s, i) => [s.status, i])) as Record<string, number>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Person {
  firstName?: string;
  lastName?: string;
}

interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  reason?: string;
  user?: Person;
}

interface OTTimelineProps {
  currentStatus: string;
  statusHistory: HistoryEntry[];
  receptionChecks?: Array<{ checkedAt?: string; checker?: Person | null }>;
  observations?: Array<{ observedAt?: string; observer?: Person | null }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function userName(u?: Person | null) {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
}

/** Index le plus avancé atteint dans le pipeline (gère QC_REJECTED hors pipeline). */
function computeProgressIdx(
  currentStatus: string,
  statusHistory: HistoryEntry[],
  receptionChecks?: OTTimelineProps['receptionChecks'],
): number {
  let maxIdx = currentStatus === 'DRAFT' ? 0 : 0;

  if (receptionChecks?.length) {
    maxIdx = Math.max(maxIdx, STATUS_TO_IDX.RECEIVED ?? 0);
  }

  for (const h of statusHistory) {
    const idx = STATUS_TO_IDX[h.toStatus];
    if (idx !== undefined) maxIdx = Math.max(maxIdx, idx);
  }

  const pipelineStatus = currentStatus === 'QC_DONE' ? 'READY' : currentStatus;

  if (pipelineStatus === 'QC_REJECTED') {
    maxIdx = Math.max(maxIdx, STATUS_TO_IDX.QC_PENDING ?? 0);
  } else if (pipelineStatus !== 'CANCELLED') {
    const curIdx = STATUS_TO_IDX[pipelineStatus];
    if (curIdx !== undefined) maxIdx = Math.max(maxIdx, curIdx);
  }

  return maxIdx;
}

function resolveStepActor(
  stepStatus: string,
  histEntry: HistoryEntry | undefined,
  statusHistory: HistoryEntry[],
  receptionChecks?: OTTimelineProps['receptionChecks'],
  observations?: OTTimelineProps['observations'],
): Person | null | undefined {
  if (stepStatus === 'RECEIVED') {
    const checker = receptionChecks?.[0]?.checker;
    if (checker) return checker;
  }
  if (stepStatus === 'DIAGNOSING' && observations?.length) {
    return observations[0]?.observer;
  }
  if (stepStatus === 'QC_PENDING') {
    return statusHistory.find((h) => h.toStatus === 'QC_PENDING')?.user ?? null;
  }
  return histEntry?.user;
}

function resolveStepDate(
  stepStatus: string,
  histEntry: HistoryEntry | undefined,
  statusHistory: HistoryEntry[],
  receptionChecks?: OTTimelineProps['receptionChecks'],
  observations?: OTTimelineProps['observations'],
): string | undefined {
  if (stepStatus === 'RECEIVED' && receptionChecks?.[0]?.checkedAt) {
    return receptionChecks[0].checkedAt;
  }
  if (stepStatus === 'DIAGNOSING' && observations?.[0]?.observedAt) {
    return observations[0].observedAt;
  }
  if (stepStatus === 'QC_PENDING') {
    return statusHistory.find((h) => h.toStatus === 'QC_PENDING')?.changedAt;
  }
  return histEntry?.changedAt;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const ACTOR_BADGE: Record<string, string> = {
  DRAFT:          'bg-slate-100 text-slate-700',
  RECEIVED:       'bg-violet-100 text-violet-700',
  DIAGNOSING:     'bg-blue-100 text-blue-700',
  QUOTE_PENDING:  'bg-amber-100 text-amber-800',
  QUOTE_APPROVED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS:    'bg-blue-100 text-blue-700',
  QC_PENDING:     'bg-amber-100 text-amber-800',
  QC_REJECTED:    'bg-orange-100 text-orange-800',
  READY:          'bg-emerald-100 text-emerald-700',
  INVOICED:       'bg-purple-100 text-purple-700',
  CLOSED:         'bg-green-100 text-green-800',
};

function CurrentBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wide">
      Actuel
    </span>
  );
}

/** Trait vertical entre deux étapes — commence sous l'icône, pas au centre. */
function TimelineConnector({ active, accent = 'brand' }: { active: boolean; accent?: 'brand' | 'orange' }) {
  return (
    <div
      className={cn(
        'absolute left-[11px] top-7 w-px bottom-0',
        active
          ? accent === 'orange' ? 'bg-orange-400' : 'bg-brand'
          : 'bg-border',
      )}
    />
  );
}

function TimelineIcon({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-card">
      {children}
    </div>
  );
}

function DoneIcon({ color = 'brand' }: { color?: 'brand' | 'orange' }) {
  return (
    <TimelineIcon>
      <span className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full',
        color === 'orange' ? 'bg-orange-500' : 'bg-brand',
      )}>
        <Check size={12} className="text-white stroke-[3]" />
      </span>
    </TimelineIcon>
  );
}

function FutureIcon() {
  return (
    <TimelineIcon>
      <Circle size={18} className="text-border" strokeWidth={2} />
    </TimelineIcon>
  );
}

// ── Composant ──────────────────────────────────────────────────────────────────

export function OTTimeline({
  currentStatus,
  statusHistory,
  receptionChecks,
  observations,
}: OTTimelineProps) {
  const isCancelled = currentStatus === 'CANCELLED';
  const inRework = currentStatus === 'QC_REJECTED';
  const pipelineStatus = currentStatus === 'QC_DONE' ? 'READY' : currentStatus;
  const progressIdx = computeProgressIdx(currentStatus, statusHistory, receptionChecks);

  const qcRejections = [...statusHistory]
    .filter(h => h.toStatus === 'QC_REJECTED')
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  const historyByStatus = statusHistory.reduce<Record<string, HistoryEntry>>((acc, h) => {
    if (!acc[h.toStatus] || new Date(h.changedAt) > new Date(acc[h.toStatus].changedAt)) {
      acc[h.toStatus] = h;
    }
    return acc;
  }, {});

  const latestRejection = qcRejections[qcRejections.length - 1];

  function isStepDone(stepStatus: string, idx: number, isCurrent: boolean, isPendingRework: boolean): boolean {
    if (isCancelled || isCurrent || isPendingRework) return false;
    if (stepStatus === 'DRAFT' && currentStatus !== 'DRAFT') return true;
    if (stepStatus === 'RECEIVED' && (!!receptionChecks?.length || progressIdx >= 1 || !!historyByStatus.RECEIVED)) {
      return true;
    }
    return progressIdx > idx || !!historyByStatus[stepStatus];
  }

  return (
    <div className="space-y-1">
      {isCancelled && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">OT annulé</p>
            {historyByStatus.CANCELLED && (
              <p className="text-xs text-red-500 mt-0.5">
                {fmtDate(historyByStatus.CANCELLED.changedAt)}
                {historyByStatus.CANCELLED.reason && ` — ${historyByStatus.CANCELLED.reason}`}
              </p>
            )}
          </div>
        </div>
      )}

      {qcRejections.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <RotateCcw size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            {qcRejections.length} retour{qcRejections.length > 1 ? 's' : ''} en atelier après contrôle qualité
          </p>
        </div>
      )}

      <ol className="relative">
        {PIPELINE.map((step, idx) => {
          const histEntry = historyByStatus[step.status];
          const stepActor = resolveStepActor(step.status, histEntry, statusHistory, receptionChecks, observations);
          const stepDate = resolveStepDate(step.status, histEntry, statusHistory, receptionChecks, observations);

          const isPendingRework = inRework && step.status === 'IN_PROGRESS';
          const isCurrent = !isCancelled && step.status === pipelineStatus;
          const isDone = isStepDone(step.status, idx, isCurrent, isPendingRework);
          const isFuture = !isDone && !isCurrent && !isPendingRework;

          const hasConnector = idx < PIPELINE.length - 1 || (step.status === 'QC_PENDING' && qcRejections.length > 0);

          return (
            <Fragment key={step.status}>
              <li className="relative flex gap-4">
                {hasConnector && idx < PIPELINE.length - 1 && (
                  <TimelineConnector active={isDone || isCurrent || isPendingRework} />
                )}

                {isCurrent ? (
                  <TimelineIcon>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand ring-2 ring-brand/25">
                      <Clock size={11} className="text-white" />
                    </span>
                  </TimelineIcon>
                ) : isPendingRework ? (
                  <TimelineIcon>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 ring-2 ring-orange-400/25">
                      <RotateCcw size={10} className="text-white" />
                    </span>
                  </TimelineIcon>
                ) : isDone ? (
                  <DoneIcon />
                ) : (
                  <FutureIcon />
                )}

                <div className={cn('pb-6 flex-1 min-w-0', idx === PIPELINE.length - 1 && qcRejections.length === 0 && 'pb-0')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold leading-tight',
                        isCurrent && 'text-brand',
                        isPendingRework && 'text-orange-600',
                        isDone   && 'text-foreground',
                        isFuture && 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                      {isCurrent && <CurrentBadge />}
                      {isPendingRework && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                          Reprise en attente
                        </span>
                      )}
                    </span>
                    {stepDate && (
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {fmtDate(stepDate)}
                      </span>
                    )}
                  </div>

                  <p className={cn(
                    'text-xs mt-0.5',
                    isFuture ? 'text-muted-foreground/60' : 'text-muted-foreground',
                  )}>
                    {step.description}
                  </p>

                  {userName(stepActor) && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      par{' '}
                      <span className={cn(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold',
                        ACTOR_BADGE[step.status] ?? 'bg-muted text-foreground',
                      )}>
                        {userName(stepActor)}
                      </span>
                    </p>
                  )}

                  {histEntry?.reason && step.status !== 'QC_PENDING' && (
                    <p className="text-[11px] italic text-muted-foreground/70 mt-0.5">
                      « {histEntry.reason} »
                    </p>
                  )}
                </div>
              </li>

              {step.status === 'QC_PENDING' && qcRejections.map((rej, rejIdx) => {
                const isRejCurrent = inRework && rej.id === latestRejection?.id;
                const isRejDone = !isRejCurrent;
                const isLastRej = rejIdx === qcRejections.length - 1;

                return (
                  <li key={rej.id} className="relative flex gap-4">
                    {!isLastRej || idx < PIPELINE.length - 1 ? (
                      <TimelineConnector active={isRejDone || isRejCurrent} accent="orange" />
                    ) : null}

                    {isRejCurrent ? (
                      <TimelineIcon>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 ring-2 ring-orange-500/25">
                          <AlertTriangle size={11} className="text-white" />
                        </span>
                      </TimelineIcon>
                    ) : (
                      <DoneIcon color="orange" />
                    )}

                    <div className={cn('pb-6 flex-1 min-w-0', isLastRej && 'pb-0')}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn(
                          'text-sm font-semibold leading-tight',
                          isRejCurrent && 'text-orange-600',
                          isRejDone && 'text-foreground',
                        )}>
                          QC refusé
                          {qcRejections.length > 1 && (
                            <span className="ml-1 text-[10px] font-bold text-orange-600/80">
                              #{rejIdx + 1}
                            </span>
                          )}
                          {isRejCurrent && <CurrentBadge />}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {fmtDate(rej.changedAt)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        Retour atelier — corrections demandées par le chef
                      </p>
                      {userName(rej.user) && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          par{' '}
                          <span className="inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold bg-orange-100 text-orange-800">
                            {userName(rej.user)}
                          </span>
                        </p>
                      )}
                      {rej.reason && (
                        <p className="text-[11px] italic text-orange-700/80 mt-0.5">
                          « {rej.reason} »
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
