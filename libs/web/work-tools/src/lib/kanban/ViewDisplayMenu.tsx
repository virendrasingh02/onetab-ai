import {
  AppSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@org/ui';
import {
  FileText,
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
  Target,
  Timeline,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import {
  CARD_PROPERTY_LABELS,
  useKanbanDisplayStore,
  type BoardOrder,
  type CardProperties,
} from './kanban-display-store.js';

export type ProjectViewMode =
  | 'list'
  | 'board'
  | 'spreadsheet'
  | 'timeline'
  | 'gantt'
  | 'dashboard'
  | 'docs'
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
  { id: 'timeline', label: 'Timeline', icon: Timeline },
  { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
  { id: 'docs', label: 'Docs', icon: FileText },
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}

const ORDER_OPTIONS: Array<{ value: BoardOrder; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'priority', label: 'Priority' },
  { value: 'due', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'created', label: 'Newest first' },
];

/** Board and list display options. They apply to this viewer only. */
export function ViewDisplayMenu({
  open,
  onOpenChange,
  trigger,
}: ViewDisplayMenuProps) {
  const orderBy = useKanbanDisplayStore((state) => state.orderBy);
  const setOrderBy = useKanbanDisplayStore((state) => state.setOrderBy);
  const card = useKanbanDisplayStore((state) => state.card);
  const toggleCardProperty = useKanbanDisplayStore(
    (state) => state.toggleCardProperty,
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3 text-xs">
        <div className="space-y-1.5">
          <div className="gap-3 flex items-center justify-between">
            <span className="font-medium text-foreground">Order by</span>
            <AppSelect
              size="sm"
              className="w-36"
              value={orderBy}
              onValueChange={(value) => setOrderBy(value as BoardOrder)}
              aria-label="Order by"
              options={ORDER_OPTIONS}
            />
          </div>
          {orderBy !== 'manual' ? (
            <p className="text-[11px] text-muted-foreground">
              Only changes your view. The team's manual order is kept.
            </p>
          ) : null}
        </div>

        <div className="space-y-1 pt-3 border-t border-border/60">
          <p className="mb-1.5 font-medium text-foreground">Show on cards</p>
          {(
            Object.keys(CARD_PROPERTY_LABELS) as Array<keyof CardProperties>
          ).map((key) => (
            <label
              key={key}
              className="gap-3 py-1 flex cursor-pointer items-center justify-between rounded-md text-muted-foreground hover:text-foreground"
            >
              <span>{CARD_PROPERTY_LABELS[key]}</span>
              <Switch
                checked={card[key]}
                onCheckedChange={() => toggleCardProperty(key)}
                aria-label={CARD_PROPERTY_LABELS[key]}
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
