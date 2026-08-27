import { userApi } from '@org/api-client';
import { useEffect, useRef } from 'react';
import { useSidebarStore, type SidebarState } from './sidebar-store.js';

/** The subset of the store that is persisted — mirrors `persist.partialize`. */
type PersistedSidebar = Pick<
  SidebarState,
  | 'items'
  | 'sections'
  | 'channelOrders'
  | 'resourceOrders'
  | 'collapsedGroups'
  | 'sidebarCollapsed'
>;

function snapshot(state: SidebarState): PersistedSidebar {
  return {
    items: state.items,
    sections: state.sections,
    channelOrders: state.channelOrders,
    resourceOrders: state.resourceOrders,
    collapsedGroups: state.collapsedGroups,
    sidebarCollapsed: state.sidebarCollapsed,
  };
}

const SAVE_DEBOUNCE_MS = 900;

/**
 * Keeps the sidebar-customization store in sync with the server.
 *
 * The zustand store still writes to localStorage for instant first paint, but
 * the server copy is authoritative: on mount it is fetched and merged in, and
 * every subsequent change is debounced back to `PUT /users/me/sidebar`. This is
 * what makes a reordered sidebar survive logout and follow the user to another
 * device (brief §9).
 *
 * Mount once, high in the tree — `AppShell` does.
 */
export function useSidebarSync(enabled: boolean): void {
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Pull the server copy once and merge it over the local defaults.
  useEffect(() => {
    if (!enabled || hydratedRef.current) return;
    let cancelled = false;

    userApi
      .sidebarPreferences()
      .then((remote) => {
        if (cancelled || !remote || typeof remote !== 'object') return;
        const keys = Object.keys(remote);
        if (keys.length > 0) {
          useSidebarStore.setState(remote as Partial<SidebarState>);
        }
        lastSavedRef.current = JSON.stringify(
          snapshot(useSidebarStore.getState()),
        );
      })
      .catch(() => {
        // Offline or unauthenticated — the localStorage copy stands in.
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // 2. Push local changes back, debounced, once hydrated.
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = useSidebarStore.subscribe((state) => {
      if (!hydratedRef.current) return;
      const serialized = JSON.stringify(snapshot(state));
      if (serialized === lastSavedRef.current) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastSavedRef.current = serialized;
        userApi
          .saveSidebarPreferences(
            snapshot(state) as unknown as Record<string, unknown>,
          )
          .catch(() => {
            // A failed save just means the next change retries; the local
            // store and its localStorage copy are unaffected.
            lastSavedRef.current = '';
          });
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);
}
