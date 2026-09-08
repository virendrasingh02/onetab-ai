import { create } from 'zustand';

/**
 * Cross-device navigation memory: the route the user last had open *inside* each
 * workspace (the path after `/w/:slug` — `"threads"`, `"c/general"`, or `""` for
 * Home), plus the workspace they were last in.
 *
 * This store is the client's fast, synchronous source of truth. It hydrates from
 * `localStorage` for first paint and writes every change straight back; a
 * separate sync hook (`useNavigationSync` in `@org/web-layout`) pulls the server
 * copy over it on mount and debounce-PUTs changes to `/users/me/navigation`, so
 * a workspace switch — and opening the app on another device — resumes where the
 * user left each workspace instead of always landing on Home.
 */
export interface NavigationMemory {
  lastWorkspaceId: string | null;
  lastWorkspaceSlug: string | null;
  /** workspace id → route after `/w/:slug` (`""` means Home). */
  workspacePaths: Record<string, string>;
}

export interface NavigationMemoryState extends NavigationMemory {
  /**
   * Workspace ids whose route was set *this session*. The server snapshot must
   * not overwrite these — the user is actively navigating them here and now, so
   * this device knows better than the last one that synced.
   */
  locallyTouched: Set<string>;
  /** Record the route the user is on inside a workspace. */
  rememberWorkspaceRoute: (
    workspaceId: string,
    workspaceSlug: string,
    subPath: string,
  ) => void;
  /**
   * Merge a server snapshot in: server wins per workspace for anything this
   * session has not touched, local fills the gaps, and this session's own edits
   * always stand.
   */
  applyServerSnapshot: (snapshot: Partial<NavigationMemory>) => void;
}

const STORAGE_KEY = 'onetab:navigation_memory';

function readPersisted(): NavigationMemory {
  const empty: NavigationMemory = {
    lastWorkspaceId: null,
    lastWorkspaceSlug: null,
    workspacePaths: {},
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<NavigationMemory>;
    return {
      lastWorkspaceId: parsed.lastWorkspaceId ?? null,
      lastWorkspaceSlug: parsed.lastWorkspaceSlug ?? null,
      workspacePaths:
        parsed.workspacePaths && typeof parsed.workspacePaths === 'object'
          ? (parsed.workspacePaths as Record<string, string>)
          : {},
    };
  } catch {
    return empty;
  }
}

function persist(memory: NavigationMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage can be blocked by policy; the in-memory copy still works.
  }
}

export const useNavigationMemoryStore = create<NavigationMemoryState>(
  (set, get) => ({
    ...readPersisted(),
    locallyTouched: new Set<string>(),

    rememberWorkspaceRoute: (workspaceId, workspaceSlug, subPath) => {
      const state = get();
      if (
        state.workspacePaths[workspaceId] === subPath &&
        state.lastWorkspaceId === workspaceId &&
        state.locallyTouched.has(workspaceId)
      ) {
        return;
      }
      const next: NavigationMemory = {
        lastWorkspaceId: workspaceId,
        lastWorkspaceSlug: workspaceSlug,
        workspacePaths: { ...state.workspacePaths, [workspaceId]: subPath },
      };
      persist(next);
      set({
        ...next,
        locallyTouched: new Set(state.locallyTouched).add(workspaceId),
      });
    },

    applyServerSnapshot: (snapshot) => {
      const state = get();
      const fromServer = snapshot.workspacePaths ?? {};

      const workspacePaths: Record<string, string> = {
        ...state.workspacePaths,
        ...fromServer,
      };
      // This session's own edits win back over the server copy.
      for (const id of state.locallyTouched) {
        if (id in state.workspacePaths) {
          workspacePaths[id] = state.workspacePaths[id];
        }
      }

      const touchedThisSession = state.locallyTouched.size > 0;
      const next: NavigationMemory = {
        lastWorkspaceId: touchedThisSession
          ? state.lastWorkspaceId
          : (snapshot.lastWorkspaceId ?? state.lastWorkspaceId ?? null),
        lastWorkspaceSlug: touchedThisSession
          ? state.lastWorkspaceSlug
          : (snapshot.lastWorkspaceSlug ?? state.lastWorkspaceSlug ?? null),
        workspacePaths,
      };
      persist(next);
      set(next);
    },
  }),
);

/** The serialisable memory, for the sync hook's dirty-check and PUT body. */
export function getNavigationMemorySnapshot(): NavigationMemory {
  const { lastWorkspaceId, lastWorkspaceSlug, workspacePaths } =
    useNavigationMemoryStore.getState();
  return { lastWorkspaceId, lastWorkspaceSlug, workspacePaths };
}

/**
 * The route last open in `workspaceId`, or `null` if none recorded. `""` is a
 * real value — the user was on Home.
 */
export function getPersistedLastWorkspacePath(
  workspaceId: string,
): string | null {
  const path = useNavigationMemoryStore.getState().workspacePaths[workspaceId];
  return path ?? null;
}

/**
 * Record the route (after `/w/:slug`) the user is on in a workspace. Slug is
 * optional only so older call sites keep compiling; pass it whenever known so
 * the "last workspace" pointer stays useful on a fresh device.
 */
export function persistLastWorkspacePath(
  workspaceId: string,
  subPath: string,
  workspaceSlug?: string,
): void {
  const state = useNavigationMemoryStore.getState();
  state.rememberWorkspaceRoute(
    workspaceId,
    workspaceSlug ?? state.lastWorkspaceSlug ?? '',
    subPath,
  );
}

/**
 * The URL to open a workspace at: its remembered in-workspace route when there
 * is one, otherwise its bare root. Shared by every place that navigates *to* a
 * workspace so the "resume where I was" behaviour stays consistent.
 */
export function workspaceEntryPath(workspace: {
  id: string;
  slug: string;
}): string {
  const sub = getPersistedLastWorkspacePath(workspace.id);
  return sub ? `/w/${workspace.slug}/${sub}` : `/w/${workspace.slug}`;
}
