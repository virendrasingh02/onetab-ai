import { useCallback, useEffect } from 'react';
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
