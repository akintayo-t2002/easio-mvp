import { useCallback, useEffect, useState } from 'react';

import { fetchIntegrationStatus, type ConnectionStatusResponse } from '../lib/api';

interface IntegrationStatusHook {
  status: ConnectionStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useIntegrationStatus(integrationId: string | null): IntegrationStatusHook {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!integrationId) {
      setStatus(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetchIntegrationStatus(integrationId);
      setStatus(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch integration status'));
    } finally {
      setIsLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, isLoading, error, refresh };
}
