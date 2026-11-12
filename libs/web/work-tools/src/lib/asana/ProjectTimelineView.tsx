import {
  Badge,
  Button,
  DatePicker,
  EntityContextMenu,
  SkeletonList,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { TaskStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  CalendarOff,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { parseDay, todayISO } from '../kanban/card-meta.js';
import { useKanbanDisplayStore } from '../kanban/kanban-display-store.js';
import { StatusIcon } from '../kanban/kanban-icons.js';
import type { BoardAction } from '../kanban/server-board.js';
import { useBoardTaskActions } from '../kanban/task-actions.js';
import { statusColor, useKnownWorkflowStates } from '../kanban/task-states.js';
import {
  PROJECT_VIEW_PADDING,
  TaskTicket,
  TaskViewEmpty,
} from '../kanban/task-view-parts.js';
import type { BoardState, KanbanCard, KanbanList } from '../kanban/types.js';

interface ProjectTimelineViewProps {
  workspaceId?: string;
  /** The board's writes — the same ones the board and list views use. */
  dispatch: (action: BoardAction) => void;
  board: BoardState;
  onSelectCard: (card: KanbanCard, listId: string) => void;
  isLoading?: boolean;
  /** True when search or filters are narrowing the board. */
  filtered?: boolean;
  onClearFilters?: () => void;
  onAddTask?: () => void;
}

/** Days on screen; the arrows page by a week. */
const SPAN = 21;
const DAY_MS = 86_400_000;

type Phase = 'done' | 'active' | 'upcoming' | 'cancelled';

/**
 * Bars paint in their status's own colour — the same one the board column,
 * status icon and pickers use — tinted so the title stays readable.
 */
function barStyle(color: string): CSSProperties {
  return {
    backgroundColor: `color-mix(in srgb, ${color} 16%, var(--card))`,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
    color: `color-mix(in srgb, ${color} 70%, var(--foreground))`,
  };
}

function phaseOf(list: KanbanList): Phase {
  switch (list.category) {
    case TaskStatus.DONE:
      return 'done';
    case TaskStatus.CANCELLED:
      return 'cancelled';
    case TaskStatus.IN_PROGRESS:
    case TaskStatus.IN_REVIEW:
      return 'active';
    default:
      return 'upcoming';
  }
}

function isoDay(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `from` to `to` (both local days). */
function dayDiff(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

interface Row {
  card: KanbanCard;
  list: KanbanList;
  phase: Phase;
  start: Date;
  end: Date;
}

export function ProjectTimelineView({
  workspaceId,
  dispatch,
  board,
  onSelectCard,
  isLoading = false,
  filtered = false,
  onClearFilters,
  onAddTask,
}: ProjectTimelineViewProps) {
  // The window opens a few days before today so overdue work stays in view.
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 3);
    return d;
  });
  const [showUndated, setShowUndated] = useState(false);
  const workflow = useKnownWorkflowStates();
  const show = useKanbanDisplayStore((state) => state.card);
  // The board card's own menu, on right-click of any row.
  const taskActions = useBoardTaskActions({
    workspaceId,
    lists: board.lists,
    members: board.members,
    dispatch,
    onOpen: onSelectCard,
  });

  const days = useMemo(
    () =>
      Array.from({ length: SPAN }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [rangeStart],
  );
  const todayStr = todayISO();
  const todayIndex = days.findIndex((d) => isoDay(d) === todayStr);

  const { rows, undated, outside, totalCards } = useMemo(() => {
    const scheduled: Row[] = [];
    const noDates: Array<{ card: KanbanCard; list: KanbanList }> = [];
    let total = 0;
    for (const list of board.lists) {
      for (const card of list.cards) {
        total++;
        const first = card.startDate ?? card.dueDate;
        const last = card.dueDate ?? card.startDate;
        if (!first || !last) {
          noDates.push({ card, list });
          continue;
        }
        let start = parseDay(first);
        let end = parseDay(last);
        if (end < start) [start, end] = [end, start];
        scheduled.push({ card, list, phase: phaseOf(list), start, end });
      }
    }
    const rangeEnd = days[days.length - 1];
    const visible = scheduled
      .filter((r) => r.end >= days[0] && r.start <= rangeEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return {
      rows: visible,
      undated: noDates,
      outside: scheduled.length - visible.length,
      totalCards: total,
    };
  }, [board.lists, days]);

  const shift = (deltaDays: number) =>
    setRangeStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + deltaDays);
      return d;
    });
  const goToday = () => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 3);
    setRangeStart(d);
  };

  if (isLoading) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <SkeletonList rows={6} />
      </div>
    );
  }

  if (totalCards === 0) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <TaskViewEmpty
          filtered={filtered}
          onClearFilters={onClearFilters}
          onAddTask={onAddTask}
        />
      </div>
    );
  }

  const rangeLabel = `${days[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${days[days.length - 1].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const gridStyle = {
    // Fixed day columns: a `1fr` track would grow to fit a bar's title.
    gridTemplateColumns: `minmax(14rem, 1fr) repeat(${SPAN}, 2.75rem)`,
  };

  return (
    <div
      className={cn(
        PROJECT_VIEW_PADDING,
        'gap-4 flex w-full flex-col text-foreground',
      )}
    >
      {/* Range navigation and legend */}
      <div className="gap-3 flex flex-wrap items-center justify-between">
        <div className="gap-2 flex items-center">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shift(-7)}
              aria-label="Previous week"
              title="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => shift(7)}
              aria-label="Next week"
              title="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-sm font-medium tabular-nums">{rangeLabel}</span>
        </div>

        <div className="gap-4 text-xs flex flex-wrap items-center text-muted-foreground">
          {board.lists.map((list) => (
            <span key={list.id} className="gap-1.5 flex items-center">
              <StatusIcon status={list.id} showTooltip={false} />
              {list.title}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="scrollbar-subtle overflow-x-auto rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="w-full min-w-max">
          {/* Day header */}
          <div
            className="text-xs grid border-b border-border/60 bg-muted/40"
            style={gridStyle}
          >
            <div className="px-4 py-2 font-medium text-muted-foreground">
              Task
            </div>
            {days.map((day, i) => {
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={isoDay(day)}
                  className={cn(
                    'py-1.5 flex flex-col items-center border-l border-border/40',
                    weekend && 'bg-muted/40',
                    i === todayIndex && 'bg-primary/10 text-primary',
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      i === todayIndex && 'font-semibold',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="px-4 py-10 gap-2 text-sm flex flex-col items-center text-center text-muted-foreground">
              <CalendarRange className="size-5" />
              <span>Nothing is scheduled in this range.</span>
              {outside > 0 ? (
                <span className="text-xs">
                  {outside} scheduled {outside === 1 ? 'task is' : 'tasks are'}{' '}
                  outside it. Use the arrows to move the range.
                </span>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {rows.map(({ card, list, phase, start, end }) => {
                const from = dayDiff(days[0], start);
                const to = dayDiff(days[0], end);
                const clippedStart = from < 0;
                const clippedEnd = to > SPAN - 1;
                const startCol = Math.max(0, from) + 2;
                const endCol = Math.min(SPAN - 1, to) + 3;
                const assignees = board.members.filter((m) =>
                  card.memberIds.includes(m.id),
                );
                const dates =
                  card.startDate &&
                  card.dueDate &&
                  card.startDate !== card.dueDate
                    ? `${card.startDate} → ${card.dueDate}`
                    : `Due ${card.dueDate ?? card.startDate}`;
                return (
                  <EntityContextMenu
                    key={card.id}
                    actions={() => taskActions(card, list.id)}
                    scope={`task:${card.id}`}
                    entityType="task"
                    entity={card}
                    label={`“${card.title}”`}
                    longPress={false}
                  >
                    <div
                      className="group min-h-10 grid transition-colors hover:bg-muted/30"
                      style={gridStyle}
                    >
                      {/* Task cell */}
                      <button
                        type="button"
                        onClick={() => onSelectCard(card, list.id)}
                        className="px-4 py-2 gap-2 min-w-0 text-sm flex items-center text-left focus-visible:bg-muted/50 focus-visible:outline-none"
                        style={{ gridColumn: 1, gridRow: 1 }}
                      >
                        <StatusIcon
                          status={list.id}
                          className="size-3.5 shrink-0"
                          showTooltip={false}
                        />
                        {(show.ticketId ?? true) ? (
                          <TaskTicket
                            ticket={card.ticketId ?? card.identifier}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'min-w-0 font-medium flex-1 truncate',
                            phase === 'done' &&
                              'text-muted-foreground line-through',
                          )}
                        >
                          {card.title}
                        </span>
                        {(show.assignee ?? true) && assignees.length > 1 ? (
                          <UserAvatarGroup users={assignees} size="xs" />
                        ) : (show.assignee ?? true) && assignees[0] ? (
                          <UserAvatar
                            name={assignees[0].displayName ?? assignees[0].name}
                            src={assignees[0].avatarUrl}
                            seed={assignees[0].id}
                            presence={assignees[0].presence}
                            size="xs"
                          />
                        ) : null}
                      </button>

                      {/* Day cells */}
                      {days.map((day, i) => {
                        const weekend =
                          day.getDay() === 0 || day.getDay() === 6;
                        return (
                          <div
                            key={isoDay(day)}
                            aria-hidden
                            className={cn(
                              'border-l border-border/40',
                              weekend && 'bg-muted/30',
                              i === todayIndex && 'bg-primary/5',
                            )}
                            style={{ gridColumn: i + 2, gridRow: 1 }}
                          />
                        );
                      })}

                      {/* Bar */}
                      <button
                        type="button"
                        onClick={() => onSelectCard(card, list.id)}
                        title={`${card.title} · ${dates}`}
                        className={cn(
                          'mx-0.5 h-6 px-2 gap-1 min-w-0 font-medium z-10 flex items-center self-center border text-[11px] shadow-xs transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          phase === 'cancelled' && 'line-through',
                          clippedStart
                            ? 'rounded-l-none border-l-0'
                            : 'rounded-l-md',
                          clippedEnd
                            ? 'rounded-r-none border-r-0'
                            : 'rounded-r-md',
                        )}
                        style={{
                          ...barStyle(statusColor(list.id, workflow)),
                          gridColumn: `${startCol} / ${endCol}`,
                          gridRow: 1,
                        }}
                      >
                        {clippedStart ? (
                          <ChevronLeft className="size-3 shrink-0" />
                        ) : null}
                        <span className="truncate">{card.title}</span>
                        {clippedEnd ? (
                          <ChevronRight className="size-3 ml-auto shrink-0" />
                        ) : null}
                      </button>
                    </div>
                  </EntityContextMenu>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tasks with no dates can't sit on the grid; list them so none go missing. */}
      {undated.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-xs">
          <button
            type="button"
            onClick={() => setShowUndated((v) => !v)}
            aria-expanded={showUndated}
            className="px-4 py-2.5 gap-2 text-sm font-medium flex w-full items-center text-left text-foreground transition-colors hover:bg-muted/30"
          >
            {showUndated ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <CalendarOff className="size-4 text-muted-foreground" />
            <span>No dates</span>
            <Badge variant="neutral" className="min-w-5 tabular-nums">
              {undated.length}
            </Badge>
            <span className="text-xs font-normal ml-auto text-muted-foreground">
              Set a due date to put a task on the timeline
            </span>
          </button>
          {showUndated ? (
            <div className="divide-y divide-border/40 border-t border-border/60">
              {undated.map(({ card, list }) => (
                <EntityContextMenu
                  key={card.id}
                  actions={() => taskActions(card, list.id)}
                  scope={`task:${card.id}`}
                  entityType="task"
                  entity={card}
                  label={`“${card.title}”`}
                  longPress={false}
                >
                  <div className="pr-3 gap-2 flex items-center transition-colors hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => onSelectCard(card, list.id)}
                      className="px-4 py-2 gap-2 text-sm min-w-0 flex flex-1 items-center text-left focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <StatusIcon
                        status={list.id}
                        className="size-3.5 shrink-0"
                        showTooltip={false}
                      />
                      {(show.ticketId ?? true) ? (
                        <TaskTicket ticket={card.ticketId ?? card.identifier} />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">
                        {card.title}
                      </span>
                    </button>
                    {/* Scheduling right here puts the task straight onto the grid. */}
                    <DatePicker
                      value={card.dueDate}
                      onChange={(day) =>
                        dispatch({
                          type: 'card/update',
                          cardId: card.id,
                          patch: { dueDate: day ?? null },
                        })
                      }
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <CalendarPlus className="size-3.5" />
                          Set due date
                        </Button>
                      }
                    />
                  </div>
                </EntityContextMenu>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
