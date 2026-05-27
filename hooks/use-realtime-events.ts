'use client';

import { useEffect, useRef } from 'react';

type EventHandler = (data: Record<string, unknown>) => void;

interface RealtimeOptions {
  onOtCreated?: EventHandler;
  onOtStatusChanged?: EventHandler;
  onNotificationNew?: EventHandler;
}

const TOKEN_KEY = 'atelier_token';
const BASE_DELAY = 3_000;
const MAX_DELAY = 30_000;

export function useRealtimeEvents(options: RealtimeOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryDelay = BASE_DELAY;
    let stopped = false;

    function connect() {
      if (stopped) return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

      es.addEventListener('message', (e) => {
        retryDelay = BASE_DELAY;
        try {
          const data: Record<string, unknown> = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          const type = data.type as string;
          if (type === 'ot.created') optionsRef.current.onOtCreated?.(data);
          else if (type === 'ot.status_changed') optionsRef.current.onOtStatusChanged?.(data);
          else if (type === 'notification.new') optionsRef.current.onNotificationNew?.(data);
        } catch {
          // ignore malformed events
        }
      });

      es.addEventListener('error', () => {
        es?.close();
        es = null;
        if (!stopped) {
          setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
        }
      });
    }

    connect();
    return () => {
      stopped = true;
      es?.close();
    };
  }, []);
}
