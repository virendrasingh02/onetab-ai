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
  BarChart3,
  Check,
  ChevronDown,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
              <span className="font-medium">Company Analytics</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to={`/w/${current.slug}/directory`}>
              <span className="flex size-5 items-center justify-center rounded-md border border-border text-subtle">
                <Users className="size-3.5" />
              </span>
              <span className="font-medium">Team Directory</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to={`/w/${current.slug}/invitations`}>
              <span className="flex size-5 items-center justify-center rounded-md border border-border text-subtle">
                <UserPlus className="size-3.5" />
              </span>
              <span className="font-medium">Invite Teammates</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to={`/w/${current.slug}/settings`}>
              <span className="flex size-5 items-center justify-center rounded-md border border-border text-subtle">
                <Settings className="size-3.5" />
              </span>
              <span className="font-medium">Company Settings</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            asChild
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <Link to="/workspaces/new">
              <span className="flex size-5 items-center justify-center rounded-md border border-dashed border-border text-subtle">
                <Plus className="size-3.5" />
              </span>
              <span className="font-medium">Create New Workspace</span>
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


