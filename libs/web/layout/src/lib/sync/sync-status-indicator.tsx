import { useManualResync, useSyncStatus } from '@org/sync';
import { Tooltip, TooltipContent, TooltipTrigger } from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, Check, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export interface SyncStatusIndicatorProps {
  /**
   * `inline` — a small icon + text for a header/footer slot.
   * `pill` — a floating pill that appears only while the connection is degraded
   * (replaces the old `RealtimeStatusPill`); takes no layout height.
   */
  variant?: 'inline' | 'pill';
  className?: string;
}

const PILL_SHOW_AFTER_MS = 2_500;

function iconFor(phase: string): ReactNode {
  switch (phase) {
    case 'offline':
      return <CloudOff className="size-3.5" aria-hidden />;
    case 'reconnecting':
    case 'syncing':
      return <RefreshCw className="size-3.5 animate-spin" aria-hidden />;
    case 'error':
      return <AlertTriangle className="size-3.5" aria-hidden />;
    default:
      return <Check className="size-3.5" aria-hidden />;
  }
}

/**
 * The one, deliberately quiet surface for background-sync state.
 *
 * A healthy connection shows a muted "Synced …"; a degraded one shows
 * "Reconnecting…" / "Offline …"; only a genuine `error` phase (rare — the user
 * must act) gets an accent colour. State comes from `@org/sync`'s
 * `BackgroundSyncManager` via `useSyncStatus()`. Clicking it triggers a manual
 * re-sync (invalidate + incremental catch-up), never a reload.
 */
export function SyncStatusIndicator({
  variant = 'inline',
  className,
}: SyncStatusIndicatorProps) {
  const status = useSyncStatus();
  const resync = useManualResync();
  const [pillVisible, setPillVisible] = useState(false);

  const degraded =
    status.phase === 'reconnecting' ||
    status.phase === 'offline' ||
    status.phase === 'error';

  useEffect(() => {
    if (variant !== 'pill') return undefined;
    if (!degraded) {
      setPillVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setPillVisible(true), PILL_SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [variant, degraded]);

  if (variant === 'pill') {
    if (!pillVisible) return null;
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none"
      >
        <div className="gap-1.5 px-3 py-1 text-xs font-medium flex items-center rounded-full border border-border bg-surface/95 text-foreground shadow-md backdrop-blur">
          {iconFor(status.phase)}
          {status.label}
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void resync()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium select-none',
            'hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            status.needsAttention ? 'text-destructive' : 'text-muted-foreground',
            className,
          )}
          aria-label={`${status.label}. Click to re-sync now.`}
        >
          {iconFor(status.phase)}
          <span className="hidden md:inline">{status.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {status.label}
        {status.pendingActions > 0 ? ` · ${status.pendingActions} pending` : ''}
        {' — click to re-sync'}
      </TooltipContent>
    </Tooltip>
  );
}
