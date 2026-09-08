// @vitest-environment jsdom
import {
  getPersistedLastWorkspacePath,
  persistLastWorkspacePath,
  useNavigationMemoryStore,
} from '@org/web-workspace';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRememberWorkspacePath } from './use-remember-workspace-path.js';

function atPath(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
}

describe('useRememberWorkspacePath', () => {
  beforeEach(() => {
    localStorage.clear();
    useNavigationMemoryStore.setState({
      lastWorkspaceId: null,
      lastWorkspaceSlug: null,
      workspacePaths: {},
      locallyTouched: new Set<string>(),
    });
  });

  it('records the route after /w/:slug, keyed by workspace id', () => {
    renderHook(() => useRememberWorkspacePath('ws-alpha', 'alpha'), {
      wrapper: atPath('/w/alpha/threads'),
    });
    expect(getPersistedLastWorkspacePath('ws-alpha')).toBe('threads');
  });

  it('records a deep route verbatim', () => {
    renderHook(() => useRememberWorkspacePath('ws-alpha', 'alpha'), {
      wrapper: atPath('/w/alpha/c/general'),
    });
    expect(getPersistedLastWorkspacePath('ws-alpha')).toBe('c/general');
  });

  it('records the bare workspace root as an empty string', () => {
    persistLastWorkspacePath('ws-alpha', 'threads');
    renderHook(() => useRememberWorkspacePath('ws-alpha', 'alpha'), {
      wrapper: atPath('/w/alpha'),
    });
    expect(getPersistedLastWorkspacePath('ws-alpha')).toBe('');
  });

  it('ignores a path for a different workspace (a switch still settling)', () => {
    renderHook(() => useRememberWorkspacePath('ws-alpha', 'alpha'), {
      wrapper: atPath('/w/beta/tasks'),
    });
    expect(getPersistedLastWorkspacePath('ws-alpha')).toBeNull();
  });

  it('no-ops until the workspace is resolved', () => {
    renderHook(() => useRememberWorkspacePath(undefined, undefined), {
      wrapper: atPath('/w/alpha/threads'),
    });
    expect(getPersistedLastWorkspacePath('ws-alpha')).toBeNull();
  });
});
