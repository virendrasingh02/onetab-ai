import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirm,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UserAvatar,
  DatePicker,
} from '@org/ui';
import {
  CycleStatus,
  WorkspacePermission,
  type Cycle,
  type PublicUser,
  type Task,
} from '@org/types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useWorkspacePermission } from '@org/web-workspace';
import { StatusIcon } from '../kanban/kanban-icons.js';
import { dayToIso, isoToDay, taskTicket } from '../kanban/server-board.js';

const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  DRAFT: 'Draft',
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

interface CycleDraft {
  id?: string;
  name: string;
  goal: string;
  startDate?: string;
  endDate?: string;
}

function newCycleDraft(): CycleDraft {
  const end = new Date();
  end.setDate(end.getDate() + 14);
  return {
    name: '',
    goal: '',
    startDate: isoToDay(new Date().toISOString()),
    endDate: isoToDay(end.toISOString()),
  };
}

interface CyclesPlanningViewProps {
  cycles: Cycle[];
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  /** Each rejects on failure; the app's mutation handler shows the error. */
  onCreateCycle: (input: {
    name: string;
    description?: string;
    goal?: string;
    startDate: string;
    endDate: string;
  }) => Promise<Cycle>;
  onUpdateCycle: (
    cycleId: string,
    input: {
      name?: string;
      goal?: string | null;
      startDate?: string;
      endDate?: string;
      status?: CycleStatus;
    },
  ) => Promise<unknown>;
  onDeleteCycle: (cycleId: string) => Promise<unknown>;
  onAssignTaskToCycle: (taskId: string, cycleId: string | null) => void;
}

