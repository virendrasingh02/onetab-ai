import { cn } from '@org/utils';
import {
  FolderGit2,
  FolderKanban,
  FolderOpen,
  GanttChartSquare,
  HeartPulse,
  Inbox,
  Kanban,
  LayoutDashboard,
  List,
  RotateCw,
  Settings,
  Table,
  Target,
  Timeline,
} from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';

export type ProjectViewMode =
  | 'list'
  | 'board'
  | 'spreadsheet'
  | 'timeline'
  | 'gantt'
  | 'dashboard'
  | 'cycles'
  | 'modules'
  | 'initiatives'
  | 'intake'
  | 'updates'
  | 'files'
  | 'settings'
  | 'projects';

export const VIEW_MODES: Array<{
  id: ProjectViewMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'board', label: 'Board', icon: Kanban },
  { id: 'list', label: 'List', icon: List },
  { id: 'spreadsheet', label: 'Table', icon: Table },
  { id: 'timeline', label: 'Timeline', icon: Timeline },
  { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
  { id: 'cycles', label: 'Cycles', icon: RotateCw },
  { id: 'modules', label: 'Modules', icon: FolderGit2 },
  { id: 'initiatives', label: 'Initiatives', icon: Target },
  { id: 'intake', label: 'Intake', icon: Inbox },
  { id: 'updates', label: 'Updates', icon: HeartPulse },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
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
      className="absolute right-6 top-14 z-50 w-80 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl p-4 text-xs font-sans text-popover-foreground shadow-2xl transition-all duration-200 space-y-4"
    >
      {/* View Switcher Grid */}
      <div>
        <h4 className="mb-2 text-xs font-bold text-foreground uppercase tracking-wider">
          Layout View
        </h4>
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-xl border border-border/50">
          {VIEW_MODES.slice(0, 9).map((mode) => {
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
                  'flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg text-[11px] font-semibold transition-all duration-150',
                  viewMode === mode.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouping and Sorting Options */}
      <div className="space-y-3 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Group By</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="bg-muted/60 border border-border/80 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Order By</span>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value as any)}
            className="bg-muted/60 border border-border/80 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="manual">Manual</option>
            <option value="priority">Priority</option>
            <option value="due">Due Date</option>
            <option value="created">Created</option>
          </select>
        </div>
      </div>

      {/* Property Display Toggles */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
          Card Properties
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(displayProps).map(([key, isEnabled]) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground"
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleProp(key as keyof typeof displayProps)}
                className="size-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer"
              />
              <span className="capitalize">{key.replace('show', '')}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
