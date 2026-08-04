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
import { Check, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  current?: WorkspaceSummary;
}

/**
 * Vertical rail of workspace tiles, plus a menu on the active tile.
 *
 * The rail is the outermost navigation level, so it stays visible at every
 * route inside a workspace.
 */
export function WorkspaceSwitcher({
  workspaces,
  current,
}: WorkspaceSwitcherProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Workspaces"
      className="gap-1.5 py-3 flex w-[68px] shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar"
    >
      {workspaces.map((workspace) => {
        const isActive = workspace.id === current?.id;
        return (
          <Hint key={workspace.id} label={workspace.name} side="right">
            <Link
              to={`/w/${workspace.slug}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'size-10 text-sm font-semibold text-white relative flex items-center justify-center rounded-xl transition-all',
                'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                isActive
                  ? 'rounded-lg ring-2 ring-sidebar-accent-foreground'
                  : 'opacity-80 hover:rounded-lg hover:opacity-100',
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
              {/* Active indicator pip on the rail edge. */}
              {isActive ? (
                <span
                  aria-hidden
                  className="-left-3 h-6 w-1 absolute rounded-r-full bg-sidebar-accent-foreground"
                />
              ) : null}
            </Link>
          </Hint>
        );
      })}

      <Hint label="Create a workspace" side="right">
        <Button
          variant="sidebar"
          size="icon"
          className="mt-1 size-10 rounded-xl border border-dashed border-sidebar-border"
          onClick={() => navigate('/workspaces/new')}
          aria-label="Create a workspace"
        >
          <Plus />
        </Button>
      </Hint>
    </nav>
  );
}

export interface WorkspaceMenuProps {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
}

/** Name + role header at the top of the sidebar, with a switch menu. */
export function WorkspaceMenu({ workspaces, current }: WorkspaceMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'gap-2 px-2 py-1.5 flex w-full items-center rounded-md text-left transition-colors hover:bg-sidebar-accent',
            'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="text-sm font-semibold block truncate text-sidebar-accent-foreground">
              {current.name}
            </span>
            <span className="text-xs block truncate text-sidebar-muted">
              {current.memberCount} member{current.memberCount === 1 ? '' : 's'}
              {' · '}
              {current.role.toLowerCase()}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} asChild>
            <Link to={`/w/${workspace.slug}`}>
              <span
                aria-hidden
                className="size-5 rounded font-semibold text-white flex items-center justify-center text-[10px]"
                style={{ backgroundColor: avatarTint(workspace.id) }}
              >
                {initials(workspace.name)}
              </span>
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === current.id ? (
                <Check className="size-4" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/workspaces/new">
            <Plus />
            Create a workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
