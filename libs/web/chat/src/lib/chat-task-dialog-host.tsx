import { queryKeys, workToolsApi } from '@org/api-client';
import { TaskPriority } from '@org/types';
import {
  AppSelect,
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  ProjectGlyph,
  Textarea,
} from '@org/ui';
import { useMembers } from '@org/web-members';
import { useWorkspaceStore } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  rememberedProjectId,
  useChatTaskDraft,
  useChatTasks,
  type ChatTaskDraft,
} from './use-chat-tasks.js';

const UNASSIGNED = 'unassigned';

const PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: TaskPriority.URGENT, label: 'Urgent' },
  { value: TaskPriority.HIGH, label: 'High' },
  { value: TaskPriority.MEDIUM, label: 'Medium' },
  { value: TaskPriority.LOW, label: 'Low' },
];

/** `YYYY-MM-DD` from the date picker, as the local day the API stores. */
function dayToIso(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toISOString();
}

/**
 * The "New task" dialog for tasks raised in a conversation. Mounted once near
 * the app root; `useChatTasks().startTask` opens it from a message action or
 * a slash command, in whichever chat surface that happened.
 */
export function ChatTaskDialogHost() {
  const draft = useChatTaskDraft((state) => state.draft);
  const close = useChatTaskDraft((state) => state.close);

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[520px]">
        {/* Remounted per draft so one task never inherits another's fields. */}
        {draft ? <ChatTaskForm draft={draft} onDone={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ChatTaskForm({
  draft,
  onDone,
}: {
  draft: ChatTaskDraft;
  onDone: () => void;
}) {
  // The store, not the route: this renders above the workspace routes.
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const workspaceId = workspace?.id;
  const slug = workspace?.slug;
  const navigate = useNavigate();
  const { createTask } = useChatTasks();
  const members = useMembers(workspaceId);
  // Same cache entry as the Projects page and the sidebar.
  const projects = useQuery({
    queryKey: queryKeys.workTools.projects(workspaceId ?? ''),
    queryFn: () => workToolsApi.projects(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? '');
  const [pickedProjectId, setPickedProjectId] = useState<string>();
  const [assigneeId, setAssigneeId] = useState(draft.assigneeId ?? UNASSIGNED);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [share, setShare] = useState(false);
  const [pending, setPending] = useState(false);

  const projectList = useMemo(
    () => (projects.data ?? []).filter((project) => project.status !== 'ARCHIVED'),
    [projects.data],
  );
  // The user's pick, else where this conversation's tasks went last time.
  const projectId = useMemo(() => {
    const wanted =
      pickedProjectId ??
      (workspaceId ? rememberedProjectId(workspaceId, draft.roomId) : undefined);
    return (
      projectList.find((project) => project.id === wanted)?.id ??
      projectList[0]?.id
    );
  }, [pickedProjectId, workspaceId, draft.roomId, projectList]);

  const assigneeOptions = useMemo(
    () => [
      { value: UNASSIGNED, label: 'Unassigned' },
      ...(members.data ?? []).map((member) => ({
        value: member.user.id,
        label: member.user.displayName ?? member.user.name,
      })),
    ],
    [members.data],
  );

  const noProjects = !projects.isLoading && projectList.length === 0;
  const canSubmit = Boolean(title.trim()) && Boolean(projectId) && !pending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !projectId) return;
    setPending(true);
    try {
      await createTask(draft, {
        title: title.trim(),
        description: description.trim() || null,
        projectId,
        // The searchable select can be cleared, which leaves it empty.
        assigneeId:
          assigneeId && assigneeId !== UNASSIGNED ? assigneeId : null,
        priority,
        dueDate: dueDate ? dayToIso(dueDate) : null,
        share,
      });
      onDone();
    } catch {
      // Keeps the dialog and what was typed; the request layer reports why.
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>
          {draft.sourceMessageId
            ? 'The task keeps a link back to this message.'
            : 'Add it to a project so it shows up on that board.'}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="gap-4 flex flex-col">
        <Field label="Title" required>
          <Input
            autoFocus
            required
            maxLength={200}
            value={title}
            placeholder="What needs doing?"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field label="Description" optional>
          <Textarea
            rows={4}
            value={description}
            placeholder="Add the details someone needs to pick this up"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Field
          label="Project"
          required
          hint={
            noProjects
              ? 'This workspace has no projects yet. Create one first.'
              : undefined
          }
        >
          {noProjects ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                onDone();
                if (slug) navigate(`/w/${slug}/projects?newProject=true`);
              }}
            >
              Create a project
            </Button>
          ) : (
            <AppSelect
              searchable
              value={projectId}
              onValueChange={setPickedProjectId}
              loading={projects.isLoading}
              aria-label="Project"
              placeholder="Choose a project"
              searchPlaceholder="Find a project"
              options={projectList.map((project) => ({
                value: project.id,
                label: project.name,
                icon: (
                  <ProjectGlyph
                    icon={project.icon}
                    iconColor={project.iconColor}
                    color={project.color}
                    size="xs"
                  />
                ),
              }))}
            />
          )}
        </Field>

        <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
          <Field label="Assignee">
            <AppSelect
              searchable
              value={assigneeId}
              onValueChange={setAssigneeId}
              loading={members.isLoading}
              aria-label="Assignee"
              searchPlaceholder="Find a person"
              options={assigneeOptions}
            />
          </Field>
          <Field label="Priority">
            <AppSelect
              value={priority}
              onValueChange={(value) => setPriority(value as TaskPriority)}
              aria-label="Priority"
              options={PRIORITIES}
            />
          </Field>
          <Field label="Due date">
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="No due date"
            />
          </Field>
        </div>
      </DialogBody>

      <DialogFooter className="sm:justify-between">
        {draft.roomId ? (
          <label className="gap-2 text-xs flex cursor-pointer items-center text-muted-foreground">
            <Checkbox
              checked={share}
              onCheckedChange={(checked) => setShare(checked === true)}
            />
            Post the task in this conversation
          </label>
        ) : (
          <span />
        )}
        <div className="gap-2 flex items-center">
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={pending}
            disabled={!canSubmit}
          >
            Create task
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
