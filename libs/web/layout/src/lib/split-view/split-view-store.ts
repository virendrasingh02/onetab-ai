import { create } from 'zustand';

/** A channel shown in the split pane beside the routed page. */
export interface SplitViewChannel {
  kind?: 'channel';
  id: string;
  slug: string;
  name: string;
}

/**
 * A direct message shown in the split pane: `id` is the peer's user id for a
 * 1:1, or the Matrix room id for a group DM.
 */
export interface SplitViewDirect {
  kind: 'dm' | 'group';
  id: string;
  name: string;
}

/**
 * Any other page of the workspace (a doc, a project, the inbox…): `id` is its
 * path, query included.
 */
export interface SplitViewRoute {
  kind: 'route';
  id: string;
  name: string;
}

export type SplitViewTarget =
  | SplitViewChannel
  | SplitViewDirect
  | SplitViewRoute;

export interface SplitViewState {
  /**
   * Keyed by workspace id: a channel id only means something inside its own
   * workspace, so switching workspace hides the pane rather than pointing it
   * at a channel that doesn't exist there — and switching back restores it.
   */
  byWorkspace: Record<string, SplitViewTarget>;
  open: (workspaceId: string, target: SplitViewTarget) => void;
  close: (workspaceId: string) => void;
}

/**
 * Session-only on purpose: a split pane is a "right now" arrangement, and
 * coming back to one a week later is more surprising than useful.
 */
export const useSplitViewStore = create<SplitViewState>()((set) => ({
  byWorkspace: {},
  open: (workspaceId, target) =>
    set((state) => ({
      byWorkspace: { ...state.byWorkspace, [workspaceId]: target },
    })),
  close: (workspaceId) =>
    set((state) => {
      if (!state.byWorkspace[workspaceId]) return state;
      const byWorkspace = { ...state.byWorkspace };
      delete byWorkspace[workspaceId];
      return { byWorkspace };
    }),
}));

/** The split-pane conversation for `workspaceId`, if one is open. */
export function useSplitViewChannel(
  workspaceId: string | undefined,
): SplitViewTarget | undefined {
  return useSplitViewStore((s) =>
    workspaceId ? s.byWorkspace[workspaceId] : undefined,
  );
}
