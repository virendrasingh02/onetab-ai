import { ACTIVE_WORKSPACE_STORAGE_KEY } from '@org/design-system';
import { useSyncExternalStore } from 'react';

/**
 * The active workspace id, as a plain reactive value.
 *
 * `@org/web-workspace` owns the real store, but it is lazy-loaded from
 * `app.tsx`, so app-level providers cannot import it. It writes the id under
 * `ACTIVE_WORKSPACE_STORAGE_KEY` to both `sessionStorage` (this tab) and
 * `localStorage` (the last used in any tab), and fires an
 * `onetab:active-workspace` event on every change (see
 * `persistActiveWorkspaceId`); this hook tracks that contract. The tab's own
 * value wins, so another tab's workspace only applies until this tab has one.
 */
const ACTIVE_WORKSPACE_EVENT = 'onetab:active-workspace';

function read(): string | null {
  try {
    return (
      sessionStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) ??
      localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVE_WORKSPACE_STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(ACTIVE_WORKSPACE_EVENT, onChange as EventListener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(
      ACTIVE_WORKSPACE_EVENT,
      onChange as EventListener,
    );
  };
}

export function useActiveWorkspaceId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
