import {
  TASK_STATUS_ORDER,
  WorkspacePermission,
  type TaskStatus,
  type TaskWorkflowState,
} from '@org/types';
import {
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useCurrentWorkspace,
  useTaskStateMutations,
} from '../use-work-tools.js';
import { StatusIcon } from './kanban-icons.js';
import {
  DEFAULT_WORKFLOW_STATES,
  STATUS_CATEGORY_LABELS,
  STATUS_COLORS,
  useWorkflowStates,
} from './task-states.js';

const CATEGORY_HINTS: Record<TaskStatus, string> = {
  BACKLOG: 'Ideas and requests nobody has committed to yet.',
  TODO: 'Committed work that has not started.',
  IN_PROGRESS: 'Someone is working on it.',
  IN_REVIEW: 'Done, waiting for a check or approval.',
  DONE: 'Finished. Tasks here count as completed.',
  CANCELLED: 'Closed without doing it.',
};

/** The server's message for a rejected request, when it sent one. */
function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  if (typeof message === 'string') return message;
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Settings → Tasks & Kanban → Statuses.
 *
 * The workspace's workflow, grouped by what each status means. Every board,
 * task dialog and status menu reads this list, so a rename or a new status
 * shows up everywhere at once. Built-ins can be renamed and recoloured; custom
 * statuses can also be removed, which moves their tasks to the built-in of the
 * same group.
 */
