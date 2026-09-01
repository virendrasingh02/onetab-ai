import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import type { Meeting } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  MultiUserSelector,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
  type UserSelectorMember,
} from '@org/ui';
import { createMeetingSchema, type CreateMeetingInput } from '@org/validation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  useMeetingMutations,
  useProjects,
  useWorkspaceMembers,
} from '../use-work-tools.js';

export interface MeetingScheduleDialogProps {
  workspaceId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ edit that meeting; absent ⇒ schedule a new one. */
  meeting?: Meeting | null;
  /** Called with the meeting id after a successful create/update. */
  onSaved?: (meetingId: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO string → the `YYYY-MM-DDTHH:mm` a `datetime-local` input wants. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value → an ISO string with offset for the API. */
function fromLocalInput(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Next top of the hour, and one hour after it. */
function defaultWindow(): { startAt: string; endAt: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function MeetingScheduleDialog({
  workspaceId,
  open,
  onOpenChange,
  meeting,
  onSaved,
}: MeetingScheduleDialogProps) {
  const isEdit = !!meeting;
  const { create, update } = useMeetingMutations(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const projects = useProjects(workspaceId);

  // One resolver for both modes: an edit always has title/start/end prefilled,
  // so `createMeetingSchema`'s required fields are never a problem there.
  const form = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      title: '',
      description: '',
      agenda: '',
      location: '',
      ...defaultWindow(),
      projectId: null,
      participantIds: [],
      addToCalendar: true,
    },
  });

  // Load the meeting being edited, or reset to a fresh draft when reopened.
  useEffect(() => {
    if (!open) return;
    if (meeting) {
      form.reset({
        title: meeting.title,
        description: meeting.description ?? '',
        agenda: meeting.agenda ?? '',
        location: meeting.location ?? '',
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        projectId: meeting.projectId ?? null,
        participantIds: [],
        addToCalendar: false,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        agenda: '',
        location: '',
        ...defaultWindow(),
        projectId: null,
        participantIds: [],
        addToCalendar: true,
      });
    }
    create.reset();
    update.reset();
    // form + mutations are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting?.id]);

  const memberOptions: UserSelectorMember[] = (members.data ?? [])
    .filter((m) => m.status === 'ACTIVE')
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      email: m.email ?? null,
    }));

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isEdit && meeting) {
        const saved = await update.mutateAsync({
          id: meeting.id,
          input: {
            title: values.title,
            description: values.description ?? null,
            agenda: values.agenda ?? null,
            location: values.location ?? null,
            startAt: values.startAt,
            endAt: values.endAt,
            projectId: values.projectId ?? null,
          },
        });
        toast.success('Meeting updated');
        onOpenChange(false);
        onSaved?.(saved.id);
      } else {
        const saved = await create.mutateAsync(values);
        toast.success('Meeting scheduled', {
          description: `"${saved.title}" is on the calendar.`,
        });
        onOpenChange(false);
        onSaved?.(saved.id);
      }
    } catch {
      // Surfaced by <FormError> / field errors.
    }
  });

  const pending =
    form.formState.isSubmitting || create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? 'Edit meeting' : 'Schedule a meeting'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Changes are shared with everyone on the invite.'
                : 'Invite people, set an agenda, and it lands on the workspace calendar.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <div className="space-y-4 px-6 py-4 max-h-[60vh] overflow-y-auto">
              <FormError
                error={formErrorMessage(create.error ?? update.error)}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        placeholder="Weekly product sync"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="gap-3 sm:grid-cols-2 grid">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starts</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={toLocalInput(field.value ?? '')}
                          onChange={(e) =>
                            field.onChange(fromLocalInput(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ends</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={toLocalInput(field.value ?? '')}
                          onChange={(e) =>
                            field.onChange(fromLocalInput(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Join link or location (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="https://meet… or “Room 4”"
                      />
                    </FormControl>
                    <FormDescription>
                      A URL here becomes the “Join” button on the meeting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project (optional)</FormLabel>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(v) =>
                        field.onChange(v === 'none' ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {(projects.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Action items from the meeting are filed here.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agenda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agenda (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={4}
                        placeholder={'1. …\n2. …'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEdit && (
                <>
                  <FormField
                    control={form.control}
                    name="participantIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participants</FormLabel>
                        <FormControl>
                          <div>
                            <MultiUserSelector
                              members={memberOptions}
                              selectedIds={field.value ?? []}
                              onChange={(ids) => field.onChange(ids)}
                              label="Add participants"
                              searchPlaceholder="Search members…"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          You’re added automatically as the organizer.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="addToCalendar"
                    render={({ field }) => (
                      <FormItem>
                        <div className="gap-4 p-3 flex items-start justify-between rounded-lg border border-border bg-surface-raised">
                          <div>
                            <FormLabel>Add to the calendar</FormLabel>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Also create a calendar event so it shows on the
                              schedule.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                              aria-label="Add to calendar"
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          </Form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? 'Save changes' : 'Schedule meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
