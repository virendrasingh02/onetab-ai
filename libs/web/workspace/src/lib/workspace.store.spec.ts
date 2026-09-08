// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceRole, WorkspaceStatus, type WorkspaceSummary } from '@org/types';
import {
  getPersistedActiveWorkspaceId,
  getPersistedLastChannel,
  getPersistedLastWorkspacePath,
  persistLastChannel,
  persistLastWorkspacePath,
  useWorkspaceStore,
  workspaceEntryPath,
} from './workspace.store.js';

const mockWorkspace: WorkspaceSummary = {
  id: 'ws-100',
  name: 'Alpha Team',
  slug: 'alpha-team',
  email: 'test@alpha.com',
  description: null,
  avatarUrl: null,
  icon: null,
  iconColor: null,
  ownerId: 'user-10',
  status: WorkspaceStatus.ACTIVE,
  archivedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  role: WorkspaceRole.OWNER,
  permissions: [],
  memberCount: 5,
  channelCount: 2,
};

describe('WorkspaceStore and Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.getState().setActiveWorkspace(null);
  });

  it('updates state and persists active workspace and membership email', () => {
    useWorkspaceStore.getState().setActiveWorkspace(mockWorkspace);

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe('ws-100');
    expect(state.activeWorkspaceSlug).toBe('alpha-team');
    expect(state.activeMembershipEmail).toBe('test@alpha.com');
    expect(getPersistedActiveWorkspaceId()).toBe('ws-100');
  });

  it('persists and restores last selected channel per workspace', () => {
    persistLastChannel('ws-100', 'announcements');
    expect(getPersistedLastChannel('ws-100')).toBe('announcements');
    expect(getPersistedLastChannel('ws-200')).toBeNull();
  });

  it('persists and restores the last in-workspace route per workspace', () => {
    persistLastWorkspacePath('ws-100', 'threads');
    persistLastWorkspacePath('ws-200', 'c/general');

    expect(getPersistedLastWorkspacePath('ws-100')).toBe('threads');
    expect(getPersistedLastWorkspacePath('ws-200')).toBe('c/general');
    expect(getPersistedLastWorkspacePath('ws-404')).toBeNull();
  });

  it('builds the workspace entry path from the remembered route, else the root', () => {
    // Nothing recorded yet — bare workspace root.
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe('/w/alpha');

    persistLastWorkspacePath('ws-1', 'tasks/42');
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe(
      '/w/alpha/tasks/42',
    );

    // An explicit Home visit is recorded as "" and resolves back to the root.
    persistLastWorkspacePath('ws-1', '');
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe('/w/alpha');
  });
});
