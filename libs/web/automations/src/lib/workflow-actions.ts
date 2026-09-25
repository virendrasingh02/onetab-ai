import type { AutomationWorkflow } from '@org/types';
import { copyToClipboard, entityUrl, type EntityAction } from '@org/ui';
import {
  CopyPlus,
  Download,
  History,
  Link2,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';

export interface WorkflowActionOptions {
  workflow: Pick<AutomationWorkflow, 'id' | 'name' | 'isActive'>;
  /** In-app path that opens this workflow, for Copy link. */
  path: string;
  onOpen: () => void;
  onRun?: () => unknown;
  onSetActive?: (active: boolean) => unknown;
  onDuplicate?: () => unknown;
  onViewHistory?: () => void;
  onExport?: () => unknown;
  /** Deletes without asking — the action confirms first. */
  onDelete?: () => unknown;
}

/**
 * Every contextual action a saved workflow offers. The workflow list renders
 * it as each card's right-click menu, "⋯" menu and touch sheet; anything the
 * host doesn't wire is left out rather than shown dead.
 */
export function buildWorkflowActions({
  workflow,
  path,
  onOpen,
  onRun,
  onSetActive,
  onDuplicate,
  onViewHistory,
  onExport,
  onDelete,
}: WorkflowActionOptions): EntityAction[] {
  return [
    { id: 'open', group: 'open', label: 'Open in builder', icon: Pencil, shortcut: 'E', run: onOpen },
    {
      id: 'run',
      group: 'run',
      label: 'Run now',
      icon: Play,
      hidden: !onRun,
      disabled: !workflow.isActive,
      disabledReason: 'Enable the workflow to run it',
      run: onRun,
    },
    {
      id: 'toggle-active',
      group: 'run',
      label: workflow.isActive ? 'Disable' : 'Enable',
      icon: workflow.isActive ? Pause : Play,
      hidden: !onSetActive,
      successMessage: workflow.isActive
        ? `“${workflow.name}” disabled`
        : `“${workflow.name}” enabled`,
      run: () => onSetActive?.(!workflow.isActive),
    },
    {
      id: 'history',
      group: 'run',
      label: 'View execution history',
      icon: History,
      hidden: !onViewHistory,
      run: onViewHistory,
    },
    {
      id: 'duplicate',
      group: 'manage',
      label: 'Duplicate',
      icon: CopyPlus,
      shortcut: 'D',
      hidden: !onDuplicate,
      run: onDuplicate,
    },
    {
      id: 'copy-link',
      group: 'manage',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'L',
      run: () => copyToClipboard(entityUrl(path)),
    },
    {
      id: 'export',
      group: 'manage',
      label: 'Export configuration',
      icon: Download,
      hidden: !onExport,
      run: onExport,
    },
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete,
      confirm: {
        title: `Delete “${workflow.name}”?`,
        description:
          'The workflow and its run history are deleted for the whole workspace. This cannot be undone.',
        confirmLabel: 'Delete workflow',
        destructive: true,
      },
      successMessage: `“${workflow.name}” deleted`,
      run: onDelete,
    },
  ];
}

/** Downloads a workflow's definition (graph + trigger) as JSON. */
export function downloadWorkflowConfig(workflow: AutomationWorkflow): void {
  const parse = (json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return json;
    }
  };
  const config = {
    name: workflow.name,
    description: workflow.description,
    triggerType: workflow.triggerType,
    nodes: parse(workflow.nodesJson),
    edges: parse(workflow.edgesJson),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workflow.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'workflow'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
