import type { Task, TaskStatus } from '@org/types';
import {
  Button,
  DatePicker,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  Boxes,
  CalendarClock,
  CalendarDays,
  CircleDashed,
  CornerUpLeft,
  ExternalLink,
  Flag,
  Gauge,
  Layers,
  Repeat,
  Tag,
  Timer,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  describeDue,
  DUE_TEXT_CLASSES,
  dueCountdown,
  parseDay,
} from '../card-meta.js';
import { KanbanEstimatePicker } from '../KanbanEstimatePicker.js';
import { KanbanLabelPicker } from '../KanbanLabelPicker.js';
import { KanbanLeadPicker } from '../KanbanLeadPicker.js';
import { KanbanPriorityPicker } from '../KanbanPriorityPicker.js';
import {
  KanbanRefPicker,
  type KanbanRefPickerItem,
  type KanbanRefPickerProps,
} from '../KanbanRefPicker.js';
import { KanbanStatusPicker } from '../KanbanStatusPicker.js';
import {
  KanbanTaskLinkPicker,
  type KanbanTaskLinkOption,
} from '../KanbanTaskLinkPicker.js';
import { PriorityIcon, StatusIcon } from '../kanban-icons.js';
import { useKanbanLabels } from '../kanban-custom-store.js';
import { formatMinutes, parseDuration } from '../relation-meta.js';
import type { BoardMember, KanbanCard, Priority } from '../types.js';
import {
  PropertyGroup,
  PropertyRow,
  ValueAction,
  ValueButton,
} from './primitives.js';

const QUICK_MINUTES = [15, 30, 60, 120];

