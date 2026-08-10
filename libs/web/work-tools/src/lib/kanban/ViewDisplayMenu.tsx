import { useEffect, useRef } from 'react';
import { Kanban, List, Timeline, LayoutDashboard, ChevronDown } from 'lucide-react';
import { cn } from '@org/utils';

export interface DisplayPropertiesState {
  milestones: boolean;
  summary: boolean;
  priority: boolean;
  status: boolean;
  health: boolean;
  teams: boolean;
  lead: boolean;
  members: boolean;
  dependencies: boolean;
  startDate: boolean;
  targetDate: boolean;
  issues: boolean;
  created: boolean;
  updated: boolean;
  completed: boolean;
  labels: boolean;
}

export interface ViewDisplayMenuProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: 'list' | 'board' | 'timeline' | 'dashboard';
  onViewModeChange: (mode: 'list' | 'board' | 'timeline' | 'dashboard') => void;
  grouping?: string;
  onGroupingChange?: (val: string) => void;
  ordering?: string;
  onOrderingChange?: (val: string) => void;
  showClosed?: string;
  onShowClosedChange?: (val: string) => void;
  displayProps: DisplayPropertiesState;
  onToggleDisplayProp: (propKey: keyof DisplayPropertiesState) => void;
}

export function ViewDisplayMenu({
  isOpen,
  onClose,
  viewMode,
  onViewModeChange,
  grouping = 'no_grouping',
  onGroupingChange,
  ordering = 'manual',
  onOrderingChange,
  showClosed = 'all',
  onShowClosedChange,
  displayProps,
  onToggleDisplayProp,
}: ViewDisplayMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
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

  if (!isOpen) return null;

  const displayPropList: Array<{ key: keyof DisplayPropertiesState; label: string }> = [
    { key: 'milestones', label: 'Milestones' },
    { key: 'summary', label: 'Summary' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'health', label: 'Health' },
    { key: 'teams', label: 'Teams' },
    { key: 'lead', label: 'Lead' },
    { key: 'members', label: 'Members' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'startDate', label: 'Start date' },
    { key: 'targetDate', label: 'Target date' },
    { key: 'issues', label: 'Issues' },
    { key: 'created', label: 'Created' },
    { key: 'updated', label: 'Updated' },
    { key: 'completed', label: 'Completed' },
    { key: 'labels', label: 'Labels' },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute right-6 top-16 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-popover/95 backdrop-blur-md p-4 text-xs font-sans text-popover-foreground shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-2'
      )}
    >
      {/* 1. View Mode Switcher Pills */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 mb-4">
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-[11px]',
            viewMode === 'list'
              ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          )}
        >
          <List className="size-3 shrink-0" />
          <span>List</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('board')}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-[11px]',
            viewMode === 'board'
              ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          )}
        >
          <Kanban className="size-3 shrink-0" />
          <span>Board</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('timeline')}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-[11px]',
            viewMode === 'timeline'
              ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          )}
        >
          <Timeline className="size-3 shrink-0" />
          <span>Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('dashboard')}
          className={cn(
            'flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-[11px]',
            viewMode === 'dashboard'
              ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          )}
        >
          <LayoutDashboard className="size-3 shrink-0" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* 2. Grouping, Ordering & Show Closed Controls */}
      <div className="space-y-3 border-b border-border/50 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Grouping</span>
          <div className="relative">
            <select
              value={grouping}
              onChange={(e) => onGroupingChange?.(e.target.value)}
              className="appearance-none bg-muted/50 border border-border/60 rounded-lg pl-3 pr-7 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="no_grouping">No grouping</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
              <option value="assignee">Assignee</option>
            </select>
            <ChevronDown className="size-3 text-muted-foreground absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Ordering</span>
          <div className="relative">
            <select
              value={ordering}
              onChange={(e) => onOrderingChange?.(e.target.value)}
              className="appearance-none bg-muted/50 border border-border/60 rounded-lg pl-3 pr-7 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="manual">Manual</option>
              <option value="due_date">Due date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
            <ChevronDown className="size-3 text-muted-foreground absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Show closed projects</span>
          <div className="relative">
            <select
              value={showClosed}
              onChange={(e) => onShowClosedChange?.(e.target.value)}
              className="appearance-none bg-muted/50 border border-border/60 rounded-lg pl-3 pr-7 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="closed">Closed only</option>
            </select>
            <ChevronDown className="size-3 text-muted-foreground absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 3. List options / Display properties Pill Section */}
      <div>
        <h4 className="text-xs font-semibold text-foreground mb-1">List options</h4>
        <p className="text-[11px] text-muted-foreground mb-3">Display properties</p>

        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
          {displayPropList.map((item) => {
            const isSelected = displayProps[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleDisplayProp(item.key)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer select-none',
                  isSelected
                    ? 'bg-muted text-foreground font-semibold border-border shadow-xs'
                    : 'bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:bg-accent/40'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
