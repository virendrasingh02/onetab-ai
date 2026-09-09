import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';

/**
 * Tracks which settings forms have unsaved edits, so the settings shell can put
 * a "you have unsaved changes" guard in front of leaving a section (nav click,
 * Back, Close, Escape, tab close).
 *
 * Each editable form calls {@link useRegisterSettingsDirty} with its own key,
 * its live `formState.isDirty`, and (optionally) a save function for the
 * modal's "Save changes" action. The settings page owns some of these forms
 * directly; the Profile panel lives in `@org/web-profile` and registers itself
 * from there. Session-only — nothing is persisted.
 */
export interface SettingsDirtyEntry {
  dirty: boolean;
  /** Commits this form. Resolves when the write settles. */
  save?: () => Promise<void> | void;
  /** Rolls this form back to its last-saved values (for "Discard changes"). */
  reset?: () => void;
}

interface SettingsDirtyState {
  entries: Record<string, SettingsDirtyEntry>;
  register: (key: string, entry: SettingsDirtyEntry) => void;
  unregister: (key: string) => void;
}

export const useSettingsDirtyStore = create<SettingsDirtyState>((set) => ({
  entries: {},
  register: (key, entry) =>
    set((state) => {
      const prev = state.entries[key];
      if (
        prev &&
        prev.dirty === entry.dirty &&
        prev.save === entry.save &&
        prev.reset === entry.reset
      ) {
        return state;
      }
      return { entries: { ...state.entries, [key]: entry } };
    }),
  unregister: (key) =>
    set((state) => {
      if (!(key in state.entries)) return state;
      const next = { ...state.entries };
      delete next[key];
      return { entries: next };
    }),
}));

/** True when any registered settings form has unsaved edits. */
export function useSettingsDirty(): boolean {
  return useSettingsDirtyStore((state) =>
    Object.values(state.entries).some((entry) => entry.dirty),
  );
}

/** Read the current dirty entries without subscribing (for event handlers). */
export function getDirtySettingsEntries(): SettingsDirtyEntry[] {
  return Object.values(useSettingsDirtyStore.getState().entries).filter(
    (entry) => entry.dirty,
  );
}

/**
 * Registers one settings form with the unsaved-changes guard. Call it once per
 * form, passing its live dirty flag.
 */
export function useRegisterSettingsDirty(
  key: string,
  dirty: boolean,
  save?: () => Promise<void> | void,
  reset?: () => void,
): void {
  const register = useSettingsDirtyStore((s) => s.register);
  const unregister = useSettingsDirtyStore((s) => s.unregister);

  // Keep the latest closures without re-registering on every render.
  const saveRef = useRef(save);
  saveRef.current = save;
  const resetRef = useRef(reset);
  resetRef.current = reset;

  const stableSave = useMemo(
    () => (save ? () => saveRef.current?.() : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, Boolean(save)],
  );
  const stableReset = useMemo(
    () => (reset ? () => resetRef.current?.() : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, Boolean(reset)],
  );

  useEffect(() => {
    register(key, { dirty, save: stableSave, reset: stableReset });
    return () => unregister(key);
  }, [key, dirty, stableSave, stableReset, register, unregister]);
}
