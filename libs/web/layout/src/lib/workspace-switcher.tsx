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
      className="gap-2 py-3 flex w-[56px] shrink-0 flex-col items-center border-r border-[#27272A] bg-[#09090B]"
    >
      {workspaces.map((workspace) => {
        const isActive = workspace.id === current?.id;
        return (
          <Hint key={workspace.id} label={workspace.name} side="right">
            <Link
              to={`/w/${workspace.slug}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'size-8 text-xs font-semibold text-[#FAFAFA] relative flex items-center justify-center rounded-[8px] transition-all duration-[120ms]',
                'focus-visible:ring-1 focus-visible:ring-[#6E56CF] focus-visible:outline-none',
                isActive
                  ? 'bg-[#1E1F23] ring-1 ring-[#6E56CF]'
                  : 'opacity-65 hover:opacity-100 hover:bg-[#1E1F23]/60',
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
              {isActive ? (
                <span
                  aria-hidden
                  className="-left-2 h-4 w-1 absolute rounded-r-full bg-[#6E56CF]"
                />
              ) : null}
            </Link>
          </Hint>
        );
      })}

      <Hint label="Create a workspace" side="right">
        <Button
          variant="ghost"
          size="icon-sm"
          className="mt-1 size-8 rounded-[8px] border border-dashed border-[#27272A] text-[#71717A] hover:text-[#FAFAFA]"
          onClick={() => navigate('/workspaces/new')}
          aria-label="Create a workspace"
        >
          <Plus className="size-3.5" />
        </Button>
      </Hint>
    </nav>
  );
}

export interface WorkspaceMenuProps {
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
}

export function WorkspaceMenu({ workspaces, current }: WorkspaceMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'gap-2 px-2 py-1 flex w-full items-center rounded-[6px] text-left transition-colors duration-[120ms] hover:bg-[#1E1F23]',
            'focus-visible:ring-1 focus-visible:ring-[#6E56CF] focus-visible:outline-none',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="text-xs font-semibold block truncate text-[#FAFAFA] tracking-tight">
              {current.name}
            </span>
            <span className="text-[11px] block truncate text-[#71717A]">
              {current.memberCount} member{current.memberCount === 1 ? '' : 's'}
              {' · '}
              {current.role.toLowerCase()}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60 border-[#27272A] bg-[#111113]">
        <DropdownMenuLabel className="text-xs text-[#71717A]">Switch workspace</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} asChild className="text-xs">
            <Link to={`/w/${workspace.slug}`}>
              <span
                aria-hidden
                className="size-4.5 rounded-[4px] font-semibold text-[#FAFAFA] flex items-center justify-center text-[9px]"
                style={{ backgroundColor: avatarTint(workspace.id) }}
              >
                {initials(workspace.name)}
              </span>
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === current.id ? (
                <Check className="size-3.5 text-[#6E56CF]" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-[#27272A]" />
        <DropdownMenuItem asChild className="text-xs">
          <Link to="/workspaces/new">
            <Plus className="size-3.5" />
            Create a workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
