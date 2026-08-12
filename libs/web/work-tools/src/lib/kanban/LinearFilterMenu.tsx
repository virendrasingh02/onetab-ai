import { TASK_STATUS_ORDER, type TaskStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  Calendar,
  Check,
  ChevronRight,
  CircleDot,
  Diamond,
  Search,
  Signal,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { STATUS_TITLES } from './server-board.js';
import type { BoardFilter, DueFilter } from './card-meta.js';
import type { BoardMember, Priority } from './types.js';

export interface LinearFilterMenuProps {
  filter: BoardFilter;
  setFilter: React.Dispatch<React.SetStateAction<BoardFilter>>;
  members: BoardMember[];
  /** Milestone titles on the open project. */
  milestones: string[];
  isOpen: boolean;
  onClose: () => void;
  onActivateAIFilter: () => void;
}

export function LinearFilterMenu({
  filter,
  setFilter,
  members,
  milestones,
  isOpen,
  onClose,
  onActivateAIFilter,
}: LinearFilterMenuProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Keyboard shortcut listener ('F' key)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const toggleStatus = (status: TaskStatus) => {
    setFilter((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  };

  const togglePriority = (p: Priority) => {
    setFilter((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(p)
        ? prev.priorities.filter((item) => item !== p)
        : [...prev.priorities, p],
    }));
  };

  const toggleMember = (id: string) => {
    setFilter((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((m) => m !== id)
        : [...prev.memberIds, id],
    }));
  };

  const toggleMilestone = (title: string) => {
    setFilter((prev) => ({
      ...prev,
      milestones: prev.milestones.includes(title)
        ? prev.milestones.filter((item) => item !== title)
        : [...prev.milestones, title],
    }));
  };

  const setDue = (d: DueFilter) => {
    setFilter((prev) => ({ ...prev, due: prev.due === d ? 'any' : d }));
  };

  /*
   * Only facets the tasks API stores. A filter the server cannot honour would
   * hide cards on a rule nothing else in the product knows about.
   */
  const filterCategories = [
    {
      id: 'status',
      label: 'Status',
      icon: CircleDot,
      activeCount: filter.status.length,
    },
    {
      id: 'priority',
      label: 'Priority',
      icon: Signal,
      activeCount: filter.priorities.length,
    },
    {
      id: 'assignee',
      label: 'Assignee',
      icon: Users,
      activeCount: filter.memberIds.length,
    },
    {
      id: 'dates',
      label: 'Dates',
      icon: Calendar,
      activeCount: filter.due !== 'any' ? 1 : 0,
    },
    {
      id: 'milestones',
      label: 'Milestones',
      icon: Diamond,
      activeCount: filter.milestones.length,
    },
  ];

  const filteredCategories = filterCategories.filter((cat) =>
    cat.label.toLowerCase().includes(menuSearch.toLowerCase()),
  );

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute right-4 top-14 z-50 w-72 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-xs font-sans text-popover-foreground transition-all duration-200 animate-in fade-in slide-in-from-top-2',
      )}
    >
      {/* Search Header */}
      <div className="relative mb-1 px-1.5 py-1">
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Add Filter..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            autoFocus
          />
          <kbd className="shrink-0 pointer-events-none inline-flex h-4 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono font-medium text-muted-foreground">
            F
          </kbd>
        </div>
      </div>

      <div className="space-y-0.5 px-1">
        <button
          onClick={() => {
            onActivateAIFilter();
            onClose();
          }}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-3.5 shrink-0 text-accent-violet" />
            <span>Ask AI to filter</span>
          </div>
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </button>
      </div>

      <div className="my-1.5 border-t border-border/50" />

      {/* Filter Categories List */}
      <div className="max-h-64 overflow-y-auto no-scrollbar space-y-0.5 px-1">
        {filteredCategories.map((cat) => {
          const IconComponent = cat.icon;
          const isSubOpen = activeSubMenu === cat.id;

          return (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => setActiveSubMenu(isSubOpen ? null : cat.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  (isSubOpen || cat.activeCount > 0) &&
                    'bg-accent/60 font-medium text-foreground',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent className="size-3.5 text-muted-foreground/80 shrink-0" />
                  <span>{cat.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {cat.activeCount > 0 && (
                    <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                      {cat.activeCount}
                    </span>
                  )}
                  <ChevronRight className="size-3 text-muted-foreground/60 transition-transform duration-150" />
                </div>
              </button>

              {/* Submenu Dropdown Popover */}
              {isSubOpen && (
                <div className="mt-1 ml-4 rounded-lg border border-border/80 bg-surface/95 p-1.5 shadow-lg space-y-0.5 text-xs animate-in fade-in">
                  {cat.id === 'status' &&
                    TASK_STATUS_ORDER.map((status) => (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span>{STATUS_TITLES[status]}</span>
                        {filter.status.includes(status) && (
                          <Check className="size-3 text-primary" />
                        )}
                      </button>
                    ))}

                  {cat.id === 'priority' &&
                    (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePriority(p)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span className="capitalize">{p.toLowerCase()}</span>
                        {filter.priorities.includes(p) && (
                          <Check className="size-3 text-primary" />
                        )}
                      </button>
                    ))}

                  {cat.id === 'assignee' &&
                    (members.length === 0 ? (
                      <p className="px-2 py-1 text-muted-foreground">
                        No workspace members
                      </p>
                    ) : (
                      members.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => toggleMember(m.id)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                        >
                          <span>{m.name}</span>
                          {filter.memberIds.includes(m.id) && (
                            <Check className="size-3 text-primary" />
                          )}
                        </button>
                      ))
                    ))}

                  {cat.id === 'dates' && (
                    <React.Fragment>
                      {(['today', 'overdue', 'week', 'none'] as DueFilter[]).map(
                        (d) => (
                          <button
                            key={d}
                            onClick={() => setDue(d)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                          >
                            <span className="capitalize">
                              {d === 'none' ? 'No due date' : d}
                            </span>
                            {filter.due === d && (
                              <Check className="size-3 text-primary" />
                            )}
                          </button>
                        ),
                      )}
                    </React.Fragment>
                  )}

                  {cat.id === 'milestones' &&
                    (milestones.length === 0 ? (
                      <p className="px-2 py-1 text-muted-foreground">
                        This project has no milestones
                      </p>
                    ) : (
                      milestones.map((ms) => (
                        <button
                          key={ms}
                          onClick={() => toggleMilestone(ms)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                        >
                          <span>{ms}</span>
                          {filter.milestones.includes(ms) && (
                            <Check className="size-3 text-primary" />
                          )}
                        </button>
                      ))
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
