import { create } from 'zustand';

/** The channel shown in the split pane beside the routed page. */
export interface SplitViewChannel {
  id: string;
  slug: string;
  name: string;
}

export interface SplitViewState {
  /**
   * Keyed by workspace id: a channel id only means something inside its own
   * workspace, so switching workspace hides the pane rather than pointing it
   * at a channel that doesn't exist there — and switching back restores it.
   */
  byWorkspace: Record<string, SplitViewChannel>;
  open: (workspaceId: string, channel: SplitViewChannel) => void;
  close: (workspaceId: string) => void;
}

/**
 * Session-only on purpose: a split pane is a "right now" arrangement, and
 * coming back to one a week later is more surprising than useful.
 */
export const useSplitViewStore = create<SplitViewState>()((set) => ({
  byWorkspace: {},
  open: (workspaceId, channel) =>
    set((state) => ({
      byWorkspace: { ...state.byWorkspace, [workspaceId]: channel },
    })),
  close: (workspaceId) =>
    set((state) => {
      if (!state.byWorkspace[workspaceId]) return state;
      const byWorkspace = { ...state.byWorkspace };
      delete byWorkspace[workspaceId];
      return { byWorkspace };
    }),
}));

/** The split-pane channel for `workspaceId`, if one is open. */
export function useSplitViewChannel(
  workspaceId: string | undefined,
): SplitViewChannel | undefined {
  return useSplitViewStore((s) =>
    workspaceId ? s.byWorkspace[workspaceId] : undefined,
  );
}
