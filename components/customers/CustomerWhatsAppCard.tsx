'use client';

import React, { useState } from 'react';
import { BellRing, CheckCircle2, MessageCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { customerNotificationsApi, handleApiError } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import {
  EVENT_LABELS,
  SKIP_REASON_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type ConsentSource,
  type ConsentStatus,
} from '@/lib/customer-notifications';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SOURCES = Object.keys(SOURCE_LABELS) as ConsentSource[];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Consentement WhatsApp du client et historique de ses notifications.
 * Sans consentement accordé, le moteur n'envoie rien (raison « Pas de consentement WhatsApp »).
 */
export function CustomerWhatsAppCard({
  customerId,
  phonePrimary,
  canEdit,
}: {
  customerId: string;
  phonePrimary: string;
  canEdit: boolean;
}) {
  const consents = useApi(() => customerNotificationsApi.consents(customerId), [customerId]);
  const history = useApi(() => customerNotificationsApi.history(customerId, 20), [customerId]);
  const [editing, setEditing] = useState<ConsentStatus | null>(null);
  const [source, setSource] = useState<ConsentSource>('IN_PERSON');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const consent = consents.data?.consents.find((c) => c.channel === 'WHATSAPP') ?? null;
  const granted = consent?.status === 'GRANTED';

  const startEditing = (status: ConsentStatus) => {
    setEditing(status);
    setSource(status === 'REVOKED' ? 'CUSTOMER_MESSAGE' : 'IN_PERSON');
    setPhone(status === 'GRANTED' ? consent?.phoneE164 ?? phonePrimary : '');
    setNote('');
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const result = await customerNotificationsApi.recordConsent(customerId, {
        status: editing,
        source,
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(
        !result.changed ? 'Aucun changement' : editing === 'GRANTED' ? 'Accord WhatsApp enregistré' : 'Retrait enregistré',
      );
      setEditing(null);
      consents.refetch();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border shadow-sm" data-testid="customer-whatsapp-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageCircle size={20} className="text-brand" />
          Notifications WhatsApp
        </CardTitle>
        <CardDescription>Suivi des rendez-vous, devis, véhicule prêt et factures.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {consents.loading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {granted
                  ? <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
                  : <XCircle size={22} className="shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {granted ? 'Accord donné' : consent ? 'Accord retiré' : 'Aucun accord enregistré'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {granted && consent
                      ? `${consent.phoneE164} · depuis le ${formatDateTime(consent.grantedAt ?? consent.updatedAt)}`
                      : consent?.revokedAt
                        ? `Retiré le ${formatDateTime(consent.revokedAt)}`
                        : 'Le client ne recevra aucun message WhatsApp.'}
                  </p>
                </div>
              </div>
              {canEdit && !editing && (
                <div className="flex gap-2 w-full sm:w-auto">
                  {granted && (
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => startEditing('GRANTED')}>
                      Changer le numéro
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={granted ? 'outline' : 'default'}
                    className={cn('flex-1 sm:flex-none', !granted && 'bg-brand hover:bg-brand-hover')}
                    onClick={() => startEditing(granted ? 'REVOKED' : 'GRANTED')}
                  >
                    {granted ? 'Retirer l’accord' : 'Enregistrer l’accord'}
                  </Button>
                </div>
              )}
            </div>

            {editing && (
              <div role="group" aria-label="Consentement WhatsApp" className="space-y-4 border-t border-border pt-4">
                {editing === 'GRANTED' && consents.data && (
                  <blockquote className="rounded-lg bg-muted/60 p-3 text-sm text-foreground">
                    « {consents.data.consentText.text} »
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      À lire au client avant d’enregistrer son accord.
                    </span>
                  </blockquote>
                )}
                <div className="space-y-2">
                  <Label>Comment le client a répondu</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCES.map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={source === s ? 'default' : 'outline'}
                        aria-pressed={source === s}
                        onClick={() => setSource(s)}
                      >
                        {SOURCE_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
                {editing === 'GRANTED' && (
                  <div className="space-y-2">
                    <Label htmlFor="consent-phone">Numéro WhatsApp</Label>
                    <Input
                      id="consent-phone"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={phonePrimary}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="consent-note">Note (facultatif)</Label>
                  <Input id="consent-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                    Annuler
                  </Button>
                  <Button type="button" onClick={submit} disabled={saving} className="bg-brand hover:bg-brand-hover">
                    {saving ? 'Enregistrement…' : editing === 'GRANTED' ? 'Confirmer l’accord' : 'Confirmer le retrait'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BellRing size={16} className="text-muted-foreground" />
            Derniers messages
          </p>
          {history.loading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : !history.data?.length ? (
            <p className="text-sm text-muted-foreground py-2">Aucune notification pour ce client.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {history.data.map((n) => {
                const status = STATUS_LABELS[n.status] ?? { label: n.status, className: '' };
                const reason = n.skipReason ? SKIP_REASON_LABELS[n.skipReason] ?? n.skipReason : n.lastErrorCode;
                return (
                  <li key={n.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{EVENT_LABELS[n.eventType]?.label ?? n.eventType}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(n.createdAt)}{reason ? ` · ${reason}` : ''}
                      </p>
                    </div>
                    <Badge className={cn('border-none text-[10px] w-fit', status.className)}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
