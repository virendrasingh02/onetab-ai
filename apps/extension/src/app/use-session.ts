import { useCallback, useEffect, useState } from 'react';
import { sendToBackground, type SessionState } from '../lib/messaging.js';

export interface SessionHook {
  session: SessionState | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * The popup's view of the borrowed session.
 *
 * The token itself never lands in React state for longer than it takes to know
 * whether we have one — every call that needs it runs in the background worker,
 * so the popup only ever asks "am I signed in?".
 */
export function useSession(): SessionHook {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    const response = await sendToBackground<SessionState>({
      type: force ? 'session:refresh' : 'session:get',
    });
    setSession(
      response.ok
        ? response.data
        : { accessToken: null, origin: null, observedAt: null },
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    session,
    loading,
    refresh: useCallback(() => void load(true), [load]),
  };
}
