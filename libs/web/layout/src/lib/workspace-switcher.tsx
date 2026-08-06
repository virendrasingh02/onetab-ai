import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { avatarTint } from '@org/design-system';
import type { WorkspaceSummary } from '@org/types';
import { cn, initials } from '@org/utils';
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  HardDrive,
  Home,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  current?: WorkspaceSummary;
}

interface RailItem {
  /** Shown under the icon; kept short enough to fit the 60px rail. */
  label: string;
  /** Tooltip text, when the label alone is too terse to be clear. */
  hint?: string;
  path: string;
  icon: LucideIcon;
}

/** Destinations on the far-left rail, in display order. */
const RAIL_ITEMS: readonly RailItem[] = [
  { label: 'Home', path: '', icon: Home },
  { label: 'DMs', hint: 'Direct messages', path: '/dms', icon: MessageSquare },
  { label: 'Pulse', path: '/pulse', icon: Activity },
  { label: 'Files', path: '/files', icon: HardDrive },
  { label: 'Later', hint: 'Later & bookmarks', path: '/docs', icon: Bookmark },
];

const railItemClass = cn(
  'flex size-10 flex-col items-center justify-center rounded-btn text-subtle',
  'transition-colors duration-(--duration-fast) ease-standard',
  'hover:bg-accent hover:text-foreground',
  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

export function WorkspaceSwitcher({
  workspaces,
  current,
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Workspaces rail"
      className="z-(--z-rail) flex w-15 shrink-0 select-none flex-col items-center gap-3 border-r border-border bg-sidebar py-3"
    >
      {/* Workspace Tiles */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === current?.id;
          return (
            <Hint key={workspace.id} label={workspace.name} side="right">
              <Link
                to={`/w/${workspace.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-btn text-xs font-semibold text-primary-foreground',
                  'transition-opacity duration-(--duration-fast) ease-standard',
                  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isActive
                    ? 'opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-sidebar'
                    : 'opacity-65 hover:opacity-100',
                )}
                style={{ backgroundColor: avatarTint(workspace.id) }}
              >
                {workspace.avatarUrl ? (
                  <img
                    src={workspace.avatarUrl}
                    alt=""
                    className="size-full rounded-[inherit] object-cover"
                  />
                ) : (
                  initials(workspace.name)
                )}
              </Link>
            </Hint>
          );
        })}

        <Hint label="Create a workspace" side="right">
          <button
            className={cn(
              'flex size-9 items-center justify-center rounded-btn border border-dashed border-border text-subtle',
              'transition-colors duration-(--duration-fast) ease-standard',
              'hover:border-border-strong hover:text-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            onClick={() => navigate('/workspaces/new')}
            aria-label="Create a workspace"
          >
            <Plus className="size-4" />
          </button>
        </Hint>
      </div>

      <div className="my-1 h-px w-8 shrink-0 bg-border" />

      {/* Rail destinations */}
      <div className="no-scrollbar flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
        {RAIL_ITEMS.map(({ label, hint, icon: Icon, path }) => (
          <Hint key={label} label={hint ?? label} side="right">
            <Link
              to={current ? `/w/${current.slug}${path}` : '/'}
              className={railItemClass}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="mt-0.5 text-[9px] leading-none font-medium">
                {label}
              </span>
            </Link>
          </Hint>
        ))}

        <Hint label="More options" side="right">
          <button className={cn(railItemClass, 'mt-auto')} aria-label="More options">
            <MoreHorizontal className="size-4 shrink-0" aria-hidden />
            <span className="mt-0.5 text-[9px] leading-none font-medium">More</span>
          </button>
        </Hint>
      </div>
    </nav>
  );
}

export interface WorkspaceMenuProps {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function WorkspaceMenu({
  workspaces,
  current,
  onToggleSidebar,
}: WorkspaceMenuProps) {
  return (
    <div className="flex items-center justify-between gap-1 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'group/trigger flex flex-1 items-center gap-2 rounded-btn px-2 py-1.5 text-left',
              'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
              style={{
                backgroundColor: current.avatarUrl
                  ? undefined
                  : avatarTint(current.id),
              }}
            >
              {current.avatarUrl ? (
                <img
                  src={current.avatarUrl}
                  alt=""
                  className="size-full rounded-[inherit] object-cover"
                />
              ) : (
                initials(current.name) || <Sparkles className="size-3.5" />
              )}
            </div>

            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
                {current.name}
              </span>
              <ChevronDown
                className="size-3.5 shrink-0 text-subtle transition-colors duration-(--duration-fast) group-hover/trigger:text-foreground"
                aria-hidden
              />
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={6} className="w-64 p-1.5">
          <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium tracking-wide text-subtle uppercase">
            Switch workspace
          </DropdownMenuLabel>
          <div className="space-y-0.5 my-1">
            {workspaces.map((workspace) => {
              const isSelected = workspace.id === current.id;
              return (
                <DropdownMenuItem
                  key={workspace.id}
                  asChild
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 text-xs',
                    isSelected && 'bg-selected font-medium text-foreground',
                  )}
                >
                  <Link to={`/w/${workspace.slug}`}>
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-primary-foreground"
                      style={{ backgroundColor: avatarTint(workspace.id) }}
                    >
                      {initials(workspace.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {workspace.name}
                      </span>
                      <span className="block truncate text-[10px] text-subtle">
                        {workspace.memberCount} member
                        {workspace.memberCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="ml-auto size-4 shrink-0 text-primary" />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to={`/w/${current.slug}/analytics`}>
              <span className="flex size-5 items-center justify-center rounded-md border border-border text-subtle">
                <BarChart3 className="size-3.5" />
              </span>
              <span className="font-medium">Analytics</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to="/workspaces/new">
              <span className="flex size-5 items-center justify-center rounded-md border border-dashed border-border text-subtle">
                <Plus className="size-3.5" />
              </span>
              <span className="font-medium">Create a workspace</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onToggleSidebar ? (
        <Hint label="Toggle sidebar" side="right">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
        </Hint>
      ) : null}
    </div>
  );
}