function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TimeLogPopover({
  minutes,
  disabled,
  onChange,
}: {
  minutes: number;
  disabled: boolean;
  onChange: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const parsed = parseDuration(text);

  const add = (added: number) => {
    onChange(minutes + added);
    setText('');
    setOpen(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (parsed) add(parsed);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ValueButton empty={minutes === 0} disabled={disabled}>
          {minutes > 0 ? formatMinutes(minutes) : 'Log time'}
        </ValueButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="text-sm flex items-center justify-between">
          <span className="font-semibold text-foreground">Log time</span>
          <span className="text-muted-foreground">
            {minutes > 0 ? `${formatMinutes(minutes)} so far` : 'Nothing yet'}
          </span>
        </div>
        <div className="gap-1 grid grid-cols-4">
          {QUICK_MINUTES.map((quick) => (
            <Button
              key={quick}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => add(quick)}
              className="h-8 px-0 text-xs"
            >
              +{formatMinutes(quick)}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="gap-1.5 flex">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="e.g. 1h 30m"
            aria-label="Time to add"
            className="h-8 text-sm flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!parsed}
            className="h-8"
          >
            Add
          </Button>
        </form>
        {minutes > 0 ? (
          <button
            type="button"
            onClick={() => {
              onChange(0);
              setOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear logged time
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export interface CardPropertiesPanelProps {
  card: KanbanCard;
  /** The full task; undefined while it loads. */
  detail: Task | undefined;
  statusId: TaskStatus;
  statusTitle: string;
  members: BoardMember[];
  teamItems: KanbanRefPickerItem[];
  epicItems: KanbanRefPickerItem[];
  moduleItems: KanbanRefPickerItem[];
  cycleItems: KanbanRefPickerItem[];
  linkableTasks: KanbanTaskLinkOption[];
  parentExcludeIds: string[];
  canEdit: boolean;
  onStatusChange: (status: TaskStatus) => void;
  onPriorityChange: (priority: Priority) => void;
  onAssigneesChange: (memberIds: string[]) => void;
  onStartDateChange: (day: string | null) => void;
  onDueDateChange: (day: string | null) => void;
  onToggleLabel: (label: string) => void;
  onReporterChange: (id: string | null) => void;
  onTimeChange: (minutes: number) => void;
  onEstimateChange: (estimate: number | null) => void;
  onTeamChange: (id: string | null) => void;
  onEpicChange: (id: string | null) => void;
  onModuleChange: (id: string | null) => void;
  onCycleChange: (id: string | null) => void;
  onParentChange: (id: string | null) => void;
  /** Absent when the viewer may not create, which hides "Create" in the menus. */
  onCreateEpic?: (name: string) => void;
  onCreateModule?: (name: string) => void;
  onCreateCycle?: (name: string) => void;
  onManageTeams: () => void;
  /** Absent outside a project, where its tabs don't exist. */
  onManageView?: (view: 'cycles' | 'modules') => void;
  /** Undefined when the parent isn't on this board. */
  onOpenParent?: () => void;
  onOpenMeeting: (meetingId: string) => void;
}

export function CardPropertiesPanel({
  card,
  detail,
  statusId,
  statusTitle,
  members,
  teamItems,
  epicItems,
  moduleItems,
  cycleItems,
  linkableTasks,
  parentExcludeIds,
  canEdit,
  onStatusChange,
  onPriorityChange,
  onAssigneesChange,
  onStartDateChange,
  onDueDateChange,
  onToggleLabel,
  onReporterChange,
  onTimeChange,
  onEstimateChange,
  onTeamChange,
  onEpicChange,
  onModuleChange,
  onCycleChange,
  onParentChange,
  onCreateEpic,
  onCreateModule,
  onCreateCycle,
  onManageTeams,
  onManageView,
  onOpenParent,
  onOpenMeeting,
}: CardPropertiesPanelProps) {
  const { colorOf } = useKanbanLabels();

  const assignees = card.memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));
  const assigneeLabel =
    assignees.length === 1
      ? (assignees[0].displayName ?? assignees[0].name)
      : `${assignees.length} people`;

  /* The member list answers first, so a new pick shows before the refetch. */
  const reporter =
    members.find((member) => member.id === detail?.reporterId) ??
    detail?.reporter ??
    undefined;

  const due = describeDue(card);
  const countdown = dueCountdown(card);

  /* Until the task loads, "No team" would be a claim we can't back up. */
  const loaded = (node: ReactNode) =>
    detail ? node : <Skeleton className="h-5 w-24" />;

  const refRow = ({
    label,
    icon,
    items,
    selectedId,
    onSelect,
    noneLabel,
    emptyMessage,
    ...picker
  }: {
    label: string;
    icon: typeof Boxes;
    items: KanbanRefPickerItem[];
    selectedId: string | null | undefined;
    onSelect: (id: string | null) => void;
    noneLabel: string;
    emptyMessage: string;
  } & Pick<
    KanbanRefPickerProps,
    'itemNoun' | 'onCreate' | 'minCreateLength' | 'manage'
  >) => {
    const selected = items.find((item) => item.id === selectedId);
    return (
      <PropertyRow label={label} icon={icon}>
        {loaded(
          <KanbanRefPicker
            {...picker}
            items={items}
            selectedId={selectedId}
            onSelect={onSelect}
            noneLabel={noneLabel}
            emptyMessage={emptyMessage}
            trigger={
              <ValueButton empty={!selected} disabled={!canEdit}>
                {selected?.color ? (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: selected.color }}
                  />
                ) : null}
                <span className="truncate">{selected?.label ?? 'None'}</span>
              </ValueButton>
            }
          />,
        )}
      </PropertyRow>
    );
  };

  const parent = detail?.parentId
    ? linkableTasks.find((task) => task.id === detail.parentId)
    : undefined;

  const manageView = (label: string, view: 'cycles' | 'modules') =>
    onManageView ? { label, onSelect: () => onManageView(view) } : undefined;

  return (
    <div className="@container space-y-4">
      <PropertyGroup title="Details">
        <PropertyRow label="Status" icon={CircleDashed}>
          <KanbanStatusPicker
            status={statusId}
            onStatusChange={onStatusChange}
            trigger={
              <ValueButton disabled={!canEdit}>
                <StatusIcon
                  status={statusId}
                  className="size-4"
                  showTooltip={false}
                />
                <span className="truncate">{statusTitle}</span>
              </ValueButton>
            }
          />
        </PropertyRow>

        <PropertyRow label="Priority" icon={Flag}>
          <KanbanPriorityPicker
            required
            priority={card.priority}
            onPriorityChange={(priority) =>
              onPriorityChange(priority as Priority)
            }
            trigger={
              <ValueButton disabled={!canEdit}>
                <PriorityIcon priority={card.priority} className="size-4" />
                <span className="capitalize">
                  {card.priority.toLowerCase()}
                </span>
              </ValueButton>
            }
          />
        </PropertyRow>

        <PropertyRow label="Assignees" icon={Users}>
          <KanbanLeadPicker
            align="start"
            selectedMemberIds={card.memberIds}
            currentMemberId={card.memberIds[0]}
            members={members}
            multiple
            onSelectMembers={onAssigneesChange}
            trigger={
              <ValueButton empty={assignees.length === 0} disabled={!canEdit}>
                {assignees.length > 0 ? (
                  <>
                    <UserAvatarGroup users={assignees} size="xs" />
                    <span className="truncate">{assigneeLabel}</span>
                  </>
                ) : (
                  'Unassigned'
                )}
              </ValueButton>
            }
          />
        </PropertyRow>

        <PropertyRow label="Reporter" icon={UserRound}>
          {loaded(
            <KanbanLeadPicker
              align="start"
              currentMemberId={detail?.reporterId}
              noneLabel="No reporter"
              members={members}
              onSelectMember={onReporterChange}
              trigger={
                <ValueButton empty={!reporter} disabled={!canEdit}>
                  {reporter ? (
                    <>
                      <UserAvatar
                        name={reporter.displayName ?? reporter.name}
                        src={reporter.avatarUrl}
                        seed={reporter.id}
                        size="xs"
                        indicator={false}
                      />
                      <span className="truncate">
                        {reporter.displayName ?? reporter.name}
                      </span>
                    </>
                  ) : (
                    'None'
                  )}
                </ValueButton>
              }
            />,
          )}
        </PropertyRow>

        <PropertyRow label="Tags" icon={Tag}>
          <div className="min-w-0 gap-1 py-1 flex flex-wrap items-center">
            {card.labels.map((label) => {
              const color = colorOf(label);
              return (
                <span
                  key={label}
                  className="h-6 gap-0.5 pl-2 text-xs font-medium inline-flex max-w-full items-center rounded-full border"
                  style={{
                    backgroundColor: `${color}18`,
                    borderColor: `${color}40`,
                    color,
                    paddingRight: canEdit ? '0.125rem' : '0.5rem',
                  }}
                >
                  <span className="truncate">{label}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onToggleLabel(label)}
                      aria-label={`Remove tag ${label}`}
                      className="size-5 inline-flex shrink-0 items-center justify-center rounded-full opacity-70 outline-none hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </span>
              );
            })}
            <KanbanLabelPicker
              selectedLabels={card.labels}
              onToggleLabel={onToggleLabel}
              trigger={
                <ValueButton
                  empty
                  disabled={!canEdit}
                  className={cn(card.labels.length > 0 && 'h-6 text-xs')}
                >
                  {card.labels.length > 0 ? 'Edit' : 'Add tag'}
                </ValueButton>
              }
            />
          </div>
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title="Schedule">
        <PropertyRow label="Start date" icon={CalendarDays}>
          <DatePicker
            value={card.startDate ?? ''}
            disabled={!canEdit}
            clearable
            maxDate={card.dueDate ? parseDay(card.dueDate) : undefined}
            onChange={(day) => onStartDateChange(day || null)}
            trigger={
              <ValueButton empty={!card.startDate} disabled={!canEdit}>
                <span className="truncate">
                  {card.startDate ? formatDay(card.startDate) : 'None'}
                </span>
              </ValueButton>
            }
          />
        </PropertyRow>

        <PropertyRow label="Due date" icon={CalendarClock}>
          <DatePicker
            value={card.dueDate ?? ''}
            disabled={!canEdit}
            clearable
            minDate={card.startDate ? parseDay(card.startDate) : undefined}
            onChange={(day) => onDueDateChange(day || null)}
            trigger={
              <ValueButton
                empty={!card.dueDate}
                disabled={!canEdit}
                title={due?.hint}
                className={cn(due && DUE_TEXT_CLASSES[due.tone])}
              >
                <span className="truncate">
                  {card.dueDate && due ? formatDay(card.dueDate) : 'None'}
                </span>
              </ValueButton>
            }
          />
          {countdown ? (
            <span
              className={cn(
                'text-xs font-medium shrink-0 @max-[18rem]:hidden',
                due && DUE_TEXT_CLASSES[due.tone],
              )}
            >
              {countdown}
            </span>
          ) : null}
        </PropertyRow>

        <PropertyRow label="Estimate" icon={Gauge}>
          {loaded(
            <KanbanEstimatePicker
              estimate={detail?.estimate}
              onEstimateChange={onEstimateChange}
              trigger={
                <ValueButton
                  empty={detail?.estimate == null}
                  disabled={!canEdit}
                >
                  {detail?.estimate != null ? `${detail.estimate} pts` : 'None'}
                </ValueButton>
              }
            />,
          )}
        </PropertyRow>

        <PropertyRow label="Time logged" icon={Timer}>
          {loaded(
            <TimeLogPopover
              minutes={detail?.timeSpent ?? 0}
              disabled={!canEdit}
              onChange={onTimeChange}
            />,
          )}
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title="Planning">
        {refRow({
          label: 'Team',
          icon: UsersRound,
          items: teamItems,
          selectedId: detail?.teamId,
          onSelect: onTeamChange,
          noneLabel: 'No team',
          emptyMessage: 'No teams in this workspace yet',
          manage: { label: 'Manage teams', onSelect: onManageTeams },
        })}
        {refRow({
          label: 'Epic',
          icon: Layers,
          items: epicItems,
          selectedId: detail?.epicId,
          onSelect: onEpicChange,
          noneLabel: 'No epic',
          emptyMessage: 'No epics in this project yet',
          itemNoun: 'epic',
          onCreate: onCreateEpic,
          minCreateLength: 2,
          manage: manageView('Manage epics', 'modules'),
        })}
        {refRow({
          label: 'Module',
          icon: Boxes,
          items: moduleItems,
          selectedId: detail?.moduleId,
          onSelect: onModuleChange,
          noneLabel: 'No module',
          emptyMessage: 'No modules in this project yet',
          itemNoun: 'module',
          onCreate: onCreateModule,
          minCreateLength: 2,
          manage: manageView('Manage modules', 'modules'),
        })}
        {refRow({
          label: 'Cycle',
          icon: Repeat,
          items: cycleItems,
          selectedId: detail?.cycleId,
          onSelect: onCycleChange,
          noneLabel: 'No cycle',
          emptyMessage: 'No cycles in this project yet',
          itemNoun: 'cycle',
          onCreate: onCreateCycle,
          manage: manageView('Manage cycles', 'cycles'),
        })}

        <PropertyRow label="Parent" icon={CornerUpLeft}>
          {loaded(
            <>
              <KanbanTaskLinkPicker
                options={linkableTasks}
                excludeIds={parentExcludeIds}
                onSelect={(task) => onParentChange(task.id)}
                placeholder="Search tasks..."
                emptyMessage="No other tasks in this project"
                trigger={
                  <ValueButton empty={!detail?.parentId} disabled={!canEdit}>
                    <span className="truncate">
                      {detail?.parentId
                        ? (parent?.identifier ??
                          parent?.title ??
                          detail.parent?.title ??
                          'Parent task')
                        : 'None'}
                    </span>
                  </ValueButton>
                }
              />
              {detail?.parentId && onOpenParent ? (
                <ValueAction
                  icon={ExternalLink}
                  onClick={onOpenParent}
                  aria-label="Open parent"
                  title="Open parent"
                />
              ) : null}
              {detail?.parentId && canEdit ? (
                <ValueAction
                  icon={X}
                  onClick={() => onParentChange(null)}
                  aria-label="Remove parent"
                  title="Remove parent"
                />
              ) : null}
            </>,
          )}
        </PropertyRow>
      </PropertyGroup>

      <div className="space-y-1 pt-4 text-xs border-t border-border/60 text-muted-foreground">
        <p>Created {formatRelative(card.createdAt)}</p>
        {detail ? <p>Updated {formatRelative(detail.updatedAt)}</p> : null}
        {detail?.completedAt ? (
          <p>Completed {formatRelative(detail.completedAt)}</p>
        ) : null}
        {detail?.meeting ? (
          <p>
            From the meeting{' '}
            <button
              type="button"
              onClick={() => detail.meeting && onOpenMeeting(detail.meeting.id)}
              className="font-medium rounded-sm text-foreground outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring"
            >
              {detail.meeting.title}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
