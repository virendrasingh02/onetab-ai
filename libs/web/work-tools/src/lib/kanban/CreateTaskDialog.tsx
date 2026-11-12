import { TaskPriority, TaskStatus } from '@org/types';
import {
  AppSelect,
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  UserAvatarGroup,
} from '@org/ui';
import type { CreateTaskInput } from '@org/validation';
import { UserPlus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PRIORITY_META } from './card-meta.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import { KanbanStatusPicker } from './KanbanStatusPicker.js';
import { dayToIso } from './server-board.js';
import { useWorkflowStates } from './task-states.js';
import type { BoardMember, KanbanList } from './types.js';

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  /** The project's columns, in board order. */
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  members: BoardMember[];
  /** Workflow state id the task starts in. */
  defaultStatus?: string;
  /** Rejects on failure, which keeps the dialog and what was typed. */
  onCreate: (input: CreateTaskInput) => Promise<unknown>;
}

const PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.URGENT,
  TaskPriority.HIGH,
  TaskPriority.MEDIUM,
  TaskPriority.LOW,
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectName,
  lists,
  members,
  defaultStatus = TaskStatus.TODO,
  onCreate,
}: CreateTaskDialogProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>(defaultStatus);
  const { patchFor } = useWorkflowStates();
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [createMore, setCreateMore] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setStatus(defaultStatus);
    setPriority(TaskPriority.MEDIUM);
    setMemberIds([]);
    setDueDate(undefined);
  }, [open, defaultStatus]);

  const assigned = memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name || pending) return;

    setPending(true);
    try {
      await onCreate({
        title: name,
        description: description.trim() || null,
        ...patchFor(status),
        priority,
        assigneeId: memberIds[0] ?? null,
        assigneeIds: memberIds,
        dueDate: dueDate ? dayToIso(dueDate) : null,
      });
      if (createMore) {
        // Keep the column and people: a burst of tasks usually shares them.
        setTitle('');
        setDescription('');
        titleRef.current?.focus();
      } else {
        onOpenChange(false);
      }
    } catch {
      // The app's mutation handler has shown the error.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {projectName ? `New task in ${projectName}` : 'New task'}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="gap-4 flex flex-col">
            <Field label="Title" required>
              <Input
                ref={titleRef}
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
                rows={3}
                value={description}
                placeholder="Add the details someone needs to pick this up"
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <div className="gap-3 grid grid-cols-2">
              <Field label="Status">
                <KanbanStatusPicker
                  variant="field"
                  status={status}
                  onStatusChange={setStatus}
                />
              </Field>

              <Field label="Priority">
                <AppSelect
                  value={priority}
                  onValueChange={(value) => setPriority(value as TaskPriority)}
                  aria-label="Priority"
                  options={PRIORITY_ORDER.map((value) => ({
                    value,
                    label: PRIORITY_META[value].label,
                  }))}
                />
              </Field>

              <Field label="Assignees">
                <KanbanLeadPicker
                  selectedMemberIds={memberIds}
                  members={members}
                  multiple
                  align="start"
                  onSelectMembers={setMemberIds}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className="font-normal w-full justify-start"
                    >
                      {assigned.length > 0 ? (
                        <>
                          <UserAvatarGroup users={assigned} size="xs" />
                          <span className="truncate">
                            {assigned.length === 1
                              ? assigned[0].name
                              : `${assigned.length} people`}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        </>
                      )}
                    </Button>
                  }
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
            <label className="gap-2 text-xs flex cursor-pointer items-center text-muted-foreground">
              <Checkbox
                checked={createMore}
                onCheckedChange={(checked) => setCreateMore(checked === true)}
              />
              Create another
            </label>
            <div className="gap-2 flex items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={pending}
                disabled={!title.trim()}
              >
                Create task
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
