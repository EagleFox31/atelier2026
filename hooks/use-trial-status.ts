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
      return null;
    }

    setIsLoading(true);
    try {
      const status = await subscriptionApi.status();
      setData(status);
      setError(null);
      return status;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
