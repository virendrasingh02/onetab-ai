import { useRealtime } from '@org/realtime';
import { useEffect, useState } from 'react';

/**
 * A Slack-style floating pill that appears when the real-time (SSE) connection
 * is degraded and disappears the moment it recovers. Takes no layout height, so
 * the app never jumps.
 *
 * Deliberately quiet: a healthy connection shows nothing, and a brief blip is
 * swallowed by a short delay before the pill is allowed to appear — it only
 * surfaces a problem the user would otherwise have no signal for (stale data,
 * missing live updates) while the client works through its backoff.
 */
const SHOW_AFTER_MS = 2_500;

export function RealtimeStatusPill() {
  const { connectionState } = useRealtime();
  const [visible, setVisible] = useState(false);

  const degraded = connectionState !== 'connected';

  useEffect(() => {
    if (!degraded) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [degraded]);

  if (!visible) return null;

  const label =
    connectionState === 'connecting' ? 'Connecting…' : 'Reconnecting…';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none"
    >
      <div className="gap-1.5 px-3 py-1 text-xs font-medium flex items-center rounded-full border border-border bg-surface/95 text-foreground shadow-md backdrop-blur">
        <span
          aria-hidden
          className="size-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin"
        />
        {label}
      </div>
    </div>
  );
}
