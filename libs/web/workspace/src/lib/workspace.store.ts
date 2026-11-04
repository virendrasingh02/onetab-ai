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

/**
 * The active workspace is per tab. `sessionStorage` holds this tab's own value,
 * so working in another tab can never re-scope this one; `localStorage` holds
 * the last workspace used in any tab, which is where a brand-new tab starts.
 */
function readActivePointer(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeActivePointer(key: string, value: string | null): void {
  try {
    for (const storage of [sessionStorage, localStorage]) {
      if (value) {
        storage.setItem(key, value);
      } else {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage quota or permission errors
  }
}

export function getPersistedActiveWorkspaceId(): string | null {
  return readActivePointer(LAST_ACTIVE_WORKSPACE_KEY);
}

export function persistActiveWorkspaceId(id: string | null): void {
  writeActivePointer(LAST_ACTIVE_WORKSPACE_KEY, id);
  try {
    window.dispatchEvent(
      new CustomEvent(ACTIVE_WORKSPACE_EVENT, { detail: id ?? null }),
    );
  } catch {
    // No window (SSR/tests without DOM) — nothing to notify.
  }
}

export function getPersistedActiveWorkspaceSlug(): string | null {
  return readActivePointer(LAST_ACTIVE_SLUG_KEY);
}

export function persistActiveWorkspaceSlug(slug: string | null): void {
  writeActivePointer(LAST_ACTIVE_SLUG_KEY, slug);
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

/*
 * The cross-device "resume where I left each workspace" memory
 * (`getPersistedLastWorkspacePath` / `persistLastWorkspacePath` /
 * `workspaceEntryPath`) moved to `navigation-memory.store.ts`, which backs it
 * with a subscribable store the server-sync hook can hydrate and push.
 */

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
