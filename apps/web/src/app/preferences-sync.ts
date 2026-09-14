import { queryKeys, userApi } from '@org/api-client';
import { useUserPreferences } from '@org/common';
import type { UserPreferences } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 900;

function snapshot(p: UserPreferences): string {
  return JSON.stringify(p);
}

/**
 * Mirrors `useWorkspaceAppearanceSync` for the rest of the signed-in user's
 * personal preferences — chat behavior (density, read receipts, typing
 * notices, link previews, …) and notification display/sound settings.
 *
 * `GET/PATCH /users/me/preferences` already persists this server-side (the
 * `chat` half round-trips to `ChatSettings`, the `notifications` half to its
 * JSON column), but until now nothing on the client ever called it — the
 * Redux `preferences` slice only ever read/wrote `localStorage`, so a
 * change never reached another device, another browser, or survived a
 * fresh profile.
 *
 *  - On mount, reads the server's copy and hydrates the Redux store from it
 *    (the server wins over a stale local blob).
 *  - Every change the user makes anywhere (chat settings panel, notification
 *    display panel, sound controls) is debounced back to the server.
 *  - `settings.updated` (category `chat`) arriving over the realtime bridge
 *    invalidates `queryKeys.user.preferences()`, which refetches here and
 *    re-hydrates — so a change made on another device shows up live.
 *
 * Rendered once, near the app root, by `Providers` — not workspace-scoped,
 * since these are the user's own settings.
 */
export function usePreferencesSync(enabled: boolean): void {
  const { preferences, setPreferences } = useUserPreferences();

  const hydratedRef = useRef(false);
  const lastAppliedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: queryKeys.user.preferences(),
    queryFn: () => userApi.preferences(),
    enabled,
    staleTime: 60_000,
    // Pick up a change made on another device / browser, or one pushed here
    // by the realtime settings.updated invalidation.
    refetchOnWindowFocus: true,
  });

  // 1. Hydrate from the server once it answers (and on every refetch).
  useEffect(() => {
    if (!enabled || !query.data) return;
    const next = snapshot(query.data);
    if (next === lastAppliedRef.current && hydratedRef.current) return;
    lastAppliedRef.current = next;
    hydratedRef.current = true;
    setPreferences(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query.data]);

  // 2. Push local changes back, debounced, once hydrated — never before, or
  // the client's just-loaded defaults would race the server's real values.
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    const serialized = snapshot(preferences);
    if (serialized === lastAppliedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastAppliedRef.current = serialized;
      // `language` is a separate concern (`PATCH /users/me/language`, driven
      // by `LanguageSync`) — never sent from here.
      userApi
        .updatePreferences({
          chat: preferences.chat,
          notifications: preferences.notifications,
        })
        .catch(() => {
          // Retry on the next change; the local store + its localStorage
          // copy are unaffected.
          lastAppliedRef.current = '';
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, preferences]);
}
