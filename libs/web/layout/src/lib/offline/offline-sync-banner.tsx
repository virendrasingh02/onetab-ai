import { Button } from '@org/ui';
import { useManualResync, useSyncStatus } from '@org/sync';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * The thin bar under the header that appears while the app is offline or
 * catching up after coming back.
 *
 * State comes from the central `BackgroundSyncManager` (`useSyncStatus`) — this
 * component no longer runs its own `online`/`offline` listeners or blanket
 * `queryClient.invalidateQueries()`. "Retry" asks the manager for a targeted
 * re-sync (invalidate + incremental catch-up), never a full reload.
 */
export function OfflineSyncBanner() {
  const status = useSyncStatus();
  const resync = useManualResync();
  const [busy, setBusy] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (status.phase === 'offline') {
      wasOfflineRef.current = true;
      setShowRestored(false);
      return undefined;
    }
    if (wasOfflineRef.current && status.phase === 'synced') {
      wasOfflineRef.current = false;
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status.phase]);

  const handleRetry = async () => {
    setBusy(true);
    try {
      await resync();
    } finally {
      setTimeout(() => setBusy(false), 500);
    }
  };

  if (showRestored) {
    return (
      <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-emerald-600/90 px-3 text-xs font-medium text-white transition-all">
        <Wifi className="size-3.5" />
        <span>Connection restored. Syncing latest workspace state…</span>
      </div>
    );
  }

  if (status.phase !== 'offline') {
    return null;
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-amber-600/20 bg-amber-500/15 px-3 text-xs font-medium text-amber-700 dark:text-amber-300 transition-all">
      <div className="flex items-center gap-2 min-w-0 truncate">
        <WifiOff className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="truncate">
          {status.pendingActions > 0
            ? `You are offline. ${status.pendingActions} change${
                status.pendingActions === 1 ? '' : 's'
              } will sync when you reconnect.`
            : 'You are currently offline. Changes are saved locally and will sync when connected.'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={handleRetry}
        disabled={busy}
        className="h-6 gap-1 px-2 text-[11px] text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
      >
        <RefreshCw className={`size-3 ${busy ? 'animate-spin' : ''}`} />
        <span>{busy ? 'Retrying…' : 'Retry'}</span>
      </Button>
    </div>
  );
}
