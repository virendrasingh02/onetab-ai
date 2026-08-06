import {
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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  current?: WorkspaceSummary;
}

export function WorkspaceSwitcher({
  workspaces,
  current,
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Workspaces rail"
      className="gap-3 py-3 flex w-[60px] shrink-0 flex-col items-center border-r border-zinc-200/80 dark:border-zinc-800 bg-zinc-900 dark:bg-[#09090B] text-white z-20 select-none"
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
                  'size-9 text-xs font-bold relative flex items-center justify-center rounded-xl transition-all duration-150 shadow-xs',
                  isActive
                    ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-900 scale-105'
                    : 'opacity-70 hover:opacity-100 hover:scale-105',
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
            className="size-9 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 flex items-center justify-center transition-colors"
            onClick={() => navigate('/workspaces/new')}
            aria-label="Create a workspace"
          >
            <Plus className="size-4" />
          </button>
        </Hint>
      </div>

      <div className="w-8 h-px bg-zinc-800 my-1 shrink-0" />

      {/* Rail Nav Items matching Screenshot 2 */}
      <div className="flex flex-col items-center gap-2 flex-1 w-full px-1 overflow-y-auto no-scrollbar">
        <Hint label="Home" side="right">
          <Link
            to={current ? `/w/${current.slug}` : '/'}
            className="size-10 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <Home className="size-4 shrink-0" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">Home</span>
          </Link>
        </Hint>

        <Hint label="Direct Messages" side="right">
          <Link
            to={current ? `/w/${current.slug}/dms` : '/'}
            className="size-10 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <MessageSquare className="size-4 shrink-0" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">DMs</span>
          </Link>
        </Hint>

        <Hint label="Activity" side="right">
          <Link
            to={current ? `/w/${current.slug}/activity` : '/'}
            className="size-10 rounded-xl relative flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <Bell className="size-4 shrink-0" />
            <span className="top-1.5 right-2 size-2 absolute rounded-full bg-rose-500 ring-2 ring-zinc-900" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">Activity</span>
          </Link>
        </Hint>

        <Hint label="Files" side="right">
          <Link
            to={current ? `/w/${current.slug}/files` : '/'}
            className="size-10 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <HardDrive className="size-4 shrink-0" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">Files</span>
          </Link>
        </Hint>

        <Hint label="Later & Bookmarks" side="right">
          <Link
            to={current ? `/w/${current.slug}/docs` : '/'}
            className="size-10 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <Bookmark className="size-4 shrink-0" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">Later</span>
          </Link>
        </Hint>

        <Hint label="More Options" side="right">
          <button
            className="size-10 rounded-xl mt-auto flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors group"
          >
            <MoreHorizontal className="size-4 shrink-0" />
            <span className="text-[9px] font-medium mt-0.5 scale-90 leading-none">More</span>
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
              'group/trigger gap-2 px-2 py-1.5 flex flex-1 items-center rounded-lg text-left transition-colors duration-150',
              'hover:bg-black/5 dark:hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none',
            )}
          >
            <div
              className="size-6 rounded-md text-[11px] font-bold text-white flex shrink-0 items-center justify-center shadow-xs bg-gradient-to-br from-indigo-500 to-purple-600"
              style={{
                backgroundColor: current.avatarUrl ? undefined : avatarTint(current.id),
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

            <span className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100 tracking-tight">
                {current.name}
              </span>
              <ChevronDown className="size-3.5 text-zinc-400 dark:text-zinc-500 shrink-0 group-hover/trigger:text-zinc-600 dark:group-hover/trigger:text-zinc-300 transition-colors" />
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-lg z-50"
        >
          <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
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
                    'px-2 py-1.5 rounded-md text-xs cursor-pointer flex items-center gap-2.5 transition-colors',
                    isSelected
                      ? 'bg-zinc-100 dark:bg-zinc-800/80 font-medium text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
                  )}
                >
                  <Link to={`/w/${workspace.slug}`}>
                    <span
                      aria-hidden
                      className="size-5 rounded-md font-semibold text-white flex items-center justify-center text-[10px] shrink-0"
                      style={{ backgroundColor: avatarTint(workspace.id) }}
                    >
                      {initials(workspace.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{workspace.name}</div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                        {workspace.memberCount} member{workspace.memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    {isSelected ? (
                      <Check className="size-4 text-indigo-600 dark:text-indigo-400 ml-auto shrink-0" />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator className="my-1 bg-zinc-200 dark:bg-zinc-800" />
          
          <DropdownMenuItem
            asChild
            className="px-2 py-1.5 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center gap-2"
          >
            <Link to="/workspaces/new">
              <div className="size-5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-500">
                <Plus className="size-3.5" />
              </div>
              <span className="font-medium">Create a workspace</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onToggleSidebar ? (
        <Hint label="Toggle sidebar" side="right">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:outline-none"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
        </Hint>
      ) : null}
    </div>
  );
}


