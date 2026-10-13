import { useCallback, useEffect, useState } from 'react';
import { getDesktopApi, type DesktopDiagnostics } from './desktop-api.js';

/** One on-demand snapshot of the shell; `refresh` re-samples (CPU/memory move). */
export function useDesktopDiagnostics(): {
  diagnostics: DesktopDiagnostics | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
} {
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    setLoading(true);
    try {
      setDiagnostics(await api.app.getDiagnostics());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { diagnostics, loading, error, refresh };
}
