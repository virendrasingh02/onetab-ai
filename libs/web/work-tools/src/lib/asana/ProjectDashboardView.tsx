import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Progress,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  ListTodo,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ProjectStatus, TaskStatus } from '@org/types';
import React, { useMemo } from 'react';
import {
  daysUntil,
  describeDue,
  DUE_TONE_CLASSES,
  PRIORITY_META,
} from '../kanban/card-meta.js';
import { PriorityIcon } from '../kanban/kanban-icons.js';
import type { BoardState, KanbanCard, Priority } from '../kanban/types.js';

/**
 * The banner's states are `Project.status` — the field the API stores and the
 * gallery filters on. It used to be a separate "health" enum held in component
 * state, which meant the banner forgot what you set the moment you navigated.
 */
export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  PLANNING: {
    label: 'Planning',
    bg: 'bg-accent-violet-soft border-accent-violet/30',
    text: 'text-accent-violet',
    icon: <ListTodo className="w-4 h-4 text-accent-violet" />,
  },
  ACTIVE: {
    label: 'Active',
    bg: 'bg-accent-green-soft border-accent-green/30',
    text: 'text-accent-green',
    icon: <ShieldCheck className="w-4 h-4 text-accent-green" />,
  },
  ON_HOLD: {
    label: 'On Hold',
    bg: 'bg-accent-amber-soft border-accent-amber/30',
    text: 'text-accent-amber',
    icon: <AlertTriangle className="w-4 h-4 text-accent-amber" />,
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-accent-blue-soft border-accent-blue/30',
    text: 'text-accent-blue',
    icon: <CheckCircle2 className="w-4 h-4 text-accent-blue" />,
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-muted border-border',
    text: 'text-muted-foreground',
    icon: <Flame className="w-4 h-4 text-muted-foreground" />,
  },
};

interface ProjectDashboardViewProps {
  board: BoardState;
  /** The open project's status, or `undefined` while it is still loading. */
  status?: ProjectStatus;
  onStatusChange?: (status: ProjectStatus) => void;
  onSelectCard?: (card: KanbanCard, listId: string) => void;
}

