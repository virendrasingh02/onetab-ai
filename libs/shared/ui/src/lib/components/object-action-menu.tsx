import { type ReactElement } from 'react';
import {
  Bookmark,
  CheckSquare,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Network,
  Sparkles,
} from 'lucide-react';
import { copyToClipboard, entityUrl } from './action-menu/action-helpers.js';
import { ActionDropdownMenu } from './action-menu/action-menu.js';
import type { EntityAction } from './action-menu/action-model.js';
import { Button } from './button.js';
import { useRightPanelStore } from './right-panel-store.js';

export interface ObjectActionMenuTarget {
  type: string;
  id: string;
  title: string;
  href?: string;
}

export interface ObjectActionOptions {
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  onCreateTask?: () => void;
  onAskAI?: () => void;
  onOpenContext?: () => void;
  onCopyLink?: () => void;
  /** In-app navigation for "Open". Falls back to a full page load. */
  onOpen?: (href: string) => void;
}

/**
 * The generic cross-object actions (open, copy link, bookmark, create task,
 * related context, ask AI) for any linkable object — as an action list, so a
 * surface can put the same entries behind its right-click menu too.
 */
export function buildObjectActions(
  target: ObjectActionMenuTarget,
  {
    isBookmarked = false,
    onBookmarkToggle,
    onCreateTask,
    onAskAI,
    onOpenContext,
    onCopyLink,
    onOpen,
  }: ObjectActionOptions = {},
): EntityAction[] {
  return [
    {
      id: 'open',
      group: 'open',
      label: `Open ${target.type}`,
      icon: ExternalLink,
      hidden: !target.href,
      run: () => {
        if (!target.href) return;
        if (onOpen) onOpen(target.href);
        else window.location.assign(target.href);
      },
    },
    {
      id: 'copy-link',
      group: 'open',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'L',
      run: () =>
        onCopyLink
          ? onCopyLink()
          : copyToClipboard(target.href ? entityUrl(target.href) : window.location.href),
    },
    {
      id: 'bookmark',
      group: 'organize',
      label: isBookmarked ? 'Remove bookmark' : 'Save to bookmarks',
      icon: Bookmark,
      hidden: !onBookmarkToggle,
      run: onBookmarkToggle,
    },
    {
      id: 'create-task',
      group: 'organize',
      label: 'Create task',
      icon: CheckSquare,
      hidden: !onCreateTask,
      run: onCreateTask,
    },
    {
      id: 'context',
      group: 'organize',
      label: 'View related context',
      icon: Network,
      run: () =>
        onOpenContext
          ? onOpenContext()
          : useRightPanelStore
              .getState()
              .openContext({ type: target.type, id: target.id, title: target.title }),
    },
    {
      id: 'ask-ai',
      group: 'ai',
      label: 'Ask AI about this',
      icon: Sparkles,
      run: () =>
        onAskAI ? onAskAI() : useRightPanelStore.getState().setView('assistant'),
    },
  ];
}

export interface ObjectActionMenuProps extends ObjectActionOptions {
  target: ObjectActionMenuTarget;
  trigger?: ReactElement;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/** The "⋯" button for {@link buildObjectActions}. */
export function ObjectActionMenu({
  target,
  trigger,
  align = 'end',
  side = 'bottom',
  className,
  ...options
}: ObjectActionMenuProps) {
  return (
    <ActionDropdownMenu
      actions={() => buildObjectActions(target, options)}
      scope={`${target.type}:${target.id}`}
      entityType={target.type}
      entity={target}
      align={align}
      side={side}
      contentClassName="w-52"
      trigger={
        trigger ?? (
          <Button variant="ghost" size="icon-xs" className={className} aria-label="Object actions">
            <MoreHorizontal className="size-3.5" />
          </Button>
        )
      }
    />
  );
}
