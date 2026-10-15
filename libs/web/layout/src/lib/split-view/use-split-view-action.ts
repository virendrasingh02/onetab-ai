import type { EntityAction } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Columns2 } from 'lucide-react';
import { useCallback } from 'react';
import { useSplitViewStore } from './split-view-store.js';

/**
 * Builds the "Open in split view" action for any workspace page, so every
 * sidebar row offers it the same way. Hidden until the workspace has resolved.
 */
export function useSplitViewAction() {
  const { workspaceId } = useCurrentWorkspace();
  const open = useSplitViewStore((s) => s.open);

  return useCallback(
    (path: string, name: string): EntityAction => ({
      id: 'split-view',
      group: 'open',
      label: 'Open in split view',
      icon: Columns2,
      hidden: !workspaceId,
      run: () => {
        if (workspaceId) open(workspaceId, { kind: 'route', id: path, name });
      },
    }),
    [workspaceId, open],
  );
}
