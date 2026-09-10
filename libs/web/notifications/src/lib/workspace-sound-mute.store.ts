import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Per-workspace "mute notification sounds in this workspace" switch.
 *
 * The global sound preferences (on/off, volume, timbre, per-event) live on the
 * user in `NotificationDisplayPreferences` — they are device-ergonomic and not
 * something you would want to differ per workspace. This store is the one
 * genuinely per-workspace sound control, mirroring how the rest of the
 * workspace-settings screen persists its local-only preferences
 * (`settings-preferences.store.ts` in `@org/web-workspace`): keyed by workspace
 * id, mirrored to `localStorage`, so muting sounds in one workspace never
 * touches another.
 *
 * Kept in `@org/notifications` (not `@org/web-workspace`) so the runtime sound
 * bridges can read it without a dependency cycle.
 */

interface WorkspaceSoundMuteState {
  byWorkspace: Record<string, boolean>;
  setMuted: (workspaceId: string, muted: boolean) => void;
}

export const useWorkspaceSoundMuteStore = create<WorkspaceSoundMuteState>()(
  persist(
    (set) => ({
      byWorkspace: {},
      setMuted: (workspaceId, muted) =>
        set((state) => ({
          byWorkspace: { ...state.byWorkspace, [workspaceId]: muted },
        })),
    }),
    {
      name: 'onetab:notifications:sound-mute',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Reactive read for a single workspace. */
export function useWorkspaceSoundMuted(workspaceId: string | undefined): boolean {
  return useWorkspaceSoundMuteStore((state) =>
    workspaceId ? (state.byWorkspace[workspaceId] ?? false) : false,
  );
}

/** `[muted, setMuted]`, `useState`-shaped, for the settings panel. */
export function useWorkspaceSoundMuteControl(
  workspaceId: string | undefined,
): [boolean, (muted: boolean) => void] {
  const muted = useWorkspaceSoundMuted(workspaceId);
  const set = useWorkspaceSoundMuteStore((state) => state.setMuted);
  const setMuted = useCallback(
    (value: boolean) => {
      if (workspaceId) set(workspaceId, value);
    },
    [set, workspaceId],
  );
  return [muted, setMuted];
}

/** Non-React read for the bridges / service. */
export function isWorkspaceSoundMuted(workspaceId: string | undefined): boolean {
  if (!workspaceId) return false;
  return useWorkspaceSoundMuteStore.getState().byWorkspace[workspaceId] ?? false;
}
