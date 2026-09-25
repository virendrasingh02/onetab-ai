import { ProjectStatus, WorkspacePermission, type Project } from '@org/types';
import { copyToClipboard, entityUrl, type EntityAction } from '@org/ui';
import {
  Archive,
  ArchiveRestore,
  Download,
  FolderOpen,
  Link2,
  Pencil,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';

export interface ProjectActionOptions {
  project: Pick<Project, 'id' | 'name' | 'status'>;
  /** `useWorkspacePermission().can` — gates edit/delete like the API does. */
  can: (permission: WorkspacePermission) => boolean;
  /** In-app path of the project's board, for Open / Copy link. */
  path: string;
  onOpen: () => void;
  onOpenSettings?: () => void;
  /** Prompts for and saves a new name. */
  onRename?: () => unknown;
  onSetStatus?: (status: ProjectStatus) => unknown;
  /** Deletes without asking — the action confirms first. */
  onDelete?: () => unknown;
  onExport?: () => unknown;
  favorite?: { isFavorite: boolean; onToggle: () => void };
}

/**
 * Every contextual action a project offers, in one place — the sidebar row and
 * the project gallery card both render this list (as right-click menu, "⋯"
 * menu and touch sheet), so they can't disagree about what a project can do.
 *
 * Edit actions need `update` and delete needs `delete`, mirroring the
 * `@RequireWorkspacePermissions` guards on the projects controller; the
 * server still re-checks every request.
 */
export function buildProjectActions({
  project,
  can,
  path,
  onOpen,
  onOpenSettings,
  onRename,
  onSetStatus,
  onDelete,
  onExport,
  favorite,
}: ProjectActionOptions): EntityAction[] {
  const canUpdate = can(WorkspacePermission.UPDATE);
  const canDelete = can(WorkspacePermission.DELETE);
  const isArchived = project.status === ProjectStatus.ARCHIVED;

  return [
    { id: 'open', group: 'open', label: 'Open project', icon: FolderOpen, run: onOpen },
    {
      id: 'rename',
      group: 'edit',
      label: 'Rename…',
      icon: Pencil,
      shortcut: 'R',
      hidden: !onRename || !canUpdate,
      run: onRename,
    },
    {
      id: 'settings',
      group: 'edit',
      label: 'Project settings',
      icon: Settings,
      hidden: !onOpenSettings,
      run: onOpenSettings,
    },
    {
      id: 'favorite',
      group: 'organize',
      label: favorite?.isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      shortcut: 'F',
      hidden: !favorite,
      run: favorite?.onToggle,
    },
    {
      id: 'copy-link',
      group: 'organize',
      label: 'Copy project link',
      icon: Link2,
      shortcut: 'C',
      run: () => copyToClipboard(entityUrl(path)),
    },
    {
      id: 'export',
      group: 'organize',
      label: 'Export as JSON',
      icon: Download,
      hidden: !onExport,
      run: onExport,
    },
    {
      id: isArchived ? 'restore' : 'archive',
      group: 'lifecycle',
      label: isArchived ? 'Restore project' : 'Archive project',
      icon: isArchived ? ArchiveRestore : Archive,
      hidden: !onSetStatus || !canUpdate,
      successMessage: isArchived
        ? `“${project.name}” restored`
        : `“${project.name}” archived`,
      run: () =>
        onSetStatus?.(isArchived ? ProjectStatus.ACTIVE : ProjectStatus.ARCHIVED),
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete project…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete || !canDelete,
      confirm: {
        title: `Delete “${project.name}”?`,
        description:
          'The project and every task on its board are deleted for everyone. This cannot be undone.',
        confirmLabel: 'Delete project',
        destructive: true,
      },
      run: onDelete,
    },
  ];
}
