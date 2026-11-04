// @vitest-environment jsdom
import { ApiError } from '@org/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavigationMemoryStore } from './navigation-memory.store.js';
import {
  isWorkspaceGoneError,
  pickLandingWorkspace,
} from './workspace-landing.js';
import {
  getPersistedActiveWorkspaceId,
  persistActiveWorkspaceId,
  persistActiveWorkspaceSlug,
} from './workspace.store.js';

const alpha = { id: 'ws-a', slug: 'alpha' };
const beta = { id: 'ws-b', slug: 'beta' };
const gamma = { id: 'ws-c', slug: 'gamma' };
const all = [alpha, beta, gamma];

/** This test environment has no Web Storage, and the tab/shared split needs both. */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function apiError(statusCode: number): ApiError {
  return new ApiError({
    statusCode,
    message: 'failed',
  } as ConstructorParameters<typeof ApiError>[0]);
}

describe('isWorkspaceGoneError', () => {
  it('treats only a 404 as gone', () => {
    expect(isWorkspaceGoneError(apiError(404))).toBe(true);
  });

  it.each([0, 401, 403, 429, 500, 503])(
    'does not treat status %i as gone',
    (status) => {
      expect(isWorkspaceGoneError(apiError(status))).toBe(false);
    },
  );

  it('does not treat an unknown error as gone', () => {
    expect(isWorkspaceGoneError(new Error('Network Error'))).toBe(false);
    expect(isWorkspaceGoneError(null)).toBe(false);
  });
});

describe('pickLandingWorkspace', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    useNavigationMemoryStore.setState({
      lastWorkspaceId: null,
      lastWorkspaceSlug: null,
      workspacePaths: {},
    });
  });

  it('prefers the last workspace over the first in the list', () => {
    persistActiveWorkspaceId(gamma.id);
    expect(pickLandingWorkspace(all)).toBe(gamma);
  });

  it('falls back to the synced navigation memory on a fresh device', () => {
    useNavigationMemoryStore.setState({ lastWorkspaceId: beta.id });
    expect(pickLandingWorkspace(all)).toBe(beta);
  });

  it('skips the excluded workspace even when it was the last one', () => {
    persistActiveWorkspaceId(alpha.id);
    persistActiveWorkspaceSlug(alpha.slug);
    useNavigationMemoryStore.setState({ lastWorkspaceId: gamma.id });
    expect(pickLandingWorkspace(all, { excludeSlug: 'alpha' })).toBe(gamma);
  });

  it('finds a renamed workspace by id when its old slug is excluded', () => {
    persistActiveWorkspaceId(beta.id);
    expect(pickLandingWorkspace(all, { excludeSlug: 'beta-old' })).toBe(beta);
  });

  it('returns undefined when nothing else is left', () => {
    expect(pickLandingWorkspace([alpha], { excludeSlug: 'alpha' })).toBe(
      undefined,
    );
  });

  it("keeps this tab's workspace when another tab moved elsewhere", () => {
    persistActiveWorkspaceId(alpha.id);
    // What another tab's switch leaves behind: only the shared copy changes.
    localStorage.setItem('onetab_active_workspace_id', beta.id);
    expect(getPersistedActiveWorkspaceId()).toBe(alpha.id);
    expect(pickLandingWorkspace(all)).toBe(alpha);
  });

  it('starts a new tab from the workspace last used in any tab', () => {
    localStorage.setItem('onetab_active_workspace_id', beta.id);
    expect(pickLandingWorkspace(all)).toBe(beta);
  });
});
