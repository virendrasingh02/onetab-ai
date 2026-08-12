import { cn } from '@org/utils';
import {
  FolderKanban,
  Kanban,
  LayoutDashboard,
  List,
  Timeline,
} from 'lucide-react';
import { useEffect, useRef, type ComponentType } from 'react';

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
  { id: 'list', label: 'List', icon: List },
  { id: 'board', label: 'Board', icon: Kanban },
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

/**
 * The view switcher.
 *
 * Previously also carried grouping, ordering and a wall of "display property"
 * pills; none of them were read by anything, and several named fields the tasks
 * API does not have (health, lead, labels). Only the switcher survives, because
 * only the switcher ever did anything.
 */
export function ViewDisplayMenu({
  isOpen,
  onClose,
  viewMode,
  onViewModeChange,
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

  return (
    <div
      ref={menuRef}
      className="absolute right-6 top-16 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-popover/95 backdrop-blur-md p-4 text-xs font-sans text-popover-foreground shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-top-2"
    >
      <h4 className="mb-2 text-xs font-semibold text-foreground">View</h4>

      <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 rounded-xl border border-border/50">
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
  );
}
