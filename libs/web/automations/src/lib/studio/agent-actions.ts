import type { StudioAgentSummary } from '@org/types';
import type { EntityAction } from '@org/ui';
import { Archive, ArchiveRestore, Copy, FlaskConical, Pause, Play, Power, Trash2, Workflow } from 'lucide-react';

export interface AgentActionHandlers {
  onOpen?: () => void;
  onRun?: () => void | Promise<unknown>;
  onTest?: () => void | Promise<unknown>;
  onSwitchOn?: () => unknown;
  onPause?: () => unknown;
  onArchive?: () => unknown;
  onRestore?: () => unknown;
  onDuplicate?: () => unknown;
  onOpenCanvas?: () => void;
  onDelete?: () => unknown;
  /** Why it can't be switched on yet (unanswered questions…). */
  blockedReason?: string;
  canManage: boolean;
  canCreate: boolean;
}

/**
 * One action list for an agent — the card's ⋯ menu, its right-click menu and
 * the agent page's menu all read this, so they can't disagree.
 */
export function buildAgentActions(agent: StudioAgentSummary, h: AgentActionHandlers): EntityAction[] {
  const archived = agent.state === 'archived';
  return [
    { id: 'open', label: 'Open', group: 'open', hidden: !h.onOpen, run: h.onOpen },
    {
      id: 'run',
      label: 'Run now',
      icon: Play,
      group: 'run',
      hidden: !h.onRun || !h.canCreate || archived,
      run: h.onRun,
      errorMessage: false,
    },
    {
      id: 'test',
      label: 'Test run',
      description: 'Reads for real, changes nothing',
      icon: FlaskConical,
      group: 'run',
      hidden: !h.onTest || !h.canCreate || archived || !agent.isStudioAgent,
      run: h.onTest,
      errorMessage: false,
    },
    {
      id: 'switch-on',
      label: 'Switch on',
      description: agent.trigger.kind === 'manual' ? 'Publishes a version' : 'Runs on its trigger',
      icon: Power,
      group: 'state',
      hidden: !h.canManage || agent.state === 'active' || archived || !h.onSwitchOn,
      disabled: Boolean(h.blockedReason),
      disabledReason: h.blockedReason,
      run: h.onSwitchOn,
      errorMessage: false,
    },
    {
      id: 'pause',
      label: 'Pause',
      icon: Pause,
      group: 'state',
      hidden: !h.canManage || agent.state !== 'active' || !h.onPause,
      run: h.onPause,
      errorMessage: false,
    },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, group: 'more', hidden: !h.canCreate || !h.onDuplicate, run: h.onDuplicate, errorMessage: false },
    { id: 'canvas', label: 'Open workflow canvas', icon: Workflow, group: 'more', hidden: !h.onOpenCanvas, run: h.onOpenCanvas },
    { id: 'archive', label: 'Archive', icon: Archive, group: 'danger', hidden: !h.canManage || archived || !h.onArchive, run: h.onArchive, errorMessage: false },
    { id: 'restore', label: 'Restore', icon: ArchiveRestore, group: 'danger', hidden: !h.canManage || !archived || !h.onRestore, run: h.onRestore, errorMessage: false },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      group: 'danger',
      destructive: true,
      hidden: !h.canManage || !h.onDelete,
      confirm: {
        title: `Delete “${agent.name}”?`,
        description: 'Its plan, versions and schedule are deleted. Its past runs stay in Runs. This can’t be undone.',
        confirmLabel: 'Delete agent',
        destructive: true,
      },
      run: h.onDelete,
      errorMessage: false,
    },
  ];
}