export function WorkflowStatusesSettings() {
  const { workspaceId } = useCurrentWorkspace();
  const { states, isLoading } = useWorkflowStates();
  const mutations = useTaskStateMutations(workspaceId);
  const canManage = useWorkspacePermission().can(
    WorkspacePermission.MANAGE_SETTINGS,
  );
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);

  const groups = useMemo(
    () =>
      TASK_STATUS_ORDER.map((category) => ({
        category,
        states: states.filter((state) => state.category === category),
      })),
    [states],
  );

  /** Moves a status within its group; the saved order is group by group. */
  const move = (state: TaskWorkflowState, delta: -1 | 1) => {
    const ordered = groups.flatMap((group) => {
      if (group.category !== state.category) return group.states;
      const list = [...group.states];
      const from = list.indexOf(state);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= list.length) return list;
      list.splice(from, 1);
      list.splice(to, 0, state);
      return list;
    });
    mutations.reorder.mutate(
      ordered.map((item) => item.id),
      {
        onError: (error) =>
          toast.error(errorMessage(error, 'Could not reorder statuses')),
      },
    );
  };

  const rename = (state: TaskWorkflowState, name: string) =>
    mutations.update.mutateAsync({ stateId: state.id, input: { name } }).then(
      () => true,
      (error) => {
        toast.error(errorMessage(error, 'Could not rename the status'));
        return false;
      },
    );

  const recolor = (state: TaskWorkflowState, color: string) =>
    mutations.update.mutate(
      { stateId: state.id, input: { color } },
      {
        onError: (error) =>
          toast.error(errorMessage(error, 'Could not change the colour')),
      },
    );

  const remove = async (state: TaskWorkflowState) => {
    const fallback =
      states.find((item) => item.builtin && item.category === state.category)
        ?.name ?? 'its group';
    const ok = await confirm({
      title: `Delete “${state.name}”?`,
      description: `Tasks in this status move to ${fallback}. Boards drop the column.`,
      confirmLabel: 'Delete status',
      destructive: true,
    });
    if (!ok) return;
    mutations.remove.mutate(state.id, {
      onSuccess: () => toast.success(`Deleted “${state.name}”`),
      onError: (error) =>
        toast.error(errorMessage(error, 'Could not delete the status')),
    });
  };

  const add = async (category: TaskStatus, name: string) => {
    const color = DEFAULT_WORKFLOW_STATES.find(
      (state) => state.id === category,
    )?.color;
    try {
      await mutations.create.mutateAsync({
        name,
        category,
        ...(color ? { color } : {}),
      });
      setAddingTo(null);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not add the status'));
      return false;
    }
  };

  return (
    <div id="statuses" className="space-y-3 scroll-mt-6">
      <div className="px-1 gap-4 flex items-end justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Statuses ({states.length})
          </h3>
          <p className="text-xs mt-1 text-muted-foreground">
            Shared by every board and status menu. Press 1–9 in a status menu to
            pick by position.
            {!canManage && ' Only workspace admins can change them.'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        {groups.map((group) => (
          <section
            key={group.category}
            aria-label={STATUS_CATEGORY_LABELS[group.category]}
          >
            <header className="px-3.5 py-2 gap-3 flex items-center justify-between bg-muted/30">
              <div className="min-w-0">
                <p className="font-semibold text-[11px] text-foreground">
                  {STATUS_CATEGORY_LABELS[group.category]}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {CATEGORY_HINTS[group.category]}
                </p>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Add a ${STATUS_CATEGORY_LABELS[group.category]} status`}
                  onClick={() => setAddingTo(group.category)}
                >
                  <Plus />
                </Button>
              )}
            </header>

            <ul className="divide-y divide-border/40">
              {group.states.map((state, index) => (
                <StatusRow
                  key={state.id}
                  state={state}
                  canManage={canManage}
                  isFirst={index === 0}
                  isLast={index === group.states.length - 1}
                  onMove={(delta) => move(state, delta)}
                  onRename={(name) => rename(state, name)}
                  onRecolor={(color) => recolor(state, color)}
                  onDelete={() => void remove(state)}
                />
              ))}
              {addingTo === group.category && (
                <NewStatusRow
                  category={group.category}
                  pending={mutations.create.isPending}
                  onCancel={() => setAddingTo(null)}
                  onSubmit={(name) => add(group.category, name)}
                />
              )}
            </ul>
          </section>
        ))}
        {isLoading && (
          <p className="px-3.5 py-2 text-xs text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  state,
  canManage,
  isFirst,
  isLast,
  onMove,
  onRename,
  onRecolor,
  onDelete,
}: {
  state: TaskWorkflowState;
  canManage: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: -1 | 1) => void;
  onRename: (name: string) => Promise<boolean>;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.name);

  useEffect(() => {
    if (!editing) setDraft(state.name);
  }, [state.name, editing]);

  const save = async () => {
    const name = draft.trim();
    if (!name || name === state.name) {
      setEditing(false);
      return;
    }
    if (await onRename(name)) setEditing(false);
  };

  return (
    <li className="group/row px-3.5 py-2 gap-3 min-h-11 flex items-center">
      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Colour of ${state.name}`}
              className="size-6 flex items-center justify-center rounded-md hover:bg-muted"
            >
              <StatusIcon
                status={state.id}
                className="size-4"
                showTooltip={false}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-2">
            <div
              role="group"
              aria-label="Colour"
              className="gap-1.5 grid grid-cols-5"
            >
              {STATUS_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={state.color === color}
                  onClick={() => onRecolor(color)}
                  className={cn(
                    'size-6 flex items-center justify-center rounded-full border-2',
                    state.color === color
                      ? 'border-foreground'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color }}
                >
                  {state.color === color && (
                    <Check className="size-3 text-white" />
                  )}
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="size-6 flex items-center justify-center">
          <StatusIcon
            status={state.id}
            className="size-4"
            showTooltip={false}
          />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            maxLength={40}
            aria-label="Status name"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save();
              if (event.key === 'Escape') {
                setDraft(state.name);
                setEditing(false);
              }
            }}
            className="h-7 text-xs max-w-64"
          />
        ) : (
          <div className="gap-2 min-w-0 flex items-center">
            <span className="text-xs font-semibold truncate text-foreground">
              {state.name}
            </span>
            {state.builtin && (
              <span className="px-1.5 py-0.5 rounded border border-border/50 bg-muted/60 text-[10px] text-muted-foreground">
                Default
              </span>
            )}
          </div>
        )}
      </div>

      {canManage && !editing && (
        <div className="gap-0.5 sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100 flex items-center opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${state.name} up`}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${state.name} down`}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Rename ${state.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          {!state.builtin && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${state.name}`}
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function NewStatusRow({
  category,
  pending,
  onSubmit,
  onCancel,
}: {
  category: TaskStatus;
  pending: boolean;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = async () => {
    const value = name.trim();
    if (!value) return;
    if (await onSubmit(value)) setName('');
  };

  return (
    <li className="px-3.5 py-2 gap-3 flex items-center">
      <span className="size-6 flex items-center justify-center">
        <StatusIcon status={category} className="size-4" showTooltip={false} />
      </span>
      <Input
        ref={inputRef}
        value={name}
        maxLength={40}
        placeholder={`New ${STATUS_CATEGORY_LABELS[category].toLowerCase()} status, e.g. ${
          category === 'IN_REVIEW'
            ? 'QA'
            : category === 'IN_PROGRESS'
              ? 'Blocked'
              : 'Triage'
        }`}
        aria-label="New status name"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void submit();
          if (event.key === 'Escape') onCancel();
        }}
        className="h-7 text-xs max-w-64 flex-1"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => void submit()}
        loading={pending}
        disabled={!name.trim()}
      >
        Add
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel"
        onClick={onCancel}
      >
        <X />
      </Button>
    </li>
  );
}
