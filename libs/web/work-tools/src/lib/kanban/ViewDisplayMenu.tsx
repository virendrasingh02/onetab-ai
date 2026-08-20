import { cn } from '@org/utils';
import {
  FolderKanban,
  Kanban,
  LayoutDashboard,
  List,
  Timeline,
} from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';

export type ProjectViewMode =
  | 'list'
  | 'board'
  | 'timeline'
  | 'dashboard'
  | 'projects';

const VIEW_MODES: Array<{
  id: ProjectViewMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'list', label: 'List', icon: List },
  { id: 'timeline', label: 'Timeline', icon: Timeline },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
];

export interface ViewDisplayMenuProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ProjectViewMode;
  onViewModeChange: (mode: ProjectViewMode) => void;
}

export function ViewDisplayMenu({
  isOpen,
  onClose,
  viewMode,
  onViewModeChange,
}: ViewDisplayMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [groupBy, setGroupBy] = useState<'status' | 'priority' | 'assignee'>('status');
  const [orderBy, setOrderBy] = useState<'manual' | 'priority' | 'due' | 'created'>('manual');

  // Display toggles state
  const [displayProps, setDisplayProps] = useState({
    showTicketId: true,
    showPriority: true,
    showDueDate: true,
    showAssignee: true,
    showLabels: true,
    showSubtasks: true,
  });

  const toggleProp = (key: keyof typeof displayProps) => {
    setDisplayProps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  return (
    <div
      ref={menuRef}
      className="absolute right-6 top-14 z-50 w-80 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl p-4 text-xs font-sans text-popover-foreground shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-2 space-y-4"
    >
      {/* View Switcher Grid */}
      <div>
        <h4 className="mb-2 text-xs font-bold text-foreground uppercase tracking-wider">
          Layout View
        </h4>
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-xl border border-border/50">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onViewModeChange(mode.id);
                  onClose();
                }}
                aria-pressed={viewMode === mode.id}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-[11px]',
                  viewMode === mode.id
                    ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                )}
              >
                <Icon className="size-3 shrink-0" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouping & Ordering */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50">
        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
            Group by
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="w-full h-7 rounded-lg border border-border bg-surface text-xs text-foreground px-2 outline-none"
          >
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
            Sort by
          </label>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as any)}
            className="w-full h-7 rounded-lg border border-border bg-surface text-xs text-foreground px-2 outline-none"
          >
            <option value="manual">Manual</option>
            <option value="priority">Priority</option>
            <option value="due">Due Date</option>
            <option value="created">Created Date</option>
          </select>
        </div>
      </div>

      {/* Display Properties Checklist */}
      <div className="pt-2 border-t border-border/50 space-y-1.5">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          Display Properties
        </h4>
        <div className="space-y-1 text-xs">
          {[
            { key: 'showTicketId', label: 'Ticket Identifier' },
            { key: 'showPriority', label: 'Priority Icon' },
            { key: 'showDueDate', label: 'Due Date Badge' },
            { key: 'showAssignee', label: 'Assignee Avatar' },
            { key: 'showLabels', label: 'Tags & Labels' },
            { key: 'showSubtasks', label: 'Subtask Progress' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-1 rounded-lg hover:bg-accent/40 cursor-pointer text-foreground select-none"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={displayProps[item.key as keyof typeof displayProps]}
                onChange={() => toggleProp(item.key as keyof typeof displayProps)}
                className="rounded border-border size-3.5 text-primary focus:ring-0 cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
