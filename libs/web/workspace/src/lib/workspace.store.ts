import type { WorkspaceSummary } from '@org/types';
import { create } from 'zustand';

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  activeWorkspaceSlug: string | null;
  activeWorkspace: WorkspaceSummary | null;
  activeMembershipEmail: string | null;
  isSwitching: boolean;
  isAddAccountOpen: boolean;
  isInviteMembersOpen: boolean;
  inviteTargetWorkspace: WorkspaceSummary | null;

  setActiveWorkspace: (workspace: WorkspaceSummary | null | undefined) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setIsSwitching: (isSwitching: boolean) => void;
  setAddAccountOpen: (open: boolean) => void;
  setInviteMembersOpen: (
    open: boolean,
    workspace?: WorkspaceSummary | null,
  ) => void;
}

const LAST_ACTIVE_WORKSPACE_KEY = 'onetab_active_workspace_id';
const LAST_ACTIVE_SLUG_KEY = 'onetab_active_workspace_slug';

/**
 * Fired on the window whenever the active workspace id changes in this tab.
 * The `storage` event only reaches *other* tabs, so consumers outside this
 * store — the app-level theme scope, which cannot import this lazy-loaded
 * library — listen for this instead. `detail` is the new id (or null).
 */
export const ACTIVE_WORKSPACE_EVENT = 'onetab:active-workspace';

export function getPersistedActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function persistActiveWorkspaceId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, id);
    } else {
      localStorage.removeItem(LAST_ACTIVE_WORKSPACE_KEY);
    }
  } catch {
    // Ignore storage quota or permission errors
  }
  try {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_WORKSPACE_EVENT, { detail: id ?? null }),
    );
  } catch {
    // No window (SSR/tests without DOM) — nothing to notify.
  }
}

export function getPersistedActiveWorkspaceSlug(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_SLUG_KEY);
  } catch {
    return null;
  }
}

export function persistActiveWorkspaceSlug(slug: string | null): void {
  try {
    if (slug) {
      localStorage.setItem(LAST_ACTIVE_SLUG_KEY, slug);
    } else {
      localStorage.removeItem(LAST_ACTIVE_SLUG_KEY);
    }
  } catch {
    // Ignore
  }
}

export function getPersistedLastChannel(workspaceId: string): string | null {
  try {
    return localStorage.getItem(`onetab_last_channel_${workspaceId}`);
  } catch {
    return null;
  }
}

export function persistLastChannel(
  workspaceId: string,
  channelSlug: string,
): void {
  try {
    localStorage.setItem(`onetab_last_channel_${workspaceId}`, channelSlug);
  } catch {
    // Ignore
  }
}

/**
 * The last route the user had open *inside* a given workspace, stored as the
 * path after `/w/:slug` (e.g. `"threads"`, `"c/general"`, `"tasks/42"`, or `""`
 * for Home). Keyed by workspace id so a slug rename never loses it.
 *
 * Lets a workspace switch — from the switcher, the "/" redirect, or a
 * dead-workspace fallback — resume exactly where the user left that workspace
 * rather than always dropping them on Home. Returns `null` when nothing has been
 * recorded yet.
 */
export function getPersistedLastWorkspacePath(
  workspaceId: string,
): string | null {
  try {
    return localStorage.getItem(`onetab_last_path_${workspaceId}`);
  } catch {
    return null;
  }
}

export function persistLastWorkspacePath(
  workspaceId: string,
  subPath: string,
): void {
  try {
    localStorage.setItem(`onetab_last_path_${workspaceId}`, subPath);
  } catch {
    // Ignore
  }
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

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: getPersistedActiveWorkspaceId(),
  activeWorkspaceSlug: getPersistedActiveWorkspaceSlug(),
  activeWorkspace: null,
  activeMembershipEmail: null,
  isSwitching: false,
  isAddAccountOpen: false,
  isInviteMembersOpen: false,
  inviteTargetWorkspace: null,

  setActiveWorkspace: (workspace) => {
    if (workspace) {
      persistActiveWorkspaceId(workspace.id);
      persistActiveWorkspaceSlug(workspace.slug);
      set({
        activeWorkspace: workspace,
        activeWorkspaceId: workspace.id,
        activeWorkspaceSlug: workspace.slug,
        activeMembershipEmail: workspace.email ?? null,
      });
    } else {
      set({
        activeWorkspace: null,
        activeWorkspaceId: null,
        activeWorkspaceSlug: null,
        activeMembershipEmail: null,
      });
    }
  },

  setActiveWorkspaceId: (id) => {
    persistActiveWorkspaceId(id);
    set({ activeWorkspaceId: id });
  },

  setIsSwitching: (isSwitching) => set({ isSwitching }),
  setAddAccountOpen: (isAddAccountOpen) => set({ isAddAccountOpen }),
  setInviteMembersOpen: (isInviteMembersOpen, workspace = null) =>
    set({
      isInviteMembersOpen,
      inviteTargetWorkspace: workspace ?? null,
    }),
}));
