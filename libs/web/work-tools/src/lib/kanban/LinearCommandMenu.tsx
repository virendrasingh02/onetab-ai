import { type TaskStatus } from '@org/types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@org/ui';
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
import { useKanbanCustomStore } from './kanban-custom-store.js';
import { StatusIcon } from './kanban-icons.js';
import type { KanbanCard, KanbanList } from './types.js';

export interface LinearCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  lists: KanbanList[];
  onOpenCard?: (cardId: string) => void;
  onQuickAddTask?: (listId?: TaskStatus) => void;
  onViewModeChange?: (mode: 'board' | 'list' | 'timeline' | 'dashboard' | 'projects') => void;
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
  const customStore = useKanbanCustomStore();

  const allCards: Array<{ card: KanbanCard; list: KanbanList }> = [];
  for (const list of lists) {
    for (const card of list.cards) {
      allCards.push({ card, list });
    }
  }

  const needle = query.trim().toLowerCase();

  const matchedCards = allCards.filter(({ card }) => {
    const customProps = customStore.getCardProperties(card.id);
    return (
      card.title.toLowerCase().includes(needle) ||
      (customProps.ticketId ?? '').toLowerCase().includes(needle) ||
      card.description?.toLowerCase().includes(needle)
    );
  });

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
      <DialogContent className="p-0 max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Top Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-surface/40">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search issues, projects..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Scrollable Command Items List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* Matched Issues */}
          {matchedCards.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Issues ({matchedCards.length})
              </div>
              {matchedCards.slice(0, 8).map(({ card, list }) => {
                const props = customStore.getCardProperties(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      onOpenCard?.(card.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <StatusIcon status={list.id} className="size-3.5" />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0">
                        {props.ticketId}
                      </span>
                      <span className="font-semibold text-foreground truncate">
                        {card.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyBranch(props.ticketId || 'DES', card.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                        title="Copy Git branch command"
                      >
                        <GitBranch className="size-3" />
                        <span>{copiedText === props.ticketId ? 'Copied!' : 'Branch'}</span>
                      </button>

                      <span className="text-[10px] text-muted-foreground">
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
            <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Actions
            </div>

            <button
              type="button"
              onClick={() => {
                onQuickAddTask?.();
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="size-4 text-primary" />
                <span className="font-medium text-foreground">Create new issue</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
                C
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenFilter?.();
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Search className="size-4 text-primary" />
                <span className="font-medium text-foreground">Filter issues & tasks</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
                F
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => {
                onOpenNewProject?.();
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <FolderKanban className="size-4 text-primary" />
                <span className="font-medium text-foreground">New project</span>
              </div>
            </button>
          </div>

          {/* Switch Views */}
          <div className="space-y-0.5">
            <div className="px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Switch View
            </div>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('board');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Kanban className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Kanban Board</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('list');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <List className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Task List View</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('timeline');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Timeline className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Timeline Roadmap</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewModeChange?.('dashboard');
                onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs hover:bg-accent/60 cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Project Insights Dashboard</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-muted/40 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1 py-0.2 rounded border bg-surface text-[10px]">↑</kbd>
            <kbd className="px-1 py-0.2 rounded border bg-surface text-[10px]">↓</kbd>
            <span>Select:</span>
            <kbd className="px-1 py-0.2 rounded border bg-surface text-[10px]">↵</kbd>
          </div>
          <span>Linear Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
