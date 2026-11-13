import { Dialog, DialogContent, DialogTitle, Kbd, KbdShortcut } from '@org/ui';
import {
  FolderKanban,
  GitBranch,
  Kanban,
  LayoutDashboard,
  List,
  Plus,
  Search,
  Timeline,
} from 'lucide-react';
import { useState } from 'react';
import { StatusIcon } from './kanban-icons.js';
import type { KanbanCard, KanbanList } from './types.js';

export interface LinearCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  lists: KanbanList[];
  onOpenCard?: (cardId: string) => void;
  onQuickAddTask?: (listId?: string) => void;
  onViewModeChange?: (
    mode: 'board' | 'list' | 'timeline' | 'dashboard' | 'projects',
  ) => void;
  onOpenFilter?: () => void;
  onOpenNewProject?: () => void;
}

export function LinearCommandMenu({
  isOpen,
  onClose,
  lists,
  onOpenCard,
  onQuickAddTask,
  onViewModeChange,
  onOpenFilter,
  onOpenNewProject,
}: LinearCommandMenuProps) {
  const [query, setQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const allCards: Array<{ card: KanbanCard; list: KanbanList }> = [];
  for (const list of lists) {
    for (const card of list.cards) {
      allCards.push({ card, list });
    }
  }

  const needle = query.trim().toLowerCase();

  const ticketOf = (card: KanbanCard) => card.ticketId ?? card.identifier ?? '';

  const matchedCards = allCards.filter(
    ({ card }) =>
      card.title.toLowerCase().includes(needle) ||
      ticketOf(card).toLowerCase().includes(needle) ||
      card.description?.toLowerCase().includes(needle),
  );

  const handleCopyBranch = (ticketId: string, title: string) => {
    const branchName = `git checkout -b ${ticketId.toLowerCase()}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 32)}`;
    navigator.clipboard.writeText(branchName);
    setCopiedText(ticketId);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 max-w-2xl backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl border border-border bg-popover/95">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Top Search Input */}
        <div className="gap-3 px-4 py-3 flex items-center border-b border-border/60 bg-surface/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search issues, projects..."
            className="text-sm flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <Kbd size="xs" variant="muted" className="sm:inline-flex hidden">
            ESC
          </Kbd>
        </div>

        {/* Scrollable Command Items List */}
        <div className="p-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Matched Issues */}
          {matchedCards.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2.5 py-1 font-bold tracking-wider text-meta text-muted-foreground uppercase">
                Issues ({matchedCards.length})
              </div>
              {matchedCards.slice(0, 8).map(({ card, list }) => {
                const ticketId = ticketOf(card);
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      onOpenCard?.(card.id);
                      onClose();
                    }}
                    className="p-2 text-xs group flex cursor-pointer items-center justify-between rounded-xl transition-colors hover:bg-accent/60"
                  >
                    <div className="gap-2.5 min-w-0 flex flex-1 items-center">
                      <StatusIcon status={list.id} className="size-3.5" />
                      <span className="font-semibold shrink-0 font-mono text-meta text-muted-foreground">
                        {ticketId}
                      </span>
                      <span className="font-semibold truncate text-foreground">
                        {card.title}
                      </span>
                    </div>

                    <div className="gap-2 flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyBranch(
                            ticketId || card.id.slice(0, 8),
                            card.title,
                          );
                        }}
                        className="gap-1 p-1 rounded flex items-center text-meta text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                        title="Copy Git branch command"
                      >
                        <GitBranch className="size-3" />
                        <span>
                          {copiedText === ticketId ? 'Copied!' : 'Branch'}
                        </span>
                      </button>

                      <span className="text-2xs text-muted-foreground">
                        {list.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 font-bold tracking-wider text-meta text-muted-foreground uppercase">
              Actions
            </div>

            <button
              type="button"
              onClick={() => {
                onQuickAddTask?.();
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <Plus className="size-4 text-primary" />
                <span className="font-medium text-foreground">
                  Create new issue
                </span>
              </div>
              <KbdShortcut keys={['C']} size="xs" variant="muted" />
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenFilter?.();
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <Search className="size-4 text-primary" />
                <span className="font-medium text-foreground">
                  Filter issues & tasks
                </span>
              </div>
              <KbdShortcut keys={['F']} size="xs" variant="muted" />
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenNewProject?.();
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <FolderKanban className="size-4 text-primary" />
                <span className="font-medium text-foreground">New project</span>
              </div>
            </button>
          </div>

          {/* Switch Views */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 font-bold tracking-wider text-meta text-muted-foreground uppercase">
              Switch View
            </div>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('board');
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <Kanban className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  Kanban Board
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('list');
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <List className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  Task List View
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('timeline');
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <Timeline className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  Timeline Roadmap
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('dashboard');
                onClose();
              }}
              className="p-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors hover:bg-accent/60"
            >
              <div className="gap-2.5 flex items-center">
                <LayoutDashboard className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  Project Insights Dashboard
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 flex items-center justify-between border-t border-border/50 bg-muted/40 text-meta text-muted-foreground">
          <div className="gap-2 flex items-center">
            <span>Navigation:</span>
            <Kbd size="xs" variant="default">
              ↑
            </Kbd>
            <Kbd size="xs" variant="default">
              ↓
            </Kbd>
            <span>Select:</span>
            <Kbd size="xs" variant="default">
              ↵
            </Kbd>
          </div>
          <span>Linear Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
