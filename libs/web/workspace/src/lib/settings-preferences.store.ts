import { queryKeys, workspaceApi } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Local-only settings preferences, persisted per workspace.
 *
 * A large block of the workspace settings screen was pure `useState` — every
 * toggle reset on refresh because nothing wrote it anywhere. These are the
 * preferences that have no server home yet: they live here instead, keyed by
 * workspace id and mirrored to `localStorage`, so a choice sticks on this
 * device at least. Anything that already has an API (profile, workspace
 * name/logo, language, notification categories, theme) is untouched and still
 * goes through its mutation.
 */
type PreferenceValue = string | number | boolean;

interface SettingsPreferencesState {
  /** workspace id → preference key → value */
  byWorkspace: Record<string, Record<string, PreferenceValue>>;
  setPreference: (
    workspaceId: string,
    key: string,
    value: PreferenceValue,
  ) => void;
  /** Drop every stored preference for a workspace (used by "reset to defaults"). */
  resetWorkspace: (workspaceId: string) => void;
  /** Replaces a workspace's whole preference map — the server's copy wins on hydrate. */
  hydrateWorkspace: (
    workspaceId: string,
    values: Record<string, PreferenceValue>,
  ) => void;
}

export const useSettingsPreferencesStore = create<SettingsPreferencesState>()(
  persist(
    (set) => ({
      byWorkspace: {},
      setPreference: (workspaceId, key, value) =>
        set((state) => ({
          byWorkspace: {
            ...state.byWorkspace,
            [workspaceId]: {
              ...state.byWorkspace[workspaceId],
              [key]: value,
            },
          },
        })),
      resetWorkspace: (workspaceId) =>
        set((state) => {
          if (!state.byWorkspace[workspaceId]) return state;
          const next = { ...state.byWorkspace };
          delete next[workspaceId];
          return { byWorkspace: next };
        }),
      hydrateWorkspace: (workspaceId, values) =>
        set((state) => ({
          byWorkspace: { ...state.byWorkspace, [workspaceId]: values },
        })),
    }),
    {
      name: 'onetab_settings_prefs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/**
 * A drop-in replacement for `useState` whose value is persisted per workspace.
 *
 * `const [homeView, setHomeView] = useWorkspacePreference(workspaceId, 'homeView', 'agent');`
 *
 * The signature matches `useState` so a setting can be migrated by changing
 * only its declaration line — every reader and `<Select onValueChange>` below
 * keeps working unchanged. Overloads (rather than a generic) keep a `false`
 * fallback typed as `boolean` and a `'agent'` fallback typed as `string`,
 * matching what `useState` would have inferred.
 */
export function useWorkspacePreference(
  workspaceId: string | undefined,
  key: string,
  fallback: boolean,
): [boolean, (value: PreferenceValue) => void];
export function useWorkspacePreference(
  workspaceId: string | undefined,
  key: string,
  fallback: number,
): [number, (value: PreferenceValue) => void];
export function useWorkspacePreference(
  workspaceId: string | undefined,
  key: string,
  fallback: string,
): [string, (value: PreferenceValue) => void];
export function useWorkspacePreference(
  workspaceId: string | undefined,
  key: string,
  fallback: PreferenceValue,
): [PreferenceValue, (value: PreferenceValue) => void] {
  const scope = workspaceId || '__no_workspace__';
  const stored = useSettingsPreferencesStore(
    (state) => state.byWorkspace[scope]?.[key],
  );
  const setPreference = useSettingsPreferencesStore(
    (state) => state.setPreference,
  );

  const setValue = useCallback(
    (value: PreferenceValue) => setPreference(scope, key, value),
    [setPreference, scope, key],
  );

  return [stored === undefined ? fallback : stored, setValue];
}

/**
 * Read one preference without a setter — for consumers that only *apply* it.
 */
export function useWorkspacePreferenceValue<T extends PreferenceValue>(
  workspaceId: string | undefined,
  key: string,
  fallback: T,
): T {
  const scope = workspaceId || '__no_workspace__';
  const stored = useSettingsPreferencesStore(
    (state) => state.byWorkspace[scope]?.[key],
  ) as T | undefined;
  return stored === undefined ? fallback : stored;
}

/** Root `font-size` for each "Font size" choice — everything sized in `rem`
 *  scales with it. `px`-pinned micro-labels stay put, which is the intent. */
const FONT_SIZE_SCALE: Record<string, string> = {
  compact: '93.75%', // ~15px
  default: '100%', // 16px
  large: '112.5%', // ~18px
};

/**
 * Applies the client-side workspace preferences that have a live effect on the
 * running app (rather than only a value that persists). Today that is the
 * "Font size" choice from Appearance & Preferences; server-enforced settings
 * (AI runtime, notification delivery, channel policy, automations) still need
 * their own APIs and are not touched here.
 *
 * Mounted by both the app shell and the settings shell so a change previews
 * immediately while you are still on the settings screen.
 */
export function useApplyWorkspacePreferences(workspaceId: string | undefined) {
  const fontSize = useWorkspacePreferenceValue(workspaceId, 'fontSize', 'default');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = FONT_SIZE_SCALE[fontSize] ?? FONT_SIZE_SCALE.default;
    return () => {
      root.style.fontSize = previous;
    };
  }, [fontSize]);
}

/** Zero-markup mount point for {@link useApplyWorkspacePreferences}. */
export function WorkspacePreferencesEffects({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  useApplyWorkspacePreferences(workspaceId);
  return null;
}

const SYNC_DEBOUNCE_MS = 900;

/**
 * Rounds trips this store's whole `byWorkspace[workspaceId]` map to
 * `WorkspaceMemberPreference` server-side, the same debounced-push /
 * hydrate-on-mount shape `usePreferencesSync` already uses for the user's
 * global chat/notification preferences (`apps/web/src/app/preferences-sync.ts`).
 *
 * Every field still read through {@link useWorkspacePreference} —
 * automations, schedule, pulse, documents, files, and the handful of
 * `general`/notify fields that never got a typed API — becomes real,
 * multi-device-consistent storage for free just by mounting this once,
 * without touching any of those call sites: they keep reading/writing the
 * same Zustand store; this only adds a server-backed source of truth behind
 * it.
 *
 *  - On the first successful fetch for a workspace, the server's blob
 *    replaces the local one (server wins over a stale/never-synced device).
 *  - Every local change afterwards is debounced back to the server.
 *  - `settings.updated` (category `memberPreferences`) over the realtime
 *    bridge invalidates the query, which refetches and re-hydrates — so a
 *    change made on another device shows up here too.
 *
 * Mounted once per active workspace by the settings screen.
 */
export function useWorkspaceMemberPreferencesSync(
  workspaceId: string | undefined,
): void {
  const enabled = !!workspaceId;
  const scope = workspaceId || '__no_workspace__';
  const stored = useSettingsPreferencesStore((s) => s.byWorkspace[scope]);
  const hydrateWorkspace = useSettingsPreferencesStore(
    (s) => s.hydrateWorkspace,
  );

  const hydratedScopeRef = useRef<string | null>(null);
  const lastAppliedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: queryKeys.workspaces.memberPreferences(workspaceId ?? ''),
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // 1. Hydrate from the server once per workspace, the first time it answers.
  useEffect(() => {
    if (!enabled || !query.data || hydratedScopeRef.current === scope) return;
    hydratedScopeRef.current = scope;
    lastAppliedRef.current = JSON.stringify(query.data);
    hydrateWorkspace(scope, query.data as Record<string, PreferenceValue>);
  }, [enabled, query.data, scope, hydrateWorkspace]);

  // 2. Push local changes back, debounced, once hydrated for this workspace.
  useEffect(() => {
    if (!enabled || hydratedScopeRef.current !== scope) return;
    const serialized = JSON.stringify(stored ?? {});
    if (serialized === lastAppliedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastAppliedRef.current = serialized;
      workspaceApi
        .saveMemberPreferences(workspaceId as string, stored ?? {})
        .catch(() => {
          // Retry on the next change; the local store is unaffected.
          lastAppliedRef.current = '';
        });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, stored, scope, workspaceId]);
}

/** Zero-markup mount point for {@link useWorkspaceMemberPreferencesSync}. */
export function WorkspaceMemberPreferencesSync({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  useWorkspaceMemberPreferencesSync(workspaceId);
  return null;
}
