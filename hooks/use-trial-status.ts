'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  subscriptionApi,
  type SubscriptionSummary,
} from '@/lib/api';

export function useTrialStatus(enabled = true) {
  const [data, setData] = useState<SubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const status = await subscriptionApi.status();
      setData(status);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
