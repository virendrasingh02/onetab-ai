import { useEffect, useMemo } from 'react';
import { getDesktopApi } from './desktop-api.js';

/**
 * Mirrors the signed-in user's workspaces into the Windows taskbar Jump List
 * ("Workspaces" category, like Slack). The main process ignores repeats and
 * clears the list on sign-out; a no-op outside the desktop shell and off
 * Windows.
 *
 * Only one component should own this per app — the shell that holds the list.
 */
export function useDesktopJumpList(
  workspaces: ReadonlyArray<{ name: string; slug: string }> | undefined,
): void {
  // Keyed on content, not identity, so a refetch with the same list is free.
  const key = useMemo(
    () => JSON.stringify((workspaces ?? []).map(({ name, slug }) => ({ name, slug }))),
    [workspaces],
  );

  useEffect(() => {
    if (!workspaces) return;
    const setJumpListWorkspaces = getDesktopApi()?.windows?.setJumpListWorkspaces;
    if (!setJumpListWorkspaces) return;
    void setJumpListWorkspaces(JSON.parse(key)).catch(() => undefined);
    // `workspaces` is covered by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
