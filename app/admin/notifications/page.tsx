'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { superAdminApi, type CustomerNotificationsHealth, type HealthLevel } from '@/lib/api';
import {
  EVENT_LABELS,
  SKIP_REASON_LABELS,
  STATUS_LABELS,
  type CustomerNotificationEvent,
  type CustomerNotificationStatus,
} from '@/lib/customer-notifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, OctagonAlert, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEVEL_STYLES: Record<HealthLevel, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ok:       { label: 'Opérationnel', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  warning:  { label: 'À surveiller', className: 'bg-amber-50 text-amber-800 border-amber-200',       icon: AlertTriangle },
  critical: { label: 'Critique',     className: 'bg-red-50 text-red-800 border-red-200',             icon: OctagonAlert },
};

const MODE_LABELS: Record<CustomerNotificationsHealth['config']['mode'], string> = {
  off: 'Désactivé (aucun envoi)',
  sandbox: 'Sandbox (numéros de test seulement)',
  live: 'Production (clients réels)',
};

const ERROR_LABELS: Record<string, string> = {
  UNKNOWN_OUTCOME: 'Issue inconnue (non renvoyé)',
  MISSING_VARIABLE: 'Variable manquante',
  UNKNOWN: 'Sans code',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 italic">{children}</p>;
}

export default function CustomerNotificationsHealthPage() {
  const [health, setHealth] = useState<CustomerNotificationsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await superAdminApi.customerNotificationsHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la supervision.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const level = health ? LEVEL_STYLES[health.status] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications client</h1>
          <p className="text-slate-500 text-sm">Supervision plateforme — WhatsApp, file d’envoi et plafonds</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading} className="gap-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Actualiser
        </Button>
      </div>

      {loading && !health ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error}
        </div>
      ) : health && level ? (
        <>
          <div data-testid="health-status" className={cn('rounded-2xl border p-5 space-y-2', level.className)}>
            <div className="flex items-center gap-2 font-semibold">
              <level.icon size={18} /> {level.label}
              <span className="ml-auto text-xs font-normal opacity-75">
                {new Date(health.generatedAt).toLocaleString('fr-FR')}
              </span>
            </div>
            {health.alerts.length > 0 && (
              <ul className="space-y-1 text-sm">
                {health.alerts.map((alert) => (
                  <li key={alert.code}>
                    <span className="font-mono text-xs mr-2">{alert.code}</span>{alert.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Configuration">
              <Row label="Mode" value={MODE_LABELS[health.config.mode]} />
              <Row
                label="Fournisseur WhatsApp"
                value={`${health.config.whatsappProvider}${health.config.providerSimulated ? ' (simulé)' : ''}`}
              />
              <Row label="Plafond mensuel / garage" value={health.config.monthlyCap} />
              <Row label="Numéros de test (sandbox)" value={health.config.sandboxRecipientCount} />
            </Section>

            <Section title="File d’envoi (Redis)">
              {health.queue.available ? (
                <>
                  <Row label="En attente" value={health.queue.waiting} />
                  <Row label="En cours" value={health.queue.active} />
                  <Row label="Différés (relance)" value={health.queue.delayed} />
                  <Row label="Jobs en échec" value={health.queue.failed} />
                </>
              ) : (
                <p className="text-sm text-red-700">File injoignable : les notifications restent en base et repartiront au retour de Redis.</p>
              )}
              <Row label="Outbox bloquée (> 5 min)" value={health.outbox.backlog} />
              <Row
                label="Plus ancienne en attente"
                value={health.outbox.oldestPendingAt ? new Date(health.outbox.oldestPendingAt).toLocaleString('fr-FR') : '—'}
              />
            </Section>

            <Section title={`Issues sur ${health.outbox.windowHours} h`}>
              {Object.keys(health.outbox.byStatus).length === 0 ? (
                <Empty>Aucune notification sur la période.</Empty>
              ) : (
                Object.entries(health.outbox.byStatus).map(([status, count]) => (
                  <Row
                    key={status}
                    label={STATUS_LABELS[status as CustomerNotificationStatus]?.label ?? status}
                    value={count}
                  />
                ))
              )}
            </Section>

            {health.webhook && (
              <Section title="Accusés Meta (webhook)">
                <Row label="Webhook" value={health.webhook.configured ? 'Configuré' : 'Non configuré'} />
                <Row
                  label={`Acceptés sans accusé (> ${health.webhook.receiptTimeoutMinutes} min)`}
                  value={health.webhook.acceptedWithoutReceipt}
                />
                <Row label="Accusés à traiter" value={health.webhook.pendingEvents} />
                <Row label="Accusés bloqués" value={health.webhook.stuckEvents} />
                <Row label={`Sans notification (${health.outbox.windowHours} h)`} value={health.webhook.unmatchedEvents} />
                <Row label={`Désabonnements « STOP » (${health.outbox.windowHours} h)`} value={health.webhook.optOuts} />
                <Row
                  label="Dernier accusé reçu"
                  value={health.webhook.lastEventAt ? new Date(health.webhook.lastEventAt).toLocaleString('fr-FR') : '—'}
                />
              </Section>
            )}

            <Section title="Non envoyées et échecs">
              {health.outbox.skippedByReason.length === 0 && health.outbox.failedByCode.length === 0 ? (
                <Empty>Rien à signaler.</Empty>
              ) : (
                <>
                  {health.outbox.skippedByReason.map((row) => (
                    <Row key={`s-${row.reason}`} label={SKIP_REASON_LABELS[row.reason] ?? row.reason} value={row.count} />
                  ))}
                  {health.outbox.failedByCode.map((row) => (
                    <Row key={`f-${row.code}`} label={`Échec : ${ERROR_LABELS[row.code] ?? row.code}`} value={row.count} />
                  ))}
                </>
              )}
            </Section>
          </div>

          <Section title="Modèles WhatsApp (français)">
            <div className="divide-y">
              {health.templates.map((template) => (
                <div key={template.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {EVENT_LABELS[template.eventType as CustomerNotificationEvent]?.label ?? template.eventType}
                    </p>
                    <p className="font-mono text-xs text-slate-500 break-all">{template.name}</p>
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                      template.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {template.approved ? 'Approuvé' : 'Non approuvé'}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Consommation du mois (messages facturables)">
            {health.quota.garages.length === 0 ? (
              <Empty>Aucun message facturable ce mois-ci.</Empty>
            ) : (
              <div className="space-y-3">
                {health.quota.garages.map((garage) => (
                  <div key={garage.garageId} className="space-y-1">
                    <Row label={garage.garageName} value={`${garage.used} / ${health.quota.cap}`} />
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', garage.ratio >= 0.8 ? 'bg-amber-500' : 'bg-brand')}
                        style={{ width: `${Math.min(100, Math.round(garage.ratio * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
