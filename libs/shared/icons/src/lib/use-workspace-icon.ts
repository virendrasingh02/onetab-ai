import { queryKeys, workspaceApi } from '@org/api-client';
import {
  hasWorkspaceRole,
  WorkspaceRole,
  type IconSelection,
  type Workspace,
  type WorkspaceSummary,
} from '@org/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  useIconEditor,
  type IconEditor,
  type IconSource,
} from './use-icon-editor.js';

/**
 * The workspace's icon, as an editable source.
 *
 * The only workspace-specific parts are here: which endpoint persists the
 * icon, which caches have to be refreshed afterwards, and who is allowed to
 * change it. Everything about *editing* — optimism, rollback, pending state —
 * comes from `useIconEditor`.
 */
export function useWorkspaceIcon(
  workspace: Workspace | WorkspaceSummary | undefined,
): IconEditor {
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const slug = workspace?.slug;

  const save = useMutation({
    mutationFn: (selection: IconSelection) =>
      workspaceApi.setIcon(workspaceId as string, selection),

    onSuccess: (updated) => {
      /*
       * Written into the caches rather than invalidated: the switcher, the
       * header and the settings screen all read the workspace, and a refetch
       * would leave every one of them on the old icon for a round trip.
       */
      if (slug) {
        queryClient.setQueryData(
          queryKeys.workspaces.detail(slug),
          (old: WorkspaceSummary | undefined) =>
            old ? { ...old, ...pickIcon(updated) } : old,
        );
      }
      queryClient.setQueryData(
        queryKeys.workspaces.list(),
        (old: WorkspaceSummary[] | undefined) =>
          old?.map((entry) =>
            entry.id === workspaceId
              ? { ...entry, ...pickIcon(updated) }
              : entry,
          ),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all(),
      });
    },
  });

  const canEdit =
    !!workspaceId &&
    (!isSummary(workspace) ||
      hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN));

  // The mutation object is new on every render; `mutateAsync` is not, so the
  // source below stays stable between actual changes. The id it writes to is
  // not a dependency for the same reason: react-query re-reads `mutationFn` on
  // every render, so a stale memo still saves against the current workspace.
  const saveIcon = save.mutateAsync;

  return useIconEditor(
    useMemo<IconSource>(
      () => ({
        icon: workspace?.icon,
        iconColor: workspace?.iconColor,
        canEdit,
        save: (selection: IconSelection) => saveIcon(selection),

        /*
         * Deliberately no `upload`. A workspace image is a logo, and the logo
         * already has storage, an upload route and cache-busting of its own —
         * plus it outranks the icon when both are set. Putting the same URL in
         * `icon` as well would store it twice, and the stored form is
         * API-relative while the client reads it resolved, so echoing it back
         * on the next save would bake a dev-only host into the row.
         *
         * `WorkspaceIconPicker` hides the upload tab to match; images go
         * through the logo control in settings and in the create wizard.
         */
      }),
      [canEdit, saveIcon, workspace?.icon, workspace?.iconColor],
    ),
  );
}

function pickIcon(workspace: Workspace): IconSelection {
  return { icon: workspace.icon, iconColor: workspace.iconColor };
}

function isSummary(
  workspace: Workspace | WorkspaceSummary | undefined,
): workspace is WorkspaceSummary {
  return !!workspace && 'role' in workspace;
}
