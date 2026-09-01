import type { MeetingDetail, MeetingRsvp } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  MultiUserSelector,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Spinner,
  Textarea,
  toast,
  UserAvatar,
  usePromptDialog,
  type UserSelectorMember,
} from '@org/ui';
import { cn, formatDateTime } from '@org/utils';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Link2,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';
import {
  useMeeting,
  useMeetingMutations,
  useWorkspaceMembers,
} from '../use-work-tools.js';

export interface MeetingDetailSheetProps {
  workspaceId: string | undefined;
  meetingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the edit dialog for this meeting. */
  onEdit: (meeting: MeetingDetail) => void;
}

function isJoinUrl(location: string | null): string | null {
  const value = location?.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

const RSVP_BADGE: Record<
  MeetingRsvp,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'neutral' }
> = {
  ACCEPTED: { label: 'Going', variant: 'success' },
  DECLINED: { label: 'Declined', variant: 'destructive' },
  TENTATIVE: { label: 'Maybe', variant: 'warning' },
  NEEDS_ACTION: { label: 'No reply', variant: 'neutral' },
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'primary' | 'neutral' | 'destructive' | 'success' }
> = {
  SCHEDULED: { label: 'Scheduled', variant: 'primary' },
  LIVE: { label: 'Live', variant: 'destructive' },
  ENDED: { label: 'Ended', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

export function MeetingDetailSheet({
  workspaceId,
  meetingId,
  open,
  onOpenChange,
  onEdit,
}: MeetingDetailSheetProps) {
  const query = useMeeting(workspaceId, open ? meetingId : null);
  const m = useMeetingMutations(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const prompts = usePromptDialog();

  const [noteDraft, setNoteDraft] = useState('');
  const [decisionDraft, setDecisionDraft] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionAssignee, setActionAssignee] = useState<string>('none');

  const meeting = query.data;

  const memberOptions: UserSelectorMember[] = useMemo(
    () =>
      (members.data ?? [])
        .filter((row) => row.status === 'ACTIVE')
        .map((row) => ({
          id: row.user.id,
          name: row.user.name,
          displayName: row.user.displayName,
          avatarUrl: row.user.avatarUrl,
          email: row.email ?? null,
        })),
    [members.data],
  );

  const participantIds = new Set(
    (meeting?.participants ?? []).map((p) => p.userId),
  );
  const invitable = memberOptions.filter((o) => !participantIds.has(o.id));

  const close = () => onOpenChange(false);
  const meetingId_ = meeting?.id ?? '';

  const handleCancel = async () => {
    if (!meeting) return;
    const ok = await prompts.confirmAction({
      title: 'Cancel this meeting?',
      description: `Everyone on "${meeting.title}" is told it's off.`,
      confirmLabel: 'Cancel meeting',
    });
    if (ok) {
      await m.cancel.mutateAsync(meeting.id);
      toast.success('Meeting cancelled');
    }
  };

  const handleDelete = async () => {
    if (!meeting) return;
    const ok = await prompts.confirmAction({
      title: 'Delete this meeting?',
      description: 'It moves to the trash and drops off the calendar.',
      confirmLabel: 'Delete meeting',
    });
    if (ok) {
      await m.remove.mutateAsync(meeting.id);
      toast.success('Meeting deleted');
      close();
    }
  };

  const handleEnd = async () => {
    if (!meeting) return;
    await m.end.mutateAsync(meeting.id);
    toast.success('Meeting ended');
  };

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body || !meeting) return;
    await m.addNote.mutateAsync({ id: meeting.id, input: { body } });
    setNoteDraft('');
  };

  const addDecision = async () => {
    const text = decisionDraft.trim();
    if (!text || !meeting) return;
    await m.addDecision.mutateAsync({ id: meeting.id, input: { text } });
    setDecisionDraft('');
  };

  const addActionItem = async () => {
    const title = actionTitle.trim();
    if (!title || !meeting) return;
    await m.addActionItem.mutateAsync({
      id: meeting.id,
      input: {
        title,
        assigneeId: actionAssignee === 'none' ? null : actionAssignee,
      },
    });
    setActionTitle('');
    setActionAssignee('none');
    toast.success('Action item added to tasks');
  };

  const joinUrl = isJoinUrl(meeting?.location ?? null);
  const statusBadge = meeting ? STATUS_BADGE[meeting.status] : null;
  const readOnly =
    meeting?.status === 'CANCELLED' || meeting?.status === 'ENDED';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 sm:max-w-lg flex w-full flex-col"
      >
        {query.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : query.isError || !meeting ? (
          <div className="p-6 flex flex-1 items-center justify-center">
            <EmptyState
              icon={<TriangleAlert />}
              title="Could not load the meeting"
              description="It may have been deleted."
              action={
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-2 px-5 py-4 border-b border-border">
              <div className="gap-2 flex items-start justify-between">
                <div className="min-w-0">
                  <SheetTitle className="text-base truncate">
                    {meeting.title}
                  </SheetTitle>
                  <SheetDescription className="gap-2 mt-1 text-xs flex flex-wrap items-center">
                    <span className="gap-1 flex items-center">
                      <CalendarClock className="size-3.5" />
                      {formatDateTime(meeting.startAt)} –{' '}
                      {formatDateTime(meeting.endAt)}
                    </span>
                    {statusBadge ? (
                      <Badge variant={statusBadge.variant}>
                        {statusBadge.label}
                      </Badge>
                    ) : null}
                    {meeting.project ? (
                      <Badge variant="outline">{meeting.project.name}</Badge>
                    ) : null}
                  </SheetDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Meeting actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onSelect={() => onEdit(meeting)}
                      disabled={readOnly}
                    >
                      <Pencil className="size-4" aria-hidden />
                      Edit meeting
                    </DropdownMenuItem>
                    {joinUrl ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          void navigator.clipboard.writeText(joinUrl);
                          toast.success('Join link copied');
                        }}
                      >
                        <Link2 className="size-4" aria-hidden />
                        Copy join link
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() => void handleEnd()}
                      disabled={readOnly}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      Mark as ended
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void handleCancel()}
                      disabled={meeting.status === 'CANCELLED'}
                    >
                      <X className="size-4" aria-hidden />
                      Cancel meeting
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDelete()}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {joinUrl ? (
                <Button asChild size="sm" className="w-full">
                  <a href={joinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    Join meeting
                  </a>
                </Button>
              ) : null}
            </SheetHeader>

            <div className="min-h-0 p-5 space-y-6 flex-1 overflow-y-auto">
              {meeting.description ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {meeting.description}
                </p>
              ) : null}

              {meeting.agenda ? (
                <section className="space-y-2">
                  <SectionTitle icon={<ScrollText />}>Agenda</SectionTitle>
                  <p className="text-sm p-3 rounded-lg border border-border bg-surface-muted/40 whitespace-pre-wrap">
                    {meeting.agenda}
                  </p>
                </section>
              ) : null}

              {/* Participants */}
              <section className="space-y-2">
                <SectionTitle icon={<UserPlus />}>
                  Participants
                  <span className="text-muted-foreground">
                    {' '}
                    · {meeting._count.participants}
                  </span>
                </SectionTitle>
                <ul className="space-y-1.5">
                  {meeting.participants.map((p) => (
                    <li
                      key={p.id}
                      className="gap-2 flex items-center justify-between"
                    >
                      <div className="min-w-0 gap-2 flex items-center">
                        <UserAvatar
                          name={p.user.displayName ?? p.user.name}
                          src={p.user.avatarUrl}
                          seed={p.user.id}
                          size="xs"
                        />
                        <span className="text-sm truncate">
                          {p.user.displayName ?? p.user.name}
                        </span>
                        {p.role === 'ORGANIZER' ? (
                          <Badge variant="neutral">Organizer</Badge>
                        ) : (
                          <Badge variant={RSVP_BADGE[p.rsvp].variant}>
                            {RSVP_BADGE[p.rsvp].label}
                          </Badge>
                        )}
                      </div>
                      {p.role !== 'ORGANIZER' && !readOnly ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${p.user.name}`}
                          loading={
                            m.removeParticipant.isPending &&
                            m.removeParticipant.variables?.userId === p.userId
                          }
                          onClick={() =>
                            m.removeParticipant.mutate({
                              id: meetingId_,
                              userId: p.userId,
                            })
                          }
                        >
                          <X className="size-3.5" />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!readOnly && invitable.length > 0 ? (
                  <MultiUserSelector
                    members={invitable}
                    selectedIds={[]}
                    onChange={(ids) => {
                      if (ids.length > 0) {
                        m.addParticipants.mutate({
                          id: meetingId_,
                          input: { userIds: ids },
                        });
                      }
                    }}
                    label="Add people"
                    searchPlaceholder="Search members…"
                  />
                ) : null}
              </section>

              {/* Notes */}
              <section className="space-y-2">
                <SectionTitle icon={<ScrollText />}>
                  Notes
                  <span className="text-muted-foreground">
                    {' '}
                    · {meeting._count.notes}
                  </span>
                </SectionTitle>
                {meeting.notes.length === 0 ? (
                  <p className="text-xs text-subtle">No notes yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {meeting.notes.map((note) => (
                      <li
                        key={note.id}
                        className="group p-2.5 rounded-lg border border-border"
                      >
                        <div className="gap-2 flex items-center justify-between">
                          <span className="gap-1.5 flex items-center text-[11px] text-muted-foreground">
                            <UserAvatar
                              name={note.author.displayName ?? note.author.name}
                              src={note.author.avatarUrl}
                              seed={note.author.id}
                              size="xs"
                            />
                            {note.author.displayName ?? note.author.name} ·{' '}
                            {formatDateTime(note.createdAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100"
                            aria-label="Delete note"
                            onClick={() =>
                              m.deleteNote.mutate({
                                id: meetingId_,
                                noteId: note.id,
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {note.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gap-2 flex items-start">
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={2}
                    placeholder="Add a note…"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => void addNote()}
                    loading={m.addNote.isPending}
                    disabled={!noteDraft.trim()}
                  >
                    Add
                  </Button>
                </div>
              </section>

              {/* Decisions */}
              <section className="space-y-2">
                <SectionTitle icon={<CheckCircle2 />}>
                  Decisions
                  <span className="text-muted-foreground">
                    {' '}
                    · {meeting._count.decisions}
                  </span>
                </SectionTitle>
                {meeting.decisions.length === 0 ? (
                  <p className="text-xs text-subtle">Nothing decided yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {meeting.decisions.map((d) => (
                      <li
                        key={d.id}
                        className="group gap-2 p-2.5 flex items-start justify-between rounded-lg border border-border"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">{d.text}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {d.author.displayName ?? d.author.name} ·{' '}
                            {formatDateTime(d.createdAt)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100"
                          aria-label="Delete decision"
                          onClick={() =>
                            m.deleteDecision.mutate({
                              id: meetingId_,
                              decisionId: d.id,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gap-2 flex items-center">
                  <Input
                    value={decisionDraft}
                    onChange={(e) => setDecisionDraft(e.target.value)}
                    placeholder="Record a decision…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void addDecision();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => void addDecision()}
                    loading={m.addDecision.isPending}
                    disabled={!decisionDraft.trim()}
                  >
                    Add
                  </Button>
                </div>
              </section>

              {/* Action items */}
              <section className="space-y-2">
                <SectionTitle icon={<ListTodo />}>
                  Action items
                  <span className="text-muted-foreground">
                    {' '}
                    · {meeting._count.actionItems}
                  </span>
                </SectionTitle>
                {meeting.actionItems.length === 0 ? (
                  <p className="text-xs text-subtle">
                    No action items. Add one and it becomes a task.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {meeting.actionItems.map((task) => (
                      <li
                        key={task.id}
                        className="gap-2 p-2.5 flex items-center rounded-lg border border-border"
                      >
                        <StatusIcon status={task.status} className="size-4" />
                        <span
                          className={cn(
                            'text-sm flex-1 truncate',
                            task.status === 'DONE' &&
                              'text-muted-foreground line-through',
                          )}
                        >
                          {task.identifier ? (
                            <span className="mr-1.5 text-[11px] text-muted-foreground">
                              {task.identifier}
                            </span>
                          ) : null}
                          {task.title}
                        </span>
                        {task.assignee ? (
                          <UserAvatar
                            name={
                              task.assignee.displayName ?? task.assignee.name
                            }
                            src={task.assignee.avatarUrl}
                            seed={task.assignee.id}
                            size="xs"
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gap-2 flex items-center">
                  <Input
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder="New action item…"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void addActionItem();
                    }}
                  />
                  <Select
                    value={actionAssignee}
                    onValueChange={setActionAssignee}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {memberOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.displayName ?? o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => void addActionItem()}
                    loading={m.addActionItem.isPending}
                    disabled={!actionTitle.trim()}
                    leadingIcon={<Plus className="size-3.5" />}
                  >
                    Add
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="gap-1.5 text-xs font-semibold [&_svg]:size-3.5 flex items-center text-foreground [&_svg]:text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}
