'use client';

import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { notificationsApi, type InAppNotification } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 30_000;
const STARTUP_RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

const NEGATIVE_KEYWORDS = ['refusé', 'rejeté', 'annulé', 'échoué', 'erreur', 'refus'];
function isNegative(title: string) {
  const lower = title.toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

// Module-level : survivent aux remontages (navigation entre pages)
const seenIds = new Set<string>();
let initialLoadDone = false;

export function NotificationBell() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<InAppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyInbox = useCallback(
    (list: InAppNotification[]) => {
      setNotifs(list);

      if (!initialLoadDone) {
        list.forEach((n) => seenIds.add(n.id));
        initialLoadDone = true;
      } else {
        list.forEach((n) => {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            toast(n.title, {
              description: n.body,
              action: n.link
                ? { label: 'Voir', onClick: () => router.push(n.link!) }
                : undefined,
            });
          }
        });
      }
    },
    [router],
  );

  const fetchInbox = useCallback(
    async (startupRetryIndex = 0): Promise<void> => {
      try {
        const data = await notificationsApi.inbox();
        const list: InAppNotification[] = Array.isArray(data) ? data : [];
        applyInbox(list);
      } catch (err) {
        const isStartupRetry =
          startupRetryIndex < STARTUP_RETRY_DELAYS_MS.length &&
          err instanceof TypeError;

        if (isStartupRetry) {
          retryTimeoutRef.current = setTimeout(() => {
            void fetchInbox(startupRetryIndex + 1);
          }, STARTUP_RETRY_DELAYS_MS[startupRetryIndex]);
          return;
        }

        if (!(err instanceof TypeError)) {
          console.error('[NotificationBell] fetch failed:', err);
        }
      }
    },
    [applyInbox],
  );

  useEffect(() => {
    void fetchInbox();
    intervalRef.current = setInterval(() => {
      void fetchInbox();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [fetchInbox]);

  const unreadCount = notifs.length;

  async function handleMarkRead(notif: InAppNotification, e?: MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setNotifs((prev) => prev.filter((n) => n.id !== notif.id));
    try {
      await notificationsApi.markRead(notif.id);
    } catch {
      fetchInbox();
    }
  }

  async function handleOpen(notif: InAppNotification) {
    await handleMarkRead(notif);
    setOpen(false);
    if (notif.link) router.push(notif.link);
  }

  async function handleMarkAllRead() {
    setNotifs([]);
    try {
      await notificationsApi.markAllRead();
    } catch {
      fetchInbox();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notif-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Tout marquer lu
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y">
          {notifs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune nouvelle notification
            </p>
          ) : (
            notifs.map((notif) => {
              const negative = isNegative(notif.title);
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-1 px-2 py-2 transition-colors border-l-2 ${
                    negative
                      ? 'border-red-400 bg-red-50/60 hover:bg-red-50'
                      : 'border-transparent hover:bg-accent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpen(notif)}
                    className="flex-1 min-w-0 text-left px-2 py-1 rounded-md"
                  >
                    <p className={`text-sm font-medium leading-snug ${negative ? 'text-red-700' : ''}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{notif.body}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleMarkRead(notif, e)}
                    className={`shrink-0 mt-1 p-1.5 rounded-lg transition-colors ${
                      negative
                        ? 'text-red-400 hover:bg-red-100 hover:text-red-600'
                        : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                    aria-label="Marquer comme lu"
                    title="Marquer comme lu"
                  >
                    {negative
                      ? <XCircle className="h-5 w-5" />
                      : <CheckCircle2 className="h-5 w-5" />
                    }
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
