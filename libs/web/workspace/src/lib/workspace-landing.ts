import { ApiError } from '@org/api-client';
import { getNavigationMemorySnapshot } from './navigation-memory.store.js';
import {
  getPersistedActiveWorkspaceId,
  getPersistedActiveWorkspaceSlug,
} from './workspace.store.js';

/**
 * Whether a failed workspace lookup means the workspace is really out of reach.
 *
 * Only a 404 says that: `WorkspaceRoleGuard` answers 404 for both "does not
 * exist" and "not a member". Everything else — offline, a 429, a 5xx, a deploy
 * restarting the API — says nothing about the workspace, and must never move the
 * user out of it.
 */
export function isWorkspaceGoneError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * The workspace to open when the URL does not name a usable one.
 *
 * This tab's last workspace wins, then the workspace last used on any device,
 * then the first one. `excludeSlug` drops the workspace that just failed; a
 * renamed workspace still matches by id, so a stale slug lands back in it.
 */
export function pickLandingWorkspace<T extends { id: string; slug: string }>(
  workspaces: readonly T[],
  options: { excludeSlug?: string } = {},
): T | undefined {
  const candidates = workspaces.filter((w) => w.slug !== options.excludeSlug);
  const persistedId = getPersistedActiveWorkspaceId();
  const persistedSlug = getPersistedActiveWorkspaceSlug();
  const nav = getNavigationMemorySnapshot();

  return (
    candidates.find((w) => w.id === persistedId) ||
    candidates.find((w) => w.slug === persistedSlug) ||
    candidates.find((w) => w.id === nav.lastWorkspaceId) ||
    candidates.find((w) => w.slug === nav.lastWorkspaceSlug) ||
    candidates[0]
  );
}
