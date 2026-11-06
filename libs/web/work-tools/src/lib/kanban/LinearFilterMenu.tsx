import { TASK_STATUS_ORDER, type TaskStatus } from '@org/types';
import { KbdShortcut } from '@org/ui';
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
        'right-4 top-14 w-72 backdrop-blur-md shadow-2xl p-1.5 text-xs absolute z-50 rounded-xl border border-border bg-popover/95 font-sans text-popover-foreground transition-all duration-200',
      )}
    >
      {/* Search Header */}
      <div className="mb-1 px-1.5 py-1 relative">
        <div className="gap-2 px-2 py-1.5 flex items-center rounded-md border border-border/60 bg-muted/40 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/20">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Add Filter..."
            className="text-xs w-full bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            autoFocus
          />
          <KbdShortcut
            keys={['F']}
            size="xs"
            variant="muted"
            className="pointer-events-none shrink-0"
          />
        </div>
      </div>

      <div className="space-y-0.5 px-1">
        <button
          onClick={() => {
            onActivateAIFilter();
            onClose();
          }}
          className="px-2.5 py-1.5 text-xs font-medium flex w-full items-center justify-between rounded-lg text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <div className="gap-2.5 flex items-center">
            <Sparkles className="size-3.5 shrink-0 text-accent-violet" />
            <span>Smart filter</span>
          </div>
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </button>
      </div>

      <div className="my-1.5 border-t border-border/50" />

      {/* Filter Categories List */}
      <div className="max-h-64 space-y-0.5 px-1 no-scrollbar overflow-y-auto">
        {filteredCategories.map((cat) => {
          const IconComponent = cat.icon;
          const isSubOpen = activeSubMenu === cat.id;

          return (
            <div key={cat.id} className="group relative">
              <button
                onClick={() => setActiveSubMenu(isSubOpen ? null : cat.id)}
                className={cn(
                  'px-2.5 py-1.5 text-xs flex w-full items-center justify-between rounded-lg text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  (isSubOpen || cat.activeCount > 0) &&
                    'font-medium bg-accent/60 text-foreground',
                )}
              >
                <div className="gap-2.5 flex items-center">
                  <IconComponent className="size-3.5 shrink-0 text-muted-foreground/80" />
                  <span>{cat.label}</span>
                </div>

                <div className="gap-1 flex items-center">
                  {cat.activeCount > 0 && (
                    <span className="px-1.5 py-0.2 font-semibold rounded-full bg-brand/20 text-[10px] text-brand-text">
                      {cat.activeCount}
                    </span>
                  )}
                  <ChevronRight className="size-3 text-muted-foreground/60 transition-transform duration-150" />
                </div>
              </button>

              {/* Submenu Dropdown Popover */}
              {isSubOpen && (
                <div className="mt-1 ml-4 p-1.5 space-y-0.5 text-xs rounded-lg border border-border/80 bg-surface/95 shadow-lg">
                  {cat.id === 'status' &&
                    TASK_STATUS_ORDER.map((status) => (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className="px-2 py-1 text-xs flex w-full items-center justify-between rounded-md text-left hover:bg-accent hover:text-foreground"
                      >
                        <span>{STATUS_TITLES[status]}</span>
                        {filter.status.includes(status) && (
                          <Check className="size-3 text-primary" />
                        )}
                      </button>
                    ))}

                  {cat.id === 'priority' &&
                    (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => togglePriority(p)}
                          className="px-2 py-1 text-xs flex w-full items-center justify-between rounded-md text-left hover:bg-accent hover:text-foreground"
                        >
                          <span className="capitalize">{p.toLowerCase()}</span>
                          {filter.priorities.includes(p) && (
                            <Check className="size-3 text-primary" />
                          )}
                        </button>
                      ),
                    )}

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
                          className="px-2 py-1 text-xs flex w-full items-center justify-between rounded-md text-left hover:bg-accent hover:text-foreground"
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
                      {(
                        ['today', 'overdue', 'week', 'none'] as DueFilter[]
                      ).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDue(d)}
                          className="px-2 py-1 text-xs flex w-full items-center justify-between rounded-md text-left hover:bg-accent hover:text-foreground"
                        >
                          <span className="capitalize">
                            {d === 'none' ? 'No due date' : d}
                          </span>
                          {filter.due === d && (
                            <Check className="size-3 text-primary" />
                          )}
                        </button>
                      ))}
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
                          className="px-2 py-1 text-xs flex w-full items-center justify-between rounded-md text-left hover:bg-accent hover:text-foreground"
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
