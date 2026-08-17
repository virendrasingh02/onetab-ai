import type { WorkspaceSummary } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  WorkspaceAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Plus,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface WorkspaceMenuProps {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
  onToggleSidebar?: () => void;
}

export function WorkspaceMenu({
  workspaces,
  current,
  onToggleSidebar,
}: WorkspaceMenuProps) {
  const navigate = useNavigate();

  return (
    <div className="group/workspace-header gap-1 flex w-full items-center justify-between">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'group/trigger gap-2 px-2 py-1.5 flex flex-1 items-center rounded-btn text-left',
              'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <WorkspaceAvatar
              name={current.name}
              src={current.avatarUrl}
              icon={current.icon}
              iconColor={current.iconColor}
              seed={current.id}
              size="sm"
            />

            <span className="min-w-0 gap-1.5 flex flex-1 items-center">
              <span className="font-semibold tracking-tight text-base truncate text-foreground">
                {current.name}
              </span>
              <ChevronDown
                className="size-3.5 shrink-0 text-subtle transition-colors duration-(--duration-fast) group-hover/trigger:text-foreground"
                aria-hidden
              />
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-64 p-1.5"
        >
          <DropdownMenuLabel className="px-2 py-1 font-medium tracking-wide text-[11px] text-subtle uppercase">
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
                    'gap-2.5 text-xs flex cursor-pointer items-center',
                    isSelected && 'font-medium bg-selected text-foreground',
                  )}
                >
                  <Link to={`/w/${workspace.slug}`}>
                    <WorkspaceAvatar
                      name={workspace.name}
                      src={workspace.avatarUrl}
                      icon={workspace.icon}
                      iconColor={workspace.iconColor}
                      seed={workspace.id}
                      size="xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium block truncate">
                        {workspace.name}
                      </span>
                      <span className="block truncate text-[10px] text-subtle">
                        {workspace.memberCount} member
                        {workspace.memberCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="size-4 ml-auto shrink-0 text-primary" />
                    ) : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            asChild
            className="gap-2 text-xs flex cursor-pointer items-center"
          >
            <Link to={`/w/${current.slug}/analytics`}>
              <span className="size-5 flex items-center justify-center rounded-md border border-border text-subtle">
                <BarChart3 className="size-3.5" />
              </span>
              <span className="font-medium">Company Analytics</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="gap-2 text-xs flex cursor-pointer items-center"
          >
            <Link to={`/w/${current.slug}/directory`}>
              <span className="size-5 flex items-center justify-center rounded-md border border-border text-subtle">
                <Users className="size-3.5" />
              </span>
              <span className="font-medium">Team Directory</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="gap-2 text-xs flex cursor-pointer items-center"
          >
            <Link to={`/w/${current.slug}/invitations`}>
              <span className="size-5 flex items-center justify-center rounded-md border border-border text-subtle">
                <UserPlus className="size-3.5" />
              </span>
              <span className="font-medium">Invite Teammates</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="gap-2 text-xs flex cursor-pointer items-center"
          >
            <Link to={`/w/${current.slug}/settings`}>
              <span className="size-5 flex items-center justify-center rounded-md border border-border text-subtle">
                <Settings className="size-3.5" />
              </span>
              <span className="font-medium">Company Settings</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            asChild
            className="gap-2 text-xs flex cursor-pointer items-center"
          >
            <Link to="/workspaces/new">
              <span className="size-5 flex items-center justify-center rounded-md border border-dashed border-border text-subtle">
                <Plus className="size-3.5" />
              </span>
              <span className="font-medium">Create New Workspace</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Navigation controls: toggle the rail, then browser-style back/forward. */}
      <div className="gap-0.5 flex items-center">
        {onToggleSidebar ? (
          <Hint label="Toggle sidebar">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              className="size-7 p-0 opacity-0 transition-opacity duration-(--duration-fast) group-hover/sidebar:opacity-100 group-hover/workspace-header:opacity-100 group-focus-within/sidebar:opacity-100 focus-visible:opacity-100"
            >
              <PanelLeft className="size-4 text-subtle hover:text-foreground" />
            </Button>
          </Hint>
        ) : null}

        <Hint label="Go back">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="size-7 p-0"
          >
            <ChevronLeft className="size-4 text-subtle hover:text-foreground" />
          </Button>
        </Hint>

        <Hint label="Go forward">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(1)}
            aria-label="Go forward"
            className="size-7 p-0"
          >
            <ChevronRight className="size-4 text-subtle hover:text-foreground" />
          </Button>
        </Hint>

        {/*
          A "Recent history" button sat here too, opening the command palette.
          It duplicated the header's search field under a label that promised
          something else, and it was the fourth icon crammed beside the
          workspace name in a 240px rail.
        */}
      </div>
    </div>
  );
}
