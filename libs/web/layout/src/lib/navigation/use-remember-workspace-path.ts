import { persistLastWorkspacePath } from '@org/web-workspace';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Records the route the user is on inside the current workspace, so returning to
 * that workspace — from the switcher, the "/" redirect, or a dead-workspace
 * fallback — resumes exactly where they left it rather than always landing on
 * Home. Only the part after `/w/:slug` is stored, keyed by workspace id.
 *
 * Both arguments must come from the *resolved* workspace, never the URL param:
 * mid-switch the param is already the new slug while the resolved workspace is
 * still the old one, and pairing those would file the new workspace's path under
 * the old workspace's id.
 */
export function useRememberWorkspacePath(
  workspaceId: string | undefined,
  workspaceSlug: string | undefined,
): void {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!workspaceId || !workspaceSlug) return;

    const base = `/w/${workspaceSlug}`;
    // Ignore a path that belongs to a different workspace (a switch still
    // settling) or to a route outside the shell.
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return;

    persistLastWorkspacePath(
      workspaceId,
      pathname.slice(base.length).replace(/^\/+/, ''),
    );
  }, [pathname, workspaceId, workspaceSlug]);
}
