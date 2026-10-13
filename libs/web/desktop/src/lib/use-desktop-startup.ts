import { useCallback, useEffect, useState } from 'react';
import { getDesktopApi, type DesktopStartupRequest, type DesktopStartupState } from './desktop-api.js';

/**
 * Login-item state, read from the OS through the shell rather than from a saved
 * flag: a user can switch the item off in Task Manager or System Settings, and
 * the toggle must reflect that. `null` until loaded (and forever on the web).
 */
export function useDesktopStartup(): [
  DesktopStartupState | null,
  (request: DesktopStartupRequest) => Promise<void>,
] {
  const [state, setState] = useState<DesktopStartupState | null>(null);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    let active = true;
    void api.app
      .getStartup()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (request: DesktopStartupRequest) => {
    const api = getDesktopApi();
    if (!api) return;
    // Optimistic, then replaced with whatever the OS actually accepted.
    setState((prev) => (prev ? { ...prev, ...request } : prev));
    try {
      setState(await api.app.setStartup(request));
    } catch {
      setState(await api.app.getStartup().catch(() => null));
    }
  }, []);

  return [state, update];
}
