import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@org/ui';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      queryClient.invalidateQueries();
      const timer = setTimeout(() => {
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  const handleManualRetry = async () => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries();
      if (navigator.onLine) {
        setIsOnline(true);
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  if (isOnline && !wasOffline) {
    return null;
  }

  if (isOnline && wasOffline) {
    return (
      <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-emerald-600/90 px-3 text-xs font-medium text-white transition-all">
        <Wifi className="size-3.5" />
        <span>Connection restored. Syncing latest workspace state...</span>
      </div>
    );
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-amber-600/20 bg-amber-500/15 px-3 text-xs font-medium text-amber-700 dark:text-amber-300 transition-all">
      <div className="flex items-center gap-2 min-w-0 truncate">
        <WifiOff className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="truncate">
          You are currently offline. Changes are saved locally and will sync
          when connected.
        </span>
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={handleManualRetry}
        disabled={isSyncing}
        className="h-6 gap-1 px-2 text-[11px] text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
      >
        <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{isSyncing ? 'Reconnecting...' : 'Retry'}</span>
      </Button>
    </div>
  );
}
