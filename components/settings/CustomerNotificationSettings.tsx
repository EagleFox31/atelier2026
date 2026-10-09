'use client';

import React, { useState } from 'react';
import { LockKeyhole, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { customerNotificationsApi, handleApiError } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { EVENT_LABELS, type CustomerNotificationEvent, type NotificationPreference } from '@/lib/customer-notifications';
import { toast } from 'sonner';

/**
 * Activation des notifications WhatsApp par événement, pour le garage courant.
 * `lockMessage` non nul = forfait sans droit `whatsapp` (calculé par l'API) : réglages
 * modifiables, mais aucun message ne part tant que le forfait ne l'inclut pas.
 */
export function CustomerNotificationSettings({
  canEdit,
  lockMessage,
}: {
  canEdit: boolean;
  lockMessage: string | null;
}) {
  const { data, loading } = useApi(() => customerNotificationsApi.settings(), []);
  const [prefs, setPrefs] = useState<NotificationPreference[] | null>(null);
  const [pending, setPending] = useState<CustomerNotificationEvent | null>(null);
  const rows = prefs ?? data ?? [];

  const toggle = async (eventType: CustomerNotificationEvent, enabled: boolean) => {
    setPending(eventType);
    try {
      setPrefs(await customerNotificationsApi.updateSettings([{ eventType, enabled }]));
      toast.success(enabled ? 'Notification activée' : 'Notification désactivée');
    } catch (error) {
      handleApiError(error);
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="border-none shadow-sm" data-testid="customer-notification-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle size={18} className="text-green-600" />
          Notifications WhatsApp aux clients
          {lockMessage && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              <LockKeyhole size={11} />
              Abonnement actif requis
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Choisissez les messages envoyés automatiquement. Un client ne reçoit rien sans son accord,
          enregistré sur sa fiche.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lockMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {lockMessage} Les messages WhatsApp partent avec un abonnement Pro ou Business actif.
          </div>
        )}
        {loading && !prefs ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((pref) => {
              const { label, hint } = EVENT_LABELS[pref.eventType] ?? { label: pref.eventType, hint: '' };
              const id = `notif-${pref.eventType}`;
              return (
                <li key={pref.eventType} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                  <label htmlFor={id} className="min-w-0 cursor-pointer">
                    <p className="text-sm font-bold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">{hint}</p>
                  </label>
                  <Switch
                    id={id}
                    checked={pref.enabled}
                    disabled={!canEdit || pending !== null}
                    onCheckedChange={(checked: boolean) => toggle(pref.eventType, checked)}
                    aria-label={label}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {!canEdit && <p className="text-xs text-slate-500">Seul un administrateur peut modifier ces réglages.</p>}
      </CardContent>
    </Card>
  );
}
