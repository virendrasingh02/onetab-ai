import {
  TASK_STATUS_ORDER,
  WorkspacePermission,
  type TaskStatus,
} from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import { Check, ChevronDown, Plus, Search, Settings2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCurrentWorkspace,
  useTaskStateMutations,
} from '../use-work-tools.js';
import { StatusIcon } from './kanban-icons.js';
import { useMenuSearchField } from './menu-search-field.js';
import {
  DEFAULT_WORKFLOW_STATES,
  STATUS_CATEGORY_LABELS,
  useWorkflowStates,
} from './task-states.js';

export interface KanbanStatusPickerProps {
  /** The current state id: a built-in status name or a custom state's id. */
  status: TaskStatus | string;
  /** Called with the chosen state id; map it with `statePatch` before saving. */
  onStatusChange: (stateId: string) => void;
  trigger?: React.ReactNode;
  /**
   * `icon` (default) is the bare status icon used on cards and rows; `field`
   * is a full-width select-style button for forms.
   */
  variant?: 'icon' | 'field';
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
}

/**
 * The one status menu: cards, the task dialog, the new-task form, the list and
 * spreadsheet views all open this, so they list the same statuses in the same
 * order with the same names. Type to filter, press 1–9 to pick, and admins can
 * create a status right here or jump to the workflow settings.
 */
export function KanbanStatusPicker({
  status,
  onStatusChange,
  trigger,
  variant = 'icon',
  align = 'start',
  disabled,
}: KanbanStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchField = useMenuSearchField();
  const { states, byId } = useWorkflowStates();
  const { workspaceId, slug } = useCurrentWorkspace();
  const mutations = useTaskStateMutations(workspaceId);
  const canManage = useWorkspacePermission().can(
    WorkspacePermission.MANAGE_SETTINGS,
  );
  const navigate = useNavigate();

  const query = search.trim();
  const filtered = useMemo(
    () =>
      query
        ? states.filter((state) =>
            state.name.toLowerCase().includes(query.toLowerCase()),
          )
        : states,
    [states, query],
  );
  const exactMatch = states.some(
    (state) => state.name.toLowerCase() === query.toLowerCase(),
  );

  const pick = (id: string) => {
    if (id !== status) onStatusChange(id);
    setOpen(false);
  };

  const createAndPick = async (category: TaskStatus) => {
    const name = query.slice(0, 40);
    if (!name) return;
    const color = DEFAULT_WORKFLOW_STATES.find(
      (state) => state.id === category,
    )?.color;
    try {
      const created = await mutations.create.mutateAsync({
        name,
        category,
        ...(color ? { color } : {}),
      });
      onStatusChange(created.id);
      setOpen(false);
      toast.success(`Added “${created.name}” to the workflow`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not add “${name}”`,
      );
    }
  };

  const current = byId(status);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger ??
          (variant === 'field' ? (
            <button
              type="button"
              aria-label="Status"
              className="h-9 gap-2 px-3 text-sm flex w-full items-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              <StatusIcon
                status={status}
                className="size-4"
                showTooltip={false}
              />
              <span className="flex-1 truncate text-left">
                {current?.name ?? 'Status'}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button
              type="button"
              className="size-6 flex cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80"
              aria-label={`Status: ${current?.name ?? 'Status'}. Change status`}
            >
              <StatusIcon status={status} />
            </button>
          ))}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        {...searchField.contentProps}
        align={align}
        className="w-60 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        <div className="gap-2 px-2 py-1.5 mb-1 flex items-center rounded-lg border border-border/60 bg-muted/30">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            ref={searchField.inputProps.ref}
            onKeyDown={(event) => {
              // Digits pick while the box is empty, like the old menu did.
              if (!query && /^[1-9]$/.test(event.key)) {
                const match = states[Number(event.key) - 1];
                if (match) {
                  event.preventDefault();
                  event.stopPropagation();
                  pick(match.id);
                  return;
                }
              }
              searchField.inputProps.onKeyDown(event);
              if (event.key === 'Enter' && filtered.length > 0 && query) {
                event.preventDefault();
                pick(filtered[0].id);
              }
            }}
            placeholder="Change status…"
            aria-label="Search statuses"
            className="text-xs w-full bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
        </div>

        <div className="max-h-72 space-y-0.5 no-scrollbar overflow-y-auto">
          {filtered.map((state) => {
            const isSelected = state.id === status;
            const digit = states.indexOf(state) + 1;
            return (
              <DropdownMenuItem
                key={state.id}
                onSelect={() => pick(state.id)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium flex cursor-pointer items-center justify-between rounded-lg transition-colors',
                  isSelected
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/85 hover:bg-accent/60',
                )}
              >
                <div className="gap-2.5 min-w-0 flex items-center">
                  <StatusIcon
                    status={state.id}
                    className="size-4"
                    showTooltip={false}
                  />
                  <span className="truncate">{state.name}</span>
                </div>
                <div className="gap-2 flex items-center text-muted-foreground/80">
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 stroke-[2.5] text-foreground" />
                  )}
                  {digit <= 9 && (
                    <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                      {digit}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}

          {filtered.length === 0 && !(canManage && query) && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              No status matches “{query}”.
            </p>
          )}
        </div>

        {canManage && query && !exactMatch && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 px-2.5 py-1.5 mt-1 text-xs font-medium rounded-lg text-primary">
              <Plus className="size-3.5" />
              <span className="truncate">Create “{query.slice(0, 40)}”</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1.5 rounded-xl">
              <p className="px-2 pt-0.5 pb-1.5 text-[11px] text-muted-foreground">
                Works like…
              </p>
              {TASK_STATUS_ORDER.map((category) => (
                <DropdownMenuItem
                  key={category}
                  disabled={mutations.create.isPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    void createAndPick(category);
                  }}
                  className="gap-2.5 px-2 py-1.5 text-xs cursor-pointer rounded-lg"
                >
                  <StatusIcon
                    status={category}
                    className="size-4"
                    showTooltip={false}
                    color={undefined}
                  />
                  <span>{STATUS_CATEGORY_LABELS[category]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {canManage && slug && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${slug}/settings/kanban-tasks#statuses`)
              }
              className="gap-2 px-2.5 py-1.5 text-xs cursor-pointer rounded-lg text-muted-foreground"
            >
              <Settings2 className="size-3.5" />
              <span>Manage statuses</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
