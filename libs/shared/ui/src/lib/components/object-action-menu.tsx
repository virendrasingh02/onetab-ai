import { useState, type ReactNode } from 'react';
import {
  Bookmark,
  CheckSquare,
  Copy,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { useRightPanelStore } from './right-panel-store.js';

export interface ObjectActionMenuTarget {
  type: string;
  id: string;
  title: string;
  href?: string;
}

export interface ObjectActionMenuProps {
  target: ObjectActionMenuTarget;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  onCreateTask?: () => void;
  onAskAI?: () => void;
  onOpenContext?: () => void;
  onCopyLink?: () => void;
  trigger?: ReactNode;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function ObjectActionMenu({
  target,
  isBookmarked = false,
  onBookmarkToggle,
  onCreateTask,
  onAskAI,
  onOpenContext,
  onCopyLink,
  trigger,
  align = 'end',
  side = 'bottom',
  className,
}: ObjectActionMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (onCopyLink) {
      onCopyLink();
      return;
    }
    const url = target.href
      ? `${window.location.origin}${target.href}`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenContext = () => {
    if (onOpenContext) {
      onOpenContext();
      return;
    }
    useRightPanelStore.getState().openContext({
      type: target.type,
      id: target.id,
      title: target.title,
    });
  };

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI();
      return;
    }
    useRightPanelStore.getState().setView('assistant');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon-xs"
            className={className}
            aria-label="Object actions"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-48 text-xs">
        {target.href && (
          <DropdownMenuItem
            onClick={() => {
              window.location.href = target.href!;
            }}
          >
            <ExternalLink className="size-3.5 mr-2" />
            <span>Open {target.type}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="size-3.5 mr-2" />
          <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
        </DropdownMenuItem>

        {onBookmarkToggle && (
          <DropdownMenuItem onClick={onBookmarkToggle}>
            <Bookmark
              className={`size-3.5 mr-2 ${
                isBookmarked ? 'fill-primary text-primary' : ''
              }`}
            />
            <span>{isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}</span>
          </DropdownMenuItem>
        )}

        {onCreateTask && (
          <DropdownMenuItem onClick={onCreateTask}>
            <CheckSquare className="size-3.5 mr-2" />
            <span>Create Task</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleOpenContext}>
          <Link2 className="size-3.5 mr-2" />
          <span>View Related Context</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAskAI}>
          <Sparkles className="size-3.5 mr-2 text-primary" />
          <span>Ask AI About This</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
