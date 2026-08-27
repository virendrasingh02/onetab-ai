import type { WorkspaceSummary } from '@org/types';
import { create } from 'zustand';

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  activeWorkspaceSlug: string | null;
  activeWorkspace: WorkspaceSummary | null;
  activeMembershipEmail: string | null;
  isSwitching: boolean;
  isManageAccountsOpen: boolean;
  isAddAccountOpen: boolean;
  isInviteMembersOpen: boolean;
  inviteTargetWorkspace: WorkspaceSummary | null;

  setActiveWorkspace: (workspace: WorkspaceSummary | null | undefined) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setIsSwitching: (isSwitching: boolean) => void;
  setManageAccountsOpen: (open: boolean) => void;
  setAddAccountOpen: (open: boolean) => void;
  setInviteMembersOpen: (
    open: boolean,
    workspace?: WorkspaceSummary | null,
  ) => void;
}

const LAST_ACTIVE_WORKSPACE_KEY = 'onetab_active_workspace_id';
const LAST_ACTIVE_SLUG_KEY = 'onetab_active_workspace_slug';

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

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: getPersistedActiveWorkspaceId(),
  activeWorkspaceSlug: getPersistedActiveWorkspaceSlug(),
  activeWorkspace: null,
  activeMembershipEmail: null,
  isSwitching: false,
  isManageAccountsOpen: false,
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
  setManageAccountsOpen: (isManageAccountsOpen) => set({ isManageAccountsOpen }),
  setAddAccountOpen: (isAddAccountOpen) => set({ isAddAccountOpen }),
  setInviteMembersOpen: (isInviteMembersOpen, workspace = null) =>
    set({
      isInviteMembersOpen,
      inviteTargetWorkspace: workspace ?? null,
    }),
}));
