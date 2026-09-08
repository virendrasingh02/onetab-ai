import { userApi } from '@org/api-client';
import {
  getNavigationMemorySnapshot,
  useNavigationMemoryStore,
} from '@org/web-workspace';
import { useEffect, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 900;

/**
 * Keeps the per-workspace navigation memory in sync with the server.
 *
 * The zustand store still writes to localStorage for instant first paint, but
 * the server copy is authoritative: on mount it is fetched and merged in
 * (server wins per workspace, local fills gaps), and every subsequent change is
 * debounced back to `PUT /users/me/navigation`. This is what makes "resume the
 * route I last had open in this workspace" survive logout and follow the user
 * to another device.
 *
 * Mirrors `useSidebarSync`. Mount once, high in the tree — `AppShell` does.
 */
export function useNavigationSync(enabled: boolean): void {
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Pull the server copy once and merge it over the local defaults.
  useEffect(() => {
    if (!enabled || hydratedRef.current) return;
    let cancelled = false;

    userApi
      .navigationPreferences()
      .then((remote) => {
        if (cancelled || !remote || typeof remote !== 'object') return;
        useNavigationMemoryStore.getState().applyServerSnapshot({
          lastWorkspaceId:
            typeof remote['lastWorkspaceId'] === 'string'
              ? (remote['lastWorkspaceId'] as string)
              : null,
          lastWorkspaceSlug:
            typeof remote['lastWorkspaceSlug'] === 'string'
              ? (remote['lastWorkspaceSlug'] as string)
              : null,
          workspacePaths:
            remote['workspacePaths'] &&
            typeof remote['workspacePaths'] === 'object'
              ? (remote['workspacePaths'] as Record<string, string>)
              : {},
        });
        lastSavedRef.current = JSON.stringify(getNavigationMemorySnapshot());
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

    const unsubscribe = useNavigationMemoryStore.subscribe(() => {
      if (!hydratedRef.current) return;
      const serialized = JSON.stringify(getNavigationMemorySnapshot());
      if (serialized === lastSavedRef.current) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastSavedRef.current = serialized;
        userApi
          .saveNavigationPreferences(
            JSON.parse(serialized) as Record<string, unknown>,
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