export function CyclesPlanningView({
  cycles,
  tasks,
  onSelectTask,
  onCreateCycle,
  onUpdateCycle,
  onDeleteCycle,
  onAssignTaskToCycle,
}: CyclesPlanningViewProps) {
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
  const [pickedCycleId, setPickedCycleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CycleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // Derived, not stored: cycles arrive after the first render, and a deleted
  // cycle has to fall back to something.
  const selectedCycle =
    cycles.find((c) => c.id === pickedCycleId) ??
    cycles.find((c) => c.status === CycleStatus.ACTIVE) ??
    cycles[0];
  const selectedCycleId = selectedCycle?.id ?? null;
  const cycleTasks = selectedCycle
    ? tasks.filter((t) => t.cycleId === selectedCycle.id)
    : [];
  const backlogTasks = tasks.filter((t) => !t.cycleId);

  const completedCount = cycleTasks.filter((t) => t.status === 'DONE').length;
  const totalCount = cycleTasks.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalEstimate = cycleTasks.reduce(
    (acc, t) => acc + (t.estimate || 0),
    0,
  );
  const completedEstimate = cycleTasks
    .filter((t) => t.status === 'DONE')
    .reduce((acc, t) => acc + (t.estimate || 0), 0);

  const draftDatesValid =
    !!draft?.startDate && !!draft.endDate && draft.startDate <= draft.endDate;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !draft.name.trim() || !draftDatesValid) return;

    const input = {
      name: draft.name.trim(),
      startDate: dayToIso(draft.startDate as string),
      endDate: dayToIso(draft.endDate as string),
    };
    setSaving(true);
    try {
      if (draft.id) {
        await onUpdateCycle(draft.id, {
          ...input,
          goal: draft.goal.trim() || null,
        });
      } else {
        const created = await onCreateCycle({
          ...input,
          goal: draft.goal.trim() || undefined,
        });
        setPickedCycleId(created.id);
      }
      setDraft(null);
    } catch {
      // The draft stays open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cycle: Cycle) => {
    const ok = await confirm({
      title: `Delete “${cycle.name}”?`,
      description:
        'Its tasks stay in the project and go back to having no cycle.',
      confirmLabel: 'Delete cycle',
      destructive: true,
    });
    if (ok) await onDeleteCycle(cycle.id).catch(() => undefined);
  };

  const setStatus = (status: CycleStatus) => {
    if (selectedCycle) {
      onUpdateCycle(selectedCycle.id, { status }).catch(() => undefined);
    }
  };

  if (cycles.length === 0) {
    return (
      <div className="p-4 flex h-full w-full items-center justify-center">
        <EmptyState
          icon={<RotateCw />}
          title="No cycles yet"
          description="A cycle is a fixed stretch of time with a goal. Plan one, then pull tasks into it."
          action={
            <Button
              size="sm"
              leadingIcon={<Plus />}
              onClick={() => setDraft(newCycleDraft())}
            >
              New cycle
            </Button>
          }
        />
        {renderDialog()}
      </div>
    );
  }

  return (
    <div className="gap-6 p-4 flex h-full w-full flex-col overflow-y-auto">
      {/* Top Banner: Active Cycle Overview & Stats */}
      <div className="lg:flex-row gap-4 flex flex-col items-stretch">
        {/* Left: Cycle Selector & Status */}
        <Card className="flex-1 border border-border/60 bg-card/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="gap-3 flex items-center">
              <div className="size-8 grid place-items-center rounded-lg bg-primary/10 text-primary">
                <RotateCw className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold gap-2 flex items-center">
                  {selectedCycle?.name}
                  {selectedCycle ? (
                    <Badge variant="neutral" className="text-[10px]">
                      {CYCLE_STATUS_LABELS[selectedCycle.status]}
                    </Badge>
                  ) : null}
                </CardTitle>
                {selectedCycle?.goal && (
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Goal: {selectedCycle.goal}
                  </p>
                )}
              </div>
            </div>

            <div className="gap-2 flex items-center">
              {selectedCycle?.status === CycleStatus.ACTIVE ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(CycleStatus.COMPLETED)}
                  className="gap-1.5 text-xs h-8"
                >
                  <CheckCircle2 className="size-3.5" />
                  Complete
                </Button>
              ) : selectedCycle &&
                selectedCycle.status !== CycleStatus.COMPLETED &&
                selectedCycle.status !== CycleStatus.ARCHIVED ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(CycleStatus.ACTIVE)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Play className="size-3.5" />
                  Start
                </Button>
              ) : null}

              <Select
                value={selectedCycleId || ''}
                onValueChange={(val) => setPickedCycleId(val)}
              >
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Choose cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({CYCLE_STATUS_LABELS[c.status]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => setDraft(newCycleDraft())}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="size-3.5" />
                New cycle
              </Button>

              {selectedCycle ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${selectedCycle.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onSelect={() =>
                        setDraft({
                          id: selectedCycle.id,
                          name: selectedCycle.name,
                          goal: selectedCycle.goal ?? '',
                          startDate: isoToDay(selectedCycle.startDate),
                          endDate: isoToDay(selectedCycle.endDate),
                        })
                      }
                      className="gap-2 text-xs"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    {canDelete ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => void handleDelete(selectedCycle)}
                        className="gap-2 text-xs"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-3 gap-3 flex flex-col">
            {selectedCycle && (
              <>
                <div className="text-xs flex items-center justify-between text-muted-foreground">
                  <span className="gap-1 flex items-center">
                    <Calendar className="size-3.5" />
                    {new Date(
                      selectedCycle.startDate,
                    ).toLocaleDateString()} –{' '}
                    {new Date(selectedCycle.endDate).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-foreground">
                    {progressPct}% done ({completedCount}/{totalCount} tasks)
                  </span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Metrics Tiles */}
        <div className="sm:grid-cols-3 gap-3 lg:w-[420px] grid shrink-0 grid-cols-2">
          <Card className="p-3 flex flex-col justify-between border border-border/60 bg-muted/20">
            <span className="font-medium gap-1 flex items-center text-[11px] text-muted-foreground">
              <Zap className="size-3.5 text-accent-amber" />
              Points done
            </span>
            <div className="text-xl font-bold text-foreground">
              {completedEstimate}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {totalEstimate} pts
              </span>
            </div>
          </Card>

          <Card className="p-3 flex flex-col justify-between border border-border/60 bg-muted/20">
            <span className="font-medium gap-1 flex items-center text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-accent-green" />
              Tasks done
            </span>
            <div className="text-xl font-bold text-accent-green">
              {completedCount}
            </div>
          </Card>

          <Card className="p-3 sm:col-span-1 col-span-2 flex flex-col justify-between border border-border/60 bg-muted/20">
            <span className="font-medium gap-1 flex items-center text-[11px] text-muted-foreground">
              <Clock className="size-3.5 text-accent-blue" />
              Remaining
            </span>
            <div className="text-xl font-bold text-foreground">
              {totalCount - completedCount}
            </div>
          </Card>
        </div>
      </div>

      {/* Main Area: 2 Columns - In Cycle vs Backlog Carry-Over */}
      <div className="lg:grid-cols-2 gap-6 grid flex-1 grid-cols-1">
        {/* In-Cycle Work Items */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/60 bg-muted/40">
            <span className="font-medium text-xs text-foreground">
              In {selectedCycle?.name || 'cycle'} ({cycleTasks.length})
            </span>
          </div>

          <div className="p-2 space-y-1 flex-1 divide-y divide-border/30 overflow-y-auto">
            {cycleTasks.length === 0 ? (
              <div className="py-12 text-xs text-center text-muted-foreground">
                Nothing in this cycle yet. Add tasks from the list beside this
                one.
              </div>
            ) : (
              cycleTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-2.5 group flex cursor-pointer items-center justify-between rounded-lg border border-transparent transition-colors hover:border-border/40 hover:bg-muted/40"
                >
                  <div className="gap-2.5 pr-2 flex items-center truncate">
                    <StatusIcon
                      status={task.stateId || task.status}
                      className="size-3.5 shrink-0"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {taskTicket(task)}
                    </span>
                    <span className="text-xs font-medium truncate text-foreground">
                      {task.title}
                    </span>
                  </div>

                  <div className="gap-2 flex shrink-0 items-center">
                    {task.estimate != null && (
                      <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground">
                        {task.estimate} pts
                      </span>
                    )}
                    {task.assignee && (
                      <UserAvatar
                        name={task.assignee.displayName || task.assignee.name}
                        seed={task.assignee.id}
                        src={task.assignee.avatarUrl}
                        size="xs"
                        className="size-5"
                      />
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignTaskToCycle(task.id, null);
                      }}
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Backlog Items to Add */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/60 bg-muted/40">
            <span className="font-medium text-xs text-muted-foreground">
              Not in a cycle ({backlogTasks.length})
            </span>
          </div>

          <div className="p-2 space-y-1 flex-1 divide-y divide-border/30 overflow-y-auto">
            {backlogTasks.length === 0 ? (
              <div className="py-12 text-xs text-center text-muted-foreground">
                Every task in this project is in a cycle.
              </div>
            ) : (
              backlogTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="p-2.5 group flex cursor-pointer items-center justify-between rounded-lg border border-transparent transition-colors hover:border-border/40 hover:bg-muted/40"
                >
                  <div className="gap-2.5 pr-2 flex items-center truncate">
                    <StatusIcon
                      status={task.stateId || task.status}
                      className="size-3.5 shrink-0"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {taskTicket(task)}
                    </span>
                    <span className="text-xs font-medium truncate text-foreground">
                      {task.title}
                    </span>
                  </div>

                  <div className="gap-2 flex shrink-0 items-center">
                    {task.estimate != null && (
                      <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground">
                        {task.estimate} pts
                      </span>
                    )}
                    {selectedCycleId && (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssignTaskToCycle(task.id, selectedCycleId);
                        }}
                        className="h-6 px-2 gap-1 text-[10px] text-primary"
                      >
                        <Plus className="size-3" />
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {renderDialog()}
    </div>
  );

  function renderDialog() {
    return (
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {draft ? (
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? 'Edit cycle' : 'New cycle'}
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="gap-3 flex flex-col">
                <Field label="Name" required>
                  <Input
                    autoFocus
                    maxLength={100}
                    placeholder="e.g. Sprint 24"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Goal" optional>
                  <Input
                    maxLength={500}
                    placeholder="What this cycle should deliver"
                    value={draft.goal}
                    onChange={(e) =>
                      setDraft({ ...draft, goal: e.target.value })
                    }
                  />
                </Field>
                <div className="gap-3 grid grid-cols-2">
                  <Field label="Start date" required>
                    <DatePicker
                      value={draft.startDate}
                      onChange={(startDate) =>
                        setDraft({ ...draft, startDate })
                      }
                    />
                  </Field>
                  <Field
                    label="End date"
                    required
                    error={
                      draft.startDate &&
                      draft.endDate &&
                      draft.startDate > draft.endDate
                        ? 'Must be after the start date'
                        : undefined
                    }
                  >
                    <DatePicker
                      value={draft.endDate}
                      onChange={(endDate) => setDraft({ ...draft, endDate })}
                    />
                  </Field>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={saving}
                  disabled={!draft.name.trim() || !draftDatesValid}
                >
                  {draft.id ? 'Save changes' : 'Create cycle'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    );
  }
}
