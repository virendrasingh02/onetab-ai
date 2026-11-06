import {
  AppSelect,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirm,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
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
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  UserAvatar,
} from '@org/ui';
import {
  WorkspacePermission,
  type Epic,
  type Module,
  type PublicUser,
  type Task,
} from '@org/types';
import { useWorkspacePermission } from '@org/web-workspace';
import type {
  CreateEpicInput,
  CreateModuleInput,
  UpdateEpicInput,
  UpdateModuleInput,
} from '@org/validation';
import { cn } from '@org/utils';
import {
  FolderGit2,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';
import { dayToIso, isoToDay, taskTicket } from '../kanban/server-board.js';

type Kind = 'epics' | 'modules';
type TaskLink = { epicId: string | null } | { moduleId: string | null };

interface ModulesEpicsViewProps {
  projectId: string;
  epics: Epic[];
  modules: Module[];
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onCreateEpic: (input: CreateEpicInput) => Promise<unknown>;
  onUpdateEpic: (epicId: string, input: UpdateEpicInput) => Promise<unknown>;
  onDeleteEpic: (epicId: string) => Promise<unknown>;
  onCreateModule: (input: CreateModuleInput) => Promise<unknown>;
  onUpdateModule: (
    moduleId: string,
    input: UpdateModuleInput,
  ) => Promise<unknown>;
  onDeleteModule: (moduleId: string) => Promise<unknown>;
  onLinkTask: (taskId: string, link: TaskLink) => void;
}

/** What the create/edit dialog is working on. */
interface Draft {
  kind: Kind;
  id?: string;
  name: string;
  description: string;
  targetDate?: string;
  leadId: string;
}

const NO_LEAD = 'none';

export function ModulesEpicsView({
  projectId,
  epics,
  modules,
  tasks,
  members,
  onSelectTask,
  onCreateEpic,
  onUpdateEpic,
  onDeleteEpic,
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onLinkTask,
}: ModulesEpicsViewProps) {
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
  const [tab, setTab] = useState<Kind>('epics');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const isEpics = tab === 'epics';
  const noun = isEpics ? 'epic' : 'module';
  const items: Array<Epic | Module> = isEpics ? epics : modules;
  const active = items.find((item) => item.id === selectedId) ?? items[0];

  const tasksOf = (id: string) =>
    tasks.filter((task) => (isEpics ? task.epicId : task.moduleId) === id);
  const selectedTasks = active ? tasksOf(active.id) : [];
  const linkable = active
    ? tasks.filter(
        (task) => (isEpics ? task.epicId : task.moduleId) !== active.id,
      )
    : [];

  const link = (taskId: string, id: string | null) =>
    onLinkTask(taskId, isEpics ? { epicId: id } : { moduleId: id });

  const openCreate = () =>
    setDraft({ kind: tab, name: '', description: '', leadId: NO_LEAD });

  const openEdit = (item: Epic | Module) =>
    setDraft({
      kind: tab,
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      targetDate: isoToDay(item.targetDate),
      leadId: ('leadId' in item ? item.leadId : null) ?? NO_LEAD,
    });

  const handleDelete = async (item: Epic | Module) => {
    const ok = await confirm({
      title: `Delete “${item.name}”?`,
      description: `Its tasks stay in the project and are no longer linked to this ${noun}.`,
      confirmLabel: `Delete ${noun}`,
      destructive: true,
    });
    if (!ok) return;
    if (selectedId === item.id) setSelectedId(null);
    await (isEpics ? onDeleteEpic(item.id) : onDeleteModule(item.id)).catch(
      () => undefined,
    );
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || draft.name.trim().length < 2) return;

    const shared = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      targetDate: draft.targetDate ? dayToIso(draft.targetDate) : null,
    };
    const leadId = draft.leadId === NO_LEAD ? null : draft.leadId;

    setSaving(true);
    try {
      if (draft.kind === 'epics') {
        await (draft.id
          ? onUpdateEpic(draft.id, shared)
          : onCreateEpic({ ...shared, projectId }));
      } else {
        await (draft.id
          ? onUpdateModule(draft.id, { ...shared, leadId })
          : onCreateModule({ ...shared, leadId, projectId }));
      }
      setDraft(null);
    } catch {
      // The app's mutation handler has shown the error; the draft stays open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gap-6 p-4 flex h-full w-full flex-col overflow-y-auto">
      <div className="gap-3 flex items-center justify-between">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as Kind);
            setSelectedId(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="epics">Epics ({epics.length})</TabsTrigger>
            <TabsTrigger value="modules">
              Modules ({modules.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button size="sm" leadingIcon={<Plus />} onClick={openCreate}>
          {isEpics ? 'New epic' : 'New module'}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={isEpics ? <Layers /> : <FolderGit2 />}
          title={isEpics ? 'No epics yet' : 'No modules yet'}
          description={
            isEpics
              ? 'Epics group related tasks into one larger piece of work.'
              : 'Modules group tasks by the part of the product they touch.'
          }
          action={
            <Button size="sm" leadingIcon={<Plus />} onClick={openCreate}>
              {isEpics ? 'New epic' : 'New module'}
            </Button>
          }
        />
      ) : (
        <div className="md:grid-cols-3 gap-6 grid flex-1 grid-cols-1 items-start">
          <div className="md:col-span-2 sm:grid-cols-2 gap-4 grid grid-cols-1">
            {items.map((item) => {
              const itemTasks = tasksOf(item.id);
              const completed = itemTasks.filter(
                (task) => task.status === 'DONE',
              ).length;
              const total = itemTasks.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const lead = 'lead' in item ? item.lead : null;

              return (
                <Card
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'cursor-pointer border shadow-xs transition-all hover:border-primary/50',
                    active?.id === item.id
                      ? 'border-primary bg-card ring-1 ring-primary/20'
                      : 'border-border/60 bg-card/60',
                  )}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="gap-2 flex items-center justify-between">
                      <Badge variant="neutral" className="text-[10px]">
                        {pct}% done
                      </Badge>
                      <ItemMenu
                        name={item.name}
                        onEdit={() => openEdit(item)}
                        onDelete={
                          canDelete ? () => void handleDelete(item) : undefined
                        }
                      />
                    </div>
                    <CardTitle className="text-sm font-semibold mt-1 text-foreground">
                      {item.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 gap-3 flex flex-col">
                    {item.description ? (
                      <p className="text-xs line-clamp-2 text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <Progress value={pct} className="h-1.5" />
                    <div className="gap-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {completed}/{total} done
                      </span>
                      {lead ? (
                        <span className="min-w-0 gap-1 flex items-center">
                          <UserAvatar
                            name={lead.displayName || lead.name}
                            seed={lead.id}
                            src={lead.avatarUrl}
                            size="xs"
                            className="size-4"
                          />
                          <span className="truncate">
                            {lead.displayName || lead.name}
                          </span>
                        </span>
                      ) : item.targetDate ? (
                        <span>
                          Due {new Date(item.targetDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
            <div className="px-4 py-2.5 gap-2 flex items-center justify-between border-b border-border/60 bg-muted/40">
              <span className="min-w-0 text-xs font-medium truncate text-foreground">
                {active ? `Tasks in ${active.name}` : 'Tasks'}
              </span>
              {active ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      leadingIcon={<Plus />}
                      disabled={linkable.length === 0}
                    >
                      Add task
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 max-h-72 overflow-y-auto"
                  >
                    {linkable.map((task) => (
                      <DropdownMenuItem
                        key={task.id}
                        onSelect={() => link(task.id, active.id)}
                        className="gap-2 text-xs"
                      >
                        <StatusIcon status={task.status} className="size-3.5" />
                        <span className="truncate">{task.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            <div className="p-2 max-h-[500px] overflow-y-auto">
              {selectedTasks.length === 0 ? (
                <p className="p-8 text-xs text-center text-muted-foreground">
                  No tasks in this {noun} yet.
                </p>
              ) : (
                selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group gap-1 p-1 flex items-center rounded-lg transition-colors hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="min-w-0 gap-2 p-1 flex flex-1 cursor-pointer items-center text-left"
                    >
                      <StatusIcon
                        status={task.status}
                        className="size-3.5 shrink-0"
                      />
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {taskTicket(task)}
                      </span>
                      <span className="text-xs font-medium truncate text-foreground">
                        {task.title}
                      </span>
                    </button>
                    {task.assignee ? (
                      <UserAvatar
                        name={task.assignee.displayName || task.assignee.name}
                        seed={task.assignee.id}
                        src={task.assignee.avatarUrl}
                        size="xs"
                        className="size-5 shrink-0"
                      />
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => link(task.id, null)}
                      aria-label={`Remove ${task.title} from this ${noun}`}
                      className="size-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
                  {draft.id ? 'Edit' : 'New'}{' '}
                  {draft.kind === 'epics' ? 'epic' : 'module'}
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="gap-3 flex flex-col">
                <Field label="Name" required>
                  <Input
                    autoFocus
                    maxLength={100}
                    placeholder={
                      draft.kind === 'epics'
                        ? 'e.g. Customer onboarding'
                        : 'e.g. Authentication'
                    }
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Description" optional>
                  <Textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </Field>
                <div className="gap-3 grid grid-cols-2">
                  <Field label="Target date" optional>
                    <DatePicker
                      value={draft.targetDate}
                      onChange={(targetDate) =>
                        setDraft({ ...draft, targetDate })
                      }
                      placeholder="No date"
                    />
                  </Field>
                  {draft.kind === 'modules' ? (
                    <Field label="Lead" optional>
                      <AppSelect
                        value={draft.leadId}
                        onValueChange={(leadId) =>
                          setDraft({ ...draft, leadId })
                        }
                        aria-label="Module lead"
                        options={[
                          { value: NO_LEAD, label: 'No lead' },
                          ...members.map((member) => ({
                            value: member.id,
                            label: member.displayName || member.name,
                          })),
                        ]}
                      />
                    </Field>
                  ) : null}
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
                  disabled={draft.name.trim().length < 2}
                >
                  {draft.id ? 'Save changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemMenu({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete?: () => void;
}): ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 text-muted-foreground"
          aria-label={`Actions for ${name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onSelect={onEdit} className="gap-2 text-xs">
          <Pencil className="size-3.5" />
          Edit
        </DropdownMenuItem>
        {onDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={onDelete}
            className="gap-2 text-xs"
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
