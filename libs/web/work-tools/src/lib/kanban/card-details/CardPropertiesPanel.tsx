import type { Task, TaskStatus } from '@org/types';
import {
  Button,
  DatePicker,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  UserAvatarGroup,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  Boxes,
  CalendarClock,
  CalendarDays,
  CircleDashed,
  CornerUpLeft,
  Flag,
  Gauge,
  Layers,
  Repeat,
  Tag,
  Timer,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { describeDue, DUE_TONE_CLASSES, parseDay } from '../card-meta.js';
import { KanbanEstimatePicker } from '../KanbanEstimatePicker.js';
import { KanbanLabelPicker } from '../KanbanLabelPicker.js';
import { KanbanLeadPicker } from '../KanbanLeadPicker.js';
import { KanbanPriorityPicker } from '../KanbanPriorityPicker.js';
import {
  KanbanRefPicker,
  type KanbanRefPickerItem,
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
import { PropertyRow, ValueButton } from './primitives.js';

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
      <PopoverContent align="start" className="w-64 space-y-2.5 p-3">
        <div className="text-xs flex items-center justify-between">
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
              className="h-7 px-0 text-xs"
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
            className="h-7 text-xs flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!parsed}
            className="h-7 text-xs"
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
  onTimeChange: (minutes: number) => void;
  onEstimateChange: (estimate: number | null) => void;
  onTeamChange: (id: string | null) => void;
  onEpicChange: (id: string | null) => void;
  onModuleChange: (id: string | null) => void;
  onCycleChange: (id: string | null) => void;
  onParentChange: (id: string | null) => void;
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
  onTimeChange,
  onEstimateChange,
  onTeamChange,
  onEpicChange,
  onModuleChange,
  onCycleChange,
  onParentChange,
}: CardPropertiesPanelProps) {
  const { colorOf } = useKanbanLabels();

  const assignees = card.memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));
  const assigneeLabel =
    assignees.length === 1
      ? (assignees[0].displayName ?? assignees[0].name)
      : `${assignees.length} people`;

  const due = describeDue(card);

  /* Until the task loads, "No team" would be a claim we can't back up. */
  const loaded = (node: ReactNode) =>
    detail ? node : <Skeleton className="h-4 w-20" />;

  const refRow = (
    label: string,
    icon: typeof Boxes,
    items: KanbanRefPickerItem[],
    selectedId: string | null | undefined,
    onSelect: (id: string | null) => void,
    noneLabel: string,
    emptyMessage: string,
  ) => {
    const selected = items.find((item) => item.id === selectedId);
    return (
      <PropertyRow label={label} icon={icon}>
        {loaded(
          <KanbanRefPicker
            items={items}
            selectedId={selectedId}
            onSelect={onSelect}
            noneLabel={noneLabel}
            emptyMessage={emptyMessage}
            trigger={
              <ValueButton empty={!selected} disabled={!canEdit}>
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

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-0.5">
        <PropertyRow label="Status" icon={CircleDashed}>
          <KanbanStatusPicker
            status={statusId}
            onStatusChange={onStatusChange}
            trigger={
              <ValueButton disabled={!canEdit}>
                <StatusIcon
                  status={statusId}
                  className="size-3.5"
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
                <PriorityIcon priority={card.priority} className="size-3.5" />
                <span className="capitalize">
                  {card.priority.toLowerCase()}
                </span>
              </ValueButton>
            }
          />
        </PropertyRow>

        <PropertyRow label="Assignees" icon={Users}>
          <KanbanLeadPicker
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

        <PropertyRow label="Start date" icon={CalendarDays}>
          <DatePicker
            value={card.startDate ?? ''}
            disabled={!canEdit}
            clearable
            maxDate={card.dueDate ? parseDay(card.dueDate) : undefined}
            onChange={(day) => onStartDateChange(day || null)}
            trigger={
              <ValueButton empty={!card.startDate} disabled={!canEdit}>
                {card.startDate ? formatDay(card.startDate) : 'None'}
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
                className={cn(
                  due && 'border',
                  due && DUE_TONE_CLASSES[due.tone],
                )}
              >
                {card.dueDate && due ? formatDay(card.dueDate) : 'None'}
              </ValueButton>
            }
          />
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
      </div>

      <div className="pt-3 border-t border-border/60">
        <PropertyRow label="Tags" icon={Tag}>
          <div className="min-w-0 gap-1 flex flex-wrap items-center">
            {card.labels.map((label) => {
              const color = colorOf(label);
              return (
                <span
                  key={label}
                  className="px-2 leading-5 font-medium inline-flex max-w-full items-center truncate rounded-full border text-[11px]"
                  style={{
                    backgroundColor: `${color}18`,
                    borderColor: `${color}40`,
                    color,
                  }}
                >
                  {label}
                </span>
              );
            })}
            <KanbanLabelPicker
              selectedLabels={card.labels}
              onToggleLabel={onToggleLabel}
              trigger={
                <ValueButton empty disabled={!canEdit}>
                  {card.labels.length > 0 ? 'Edit' : 'Add tag'}
                </ValueButton>
              }
            />
          </div>
        </PropertyRow>
      </div>

      <div className="space-y-0.5 pt-3 border-t border-border/60">
        {refRow(
          'Team',
          UsersRound,
          teamItems,
          detail?.teamId,
          onTeamChange,
          'No team',
          'No teams in this workspace yet',
        )}
        {refRow(
          'Epic',
          Layers,
          epicItems,
          detail?.epicId,
          onEpicChange,
          'No epic',
          'No epics in this project yet',
        )}
        {refRow(
          'Module',
          Boxes,
          moduleItems,
          detail?.moduleId,
          onModuleChange,
          'No module',
          'No modules in this project yet',
        )}
        {refRow(
          'Cycle',
          Repeat,
          cycleItems,
          detail?.cycleId,
          onCycleChange,
          'No cycle',
          'No cycles in this project yet',
        )}

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
              {detail?.parentId && canEdit ? (
                <button
                  type="button"
                  onClick={() => onParentChange(null)}
                  aria-label="Remove parent"
                  className="rounded p-0.5 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </>,
          )}
        </PropertyRow>
      </div>

      <div className="space-y-0.5 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
        <p>
          Created {formatRelative(card.createdAt)}
          {detail?.reporter
            ? ` by ${detail.reporter.displayName ?? detail.reporter.name}`
            : ''}
        </p>
        {detail ? <p>Updated {formatRelative(detail.updatedAt)}</p> : null}
        {detail?.meeting ? (
          <p>From the meeting {detail.meeting.title}</p>
        ) : null}
      </div>
    </div>
  );
}
