// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getNavigationMemorySnapshot,
  getPersistedLastWorkspacePath,
  persistLastWorkspacePath,
  useNavigationMemoryStore,
  workspaceEntryPath,
} from './navigation-memory.store.js';

function reset() {
  localStorage.clear();
  useNavigationMemoryStore.setState({
    lastWorkspaceId: null,
    lastWorkspaceSlug: null,
    workspacePaths: {},
    locallyTouched: new Set<string>(),
  });
}

describe('navigation memory store', () => {
  beforeEach(reset);

  it('remembers a route per workspace and the last workspace active', () => {
    persistLastWorkspacePath('ws-1', 'threads', 'alpha');
    persistLastWorkspacePath('ws-2', 'c/general', 'beta');

    expect(getPersistedLastWorkspacePath('ws-1')).toBe('threads');
    expect(getPersistedLastWorkspacePath('ws-2')).toBe('c/general');
    expect(getPersistedLastWorkspacePath('ws-404')).toBeNull();

    const snap = getNavigationMemorySnapshot();
    expect(snap.lastWorkspaceId).toBe('ws-2');
    expect(snap.lastWorkspaceSlug).toBe('beta');
  });

  it('builds the entry path from the remembered route, else the root', () => {
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe('/w/alpha');

    persistLastWorkspacePath('ws-1', 'tasks/42', 'alpha');
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe(
      '/w/alpha/tasks/42',
    );

    // An explicit Home visit is recorded as "" and resolves back to the root.
    persistLastWorkspacePath('ws-1', '', 'alpha');
    expect(workspaceEntryPath({ id: 'ws-1', slug: 'alpha' })).toBe('/w/alpha');
  });

  it('writes through to localStorage for first paint', () => {
    persistLastWorkspacePath('ws-1', 'threads', 'alpha');
    const raw = JSON.parse(
      localStorage.getItem('onetab:navigation_memory') ?? '{}',
    );
    expect(raw.workspacePaths['ws-1']).toBe('threads');
    expect(raw.lastWorkspaceId).toBe('ws-1');
  });

  it('server snapshot: wins for untouched keys, loses to this-session edits, fills gaps', () => {
    // A stale value from a previous session (in the map, never touched here).
    useNavigationMemoryStore.setState({
      workspacePaths: { 'ws-stale': 'old-section' },
    });
    // A route the user actually navigated this session.
    persistLastWorkspacePath('ws-live', 'threads', 'live');

    useNavigationMemoryStore.getState().applyServerSnapshot({
      lastWorkspaceId: 'ws-server',
      lastWorkspaceSlug: 'server',
      workspacePaths: {
        'ws-stale': 'server-section',
        'ws-live': 'dashboard',
        'ws-new': 'inbox',
      },
    });

    expect(getPersistedLastWorkspacePath('ws-stale')).toBe('server-section'); // server wins
    expect(getPersistedLastWorkspacePath('ws-live')).toBe('threads'); // this session wins
    expect(getPersistedLastWorkspacePath('ws-new')).toBe('inbox'); // added

    // `lastWorkspaceId` stays on this session's choice, not the server's.
    expect(getNavigationMemorySnapshot().lastWorkspaceId).toBe('ws-live');
  });

  it('server snapshot seeds last-workspace when this session has touched nothing', () => {
    useNavigationMemoryStore.getState().applyServerSnapshot({
      lastWorkspaceId: 'ws-server',
      lastWorkspaceSlug: 'server',
      workspacePaths: { 'ws-server': 'tasks' },
    });
    expect(getNavigationMemorySnapshot().lastWorkspaceId).toBe('ws-server');
    expect(getPersistedLastWorkspacePath('ws-server')).toBe('tasks');
  });
});
