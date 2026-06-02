'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  billingApi,
  customersApi,
  demoRequestsApi,
  planningApi,
  settingsApi,
  stockApi,
  teamApi,
  vehiclesApi,
  workshopApi,
} from '@/lib/api';
import { hasGettingStartedVisit } from '@/lib/getting-started-visits';
import type { GuideRole } from '@/lib/guide-roles';
import { resolveGuideRole } from '@/lib/guide-roles';
import {
  GETTING_STARTED_BY_ROLE,
  type GettingStartedCheckId,
  type GettingStartedTaskDef,
} from '@/lib/getting-started';
import { useAuth } from '@/contexts/auth-context';

export interface GettingStartedTaskView extends GettingStartedTaskDef {
  done: boolean;
}

const DISMISS_KEY = (userId: string) => `atelier_getting_started_dismiss_${userId}`;

async function verifyCheck(
  id: GettingStartedCheckId,
  userId: string,
  role: GuideRole,
): Promise<boolean> {
  try {
    switch (id) {
      case 'customer': {
        const list = (await customersApi.list()) as unknown[];
        return list.length > 0;
      }
      case 'vehicle': {
        const list = (await vehiclesApi.list()) as unknown[];
        return list.length > 0;
      }
      case 'reception_or_ot': {
        const ots = (await workshopApi.listOTs()) as { status?: string }[];
        return ots.length > 0;
      }
      case 'appointment': {
        const today = new Date().toISOString().split('T')[0];
        const apts = (await planningApi.list({ date: today })) as unknown[];
        return apts.length > 0;
      }
      case 'assign_tech': {
        const ots = (await workshopApi.listOTs()) as {
          status?: string;
          assignedChef?: string | null;
        }[];
        return ots.some(
          (o) =>
            o.assignedChef &&
            ['RECEIVED', 'DIAGNOSING', 'IN_PROGRESS', 'QC_PENDING'].includes(o.status ?? ''),
        );
      }
      case 'quote': {
        const quotes = (await billingApi.listQuotes()) as unknown[];
        const invoices = (await billingApi.listInvoices()) as unknown[];
        return quotes.length > 0 || invoices.length > 0;
      }
      case 'payment': {
        const paid = (await billingApi.listInvoices({ status: 'PAID' })) as unknown[];
        const partial = (await billingApi.listInvoices({ status: 'PARTIAL' })) as unknown[];
        return paid.length > 0 || partial.length > 0;
      }
      case 'team_member': {
        const members = (await teamApi.list()) as { id: string }[];
        return members.length > 1 || (role === 'SUPER_ADMIN' && members.length > 0);
      }
      case 'workshop_settings': {
        const s = (await settingsApi.getWorkshop()) as { shopName?: string };
        return Boolean(s?.shopName?.trim());
      }
      case 'demo_request': {
        if (hasGettingStartedVisit('demo', userId)) return true;
        const list = (await demoRequestsApi.list({ limit: 1 })) as unknown[];
        return list.length > 0;
      }
      case 'open_assigned_ot': {
        const ots = (await workshopApi.listOTs()) as { assignedChef?: string | null }[];
        return ots.some((o) => o.assignedChef === userId);
      }
      case 'stock_view': {
        if (hasGettingStartedVisit('stock', userId)) return true;
        const parts = (await stockApi.listParts()) as unknown[];
        return parts.length > 0;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function useGettingStarted() {
  const { user } = useAuth();
  const role = resolveGuideRole(user?.roles ?? []);
  const defs = GETTING_STARTED_BY_ROLE[role] ?? [];

  const [doneMap, setDoneMap] = useState<Partial<Record<GettingStartedCheckId, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id || defs.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const entries = await Promise.all(
      defs.map(async (d) => [d.id, await verifyCheck(d.id, user.id, role)] as const),
    );
    setDoneMap(Object.fromEntries(entries));
    setLoading(false);
  }, [user?.id, role, defs]);

  useEffect(() => {
    if (!user?.id) return;
    const raw = localStorage.getItem(DISMISS_KEY(user.id));
    setDismissed(raw === '1');
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const tasks: GettingStartedTaskView[] = useMemo(
    () => defs.map((d) => ({ ...d, done: Boolean(doneMap[d.id]) })),
    [defs, doneMap],
  );

  const completedCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  function dismiss() {
    if (!user?.id) return;
    localStorage.setItem(DISMISS_KEY(user.id), '1');
    setDismissed(true);
  }

  function resetDismiss() {
    if (!user?.id) return;
    localStorage.removeItem(DISMISS_KEY(user.id));
    setDismissed(false);
  }

  return {
    role,
    tasks,
    loading,
    completedCount,
    totalCount,
    allDone,
    dismissed,
    dismiss,
    resetDismiss,
    refresh,
  };
}
