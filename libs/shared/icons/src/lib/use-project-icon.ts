import { queryKeys, workToolsApi } from '@org/api-client';
import type { IconSelection, Project, ProjectDetail } from '@org/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  useIconEditor,
  type IconEditor,
  type IconSource,
} from './use-icon-editor.js';

/**
 * A project's icon, as an editable source.
 *
 * The workspace equivalent next door is the model: the only project-specific
 * parts are which endpoint persists the icon and which caches have to be
 * refreshed afterwards. Editing itself — optimism, rollback, pending state —
 * comes from `useIconEditor`.
 *
 * Any workspace member may edit a project, so there is no role check here; the
 * API guards the workspace, and `canEdit` only reflects whether there is a
 * project to write to at all.
 */
export function useProjectIcon(
  workspaceId: string | undefined,
  project: Pick<Project, 'id' | 'icon' | 'iconColor'> | undefined,
): IconEditor {
  const queryClient = useQueryClient();
  const projectId = project?.id;
  const listKey = queryKeys.workTools.projects(workspaceId ?? '');

  const save = useMutation({
    mutationFn: (selection: IconSelection) =>
      workToolsApi.setProjectIcon(
        workspaceId as string,
        projectId as string,
        selection,
      ),

    /*
     * Written into the list cache before the request rather than invalidated
     * after it: the sidebar, the gallery and the board header all read the same
     * list, so every one of them changes on the click, not a round trip later.
     */
    onMutate: async (selection) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ProjectDetail[]>(listKey);
      queryClient.setQueryData(listKey, (old: ProjectDetail[] | undefined) =>
        old?.map((entry) =>
          entry.id === projectId ? { ...entry, ...selection } : entry,
        ),
      );
      return { previous };
    },

    onError: (_cause, _selection, context) => {
      queryClient.setQueryData(listKey, context?.previous);
    },

    // Reconciles anything else keyed on the project — task badges carry the
    // icon too.
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.all(workspaceId ?? ''),
      });
    },
  });

  const canEdit = !!workspaceId && !!projectId;

  // The mutation object is new on every render; `mutateAsync` is not, so the
  // source below stays stable between actual changes. The ids it writes to are
  // not dependencies for the same reason: react-query re-reads `mutationFn` on
  // every render, so a stale memo still saves against the current project.
  const saveIcon = save.mutateAsync;

  return useIconEditor(
    useMemo<IconSource>(
      () => ({
        icon: project?.icon,
        iconColor: project?.iconColor,
        canEdit,
        save: (selection: IconSelection) => saveIcon(selection),

        /*
         * Deliberately no `upload`. Projects have no image store of their own,
         * and without one the picker inlines the file as a `data:` URI — a
         * multi-megabyte string in a column read on every list request, which
         * `iconSchema` refuses outright. `ProjectIconPicker` hides the upload
         * button to match, leaving icons, which is what a project row has
         * room to draw anyway.
         */
      }),
      [canEdit, project?.icon, project?.iconColor, saveIcon],
    ),
  );
}