export function ProjectDashboardView({
  board,
  status = ProjectStatus.ACTIVE,
  onStatusChange,
  onSelectCard,
}: ProjectDashboardViewProps) {
  // Calculated Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let urgentOrHigh = 0;
    const attention: Array<{ card: KanbanCard; listId: string }> = [];
    const priorityCounts: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    const memberTaskCounts: Record<string, number> = {};

    board.lists.forEach((list) => {
      list.cards.forEach((card) => {
        // A cancelled task is neither work left nor work finished.
        if (list.id !== TaskStatus.CANCELLED) total++;
        if (list.id === TaskStatus.DONE) completed++;
        if (
          list.id === TaskStatus.IN_PROGRESS ||
          list.id === TaskStatus.IN_REVIEW
        ) {
          inProgress++;
        }
        const isOverdue =
          !!card.dueDate && !card.dueComplete && daysUntil(card.dueDate) < 0;
        const isPressing =
          !card.dueComplete &&
          (card.priority === 'HIGH' || card.priority === 'URGENT');
        if (isOverdue) overdue++;
        if (isPressing) urgentOrHigh++;
        if (isOverdue || isPressing) attention.push({ card, listId: list.id });
        priorityCounts[card.priority] =
          (priorityCounts[card.priority] || 0) + 1;

        card.memberIds.forEach((mId) => {
          memberTaskCounts[mId] = (memberTaskCounts[mId] || 0) + 1;
        });
      });
    });

    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      overdue,
      urgentOrHigh,
      attention: attention.slice(0, 6),
      completionRate,
      priorityCounts,
      memberTaskCounts,
    };
  }, [board.lists]);

  const currentStatusMeta = PROJECT_STATUS_META[status];
  const workload = board.members
    .filter((member) => metrics.memberTaskCounts[member.id])
    .sort(
      (a, b) => metrics.memberTaskCounts[b.id] - metrics.memberTaskCounts[a.id],
    );

  return (
    <div className="gap-6 p-4 max-w-7xl mx-auto flex w-full flex-col text-foreground">
      {/* Project Status Banner */}
      <div
        className={cn(
          'gap-4 p-4 flex flex-wrap items-center justify-between rounded-xl border transition-colors',
          currentStatusMeta.bg,
        )}
      >
        <div className="gap-3 flex items-center">
          <div className="p-2 rounded-lg bg-background/80 shadow-xs">
            {currentStatusMeta.icon}
          </div>
          <div>
            <div className="gap-2 flex items-center">
              <h2 className="text-base font-bold text-foreground">
                {board.title}
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-6 font-semibold gap-1 text-xs border',
                      currentStatusMeta.text,
                    )}
                  >
                    <span>{currentStatusMeta.label}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).map(
                    (statusKey) => (
                      <DropdownMenuItem
                        key={statusKey}
                        onClick={() => onStatusChange?.(statusKey)}
                        className="gap-2 flex items-center"
                      >
                        {PROJECT_STATUS_META[statusKey].icon}
                        <span>{PROJECT_STATUS_META[statusKey].label}</span>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-xs mt-0.5 text-muted-foreground">
              This project is marked as{' '}
              <strong className={currentStatusMeta.text}>
                {currentStatusMeta.label}
              </strong>
              .
            </p>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="gap-4 flex min-w-[200px] items-center">
          <div className="flex-1">
            <div className="text-xs font-semibold mb-1 flex justify-between">
              <span>Overall Completion</span>
              <span>{metrics.completionRate}%</span>
            </div>
            <Progress value={metrics.completionRate} className="h-2" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Total Tasks
            </CardTitle>
            <ListTodo className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.total}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              Not counting cancelled
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Completed
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-accent-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-green">
              {metrics.completed}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              {metrics.completionRate}% of project finished
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              In Progress
            </CardTitle>
            <Clock className="w-4 h-4 text-accent-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-blue">
              {metrics.inProgress}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              Being worked on or in review
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Overdue
            </CardTitle>
            <Flame className="w-4 h-4 text-accent-rose" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-rose">
              {metrics.overdue}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              {metrics.urgentOrHigh} open at high priority or above
            </p>
          </CardContent>
        </Card>
      </div>

      {/* The work most likely to need someone today */}
      {metrics.attention.length > 0 ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold gap-2 flex items-center">
              <Flame className="w-4 h-4 text-accent-rose" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-0.5 flex flex-col">
            {metrics.attention.map(({ card, listId }) => {
              const due = describeDue(card);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelectCard?.(card, listId)}
                  className="gap-2 px-2 py-1.5 text-xs flex cursor-pointer items-center rounded-md text-left transition-colors hover:bg-muted/50"
                >
                  <PriorityIcon
                    priority={card.priority}
                    className="size-3.5 shrink-0"
                  />
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {card.ticketId}
                  </span>
                  <span className="min-w-0 font-medium flex-1 truncate text-foreground">
                    {card.title}
                  </span>
                  {due ? (
                    <span
                      className={cn(
                        'rounded px-1.5 font-medium shrink-0 border py-px text-[11px]',
                        DUE_TONE_CLASSES[due.tone],
                      )}
                    >
                      {due.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* Breakdown Sections */}
      <div className="lg:grid-cols-2 gap-6 grid grid-cols-1">
        {/* Section breakdown */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold gap-2 flex items-center">
              <PieChart className="w-4 h-4 text-primary" />
              Tasks by status
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-3 flex flex-col">
            {board.lists.map((list) => {
              const listCount = list.cards.length;
              const pct =
                metrics.total > 0
                  ? Math.round((listCount / metrics.total) * 100)
                  : 0;
              return (
                <div key={list.id} className="gap-1 flex flex-col">
                  <div className="text-xs font-medium flex justify-between">
                    <span>{list.title}</span>
                    <span className="text-muted-foreground">
                      {listCount} tasks ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Priority distribution */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold gap-2 flex items-center">
              <TrendingUp className="w-4 h-4 text-primary" />
              Priority Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-3 flex flex-col">
            {(Object.keys(PRIORITY_META) as Priority[]).map((pKey) => {
              const count = metrics.priorityCounts[pKey] || 0;
              const pct =
                metrics.total > 0
                  ? Math.round((count / metrics.total) * 100)
                  : 0;
              const meta = PRIORITY_META[pKey];

              return (
                <div
                  key={pKey}
                  className="text-xs p-2 flex items-center justify-between rounded-lg border border-border/30 bg-muted/20"
                >
                  <div className="gap-2 flex items-center">
                    <span
                      className={cn('w-2.5 h-2.5 rounded-full', meta.dot)}
                    />
                    <span className="font-medium">{meta.label}</span>
                  </div>
                  <div className="gap-3 flex items-center">
                    <Badge variant={meta.variant} className="text-[10px]">
                      {count} tasks
                    </Badge>
                    <span className="w-10 text-right text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card className="lg:col-span-2 border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold gap-2 flex items-center">
              <Users className="w-4 h-4 text-primary" />
              Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="sm:grid-cols-2 md:grid-cols-3 gap-3 grid grid-cols-1">
              {workload.length === 0 ? (
                <p className="text-xs sm:col-span-2 md:col-span-3 text-muted-foreground">
                  No one has a task in this project yet.
                </p>
              ) : null}
              {workload.map((member) => {
                const count = metrics.memberTaskCounts[member.id] || 0;
                return (
                  <div
                    key={member.id}
                    className="p-3 flex items-center justify-between rounded-xl border border-border/40 bg-muted/20"
                  >
                    <div className="gap-2.5 flex items-center">
                      <UserAvatar
                        name={member.name}
                        src={member.avatarUrl}
                        seed={member.id}
                        presence={member.presence}
                        statusEmoji={member.statusEmoji}
                        statusText={member.statusText}
                        size="sm"
                      />
                      <p className="text-xs font-semibold text-foreground">
                        {member.name}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {count} {count === 1 ? 'task' : 'tasks'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
