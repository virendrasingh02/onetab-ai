import { useLastDroppedOfflineAction } from '@org/sync';
import { toast } from '@org/ui';
import { useEffect, useRef } from 'react';

const MESSAGE_BY_CLASS: Partial<Record<string, string>> = {
  conflict:
    "Some changes couldn't be saved because they were out of date — please refresh and try again.",
  permission:
    "Some changes couldn't be saved — you may no longer have permission for that action.",
  validation: "Some changes couldn't be saved — please try again.",
};

/**
 * Renders nothing. Watches for offline-queue actions dropped on replay
 * (`@org/sync`'s `lastDroppedAction`) and surfaces exactly one toast per drop,
 * so a queued change that fails permanently (a stale edit conflict, a
 * permission that changed while offline) is reported instead of silently
 * disappearing. Mount once, near `<SyncStatusIndicator>`.
 */
export function OfflineConflictToastBridge(): null {
  const dropped = useLastDroppedOfflineAction();
  const lastSeenId = useRef<string | null>(null);

  useEffect(() => {
    if (!dropped || dropped.id === lastSeenId.current) return;
    lastSeenId.current = dropped.id;
    const message =
      (dropped.errorClass && MESSAGE_BY_CLASS[dropped.errorClass]) ??
      "A queued change couldn't be saved and was discarded.";
    toast.error(message);
  }, [dropped]);

  return null;
}
