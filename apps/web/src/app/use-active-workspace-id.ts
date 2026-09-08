import { ACTIVE_WORKSPACE_STORAGE_KEY } from '@org/design-system';
import { useSyncExternalStore } from 'react';

/**
 * The active workspace id, as a plain reactive value.
 *
 * `@org/web-workspace` owns the real store, but it is lazy-loaded from
 * `app.tsx`, so app-level providers cannot import it. It writes the id to
 * `localStorage[ACTIVE_WORKSPACE_STORAGE_KEY]` and fires an
 * `onetab:active-workspace` event on every change (see
 * `persistActiveWorkspaceId`); this hook tracks that contract. The `storage`
 * event covers other tabs, the custom event covers this one.
 */
const ACTIVE_WORKSPACE_EVENT = 'onetab:active-workspace';

function read(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
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
    window.removeEventListener(ACTIVE_WORKSPACE_EVENT, onChange as EventListener);
  };
}

export function useActiveWorkspaceId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
