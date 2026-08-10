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
import React, { useMemo, useState } from 'react';
import { daysUntil, PRIORITY_META } from '../kanban/card-meta.js';
import type { BoardState, KanbanCard, Priority } from '../kanban/types.js';

export type ProjectStatusType = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED';

export const PROJECT_STATUS_META: Record<
  ProjectStatusType,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  ON_TRACK: {
    label: 'On Track',
    bg: 'bg-accent-green-soft border-accent-green/30',
    text: 'text-accent-green',
    icon: <ShieldCheck className="w-4 h-4 text-accent-green" />,
  },
  AT_RISK: {
    label: 'At Risk',
    bg: 'bg-accent-amber-soft border-accent-amber/30',
    text: 'text-accent-amber',
    icon: <AlertTriangle className="w-4 h-4 text-accent-amber" />,
  },
  OFF_TRACK: {
    label: 'Off Track',
    bg: 'bg-accent-rose-soft border-accent-rose/30',
    text: 'text-accent-rose',
    icon: <Flame className="w-4 h-4 text-accent-rose" />,
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-accent-blue-soft border-accent-blue/30',
    text: 'text-accent-blue',
    icon: <CheckCircle2 className="w-4 h-4 text-accent-blue" />,
  },
};

interface ProjectDashboardViewProps {
  board: BoardState;
  onSelectCard?: (card: KanbanCard, listId: string) => void;
}

export function ProjectDashboardView({ board, onSelectCard: _onSelectCard }: ProjectDashboardViewProps) {
  const [projectStatus, setProjectStatus] = useState<ProjectStatusType>('ON_TRACK');

  // Calculated Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let completed = 0;
    let overdue = 0;
    let urgentOrHigh = 0;
    const priorityCounts: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    const memberTaskCounts: Record<string, number> = {};

    board.lists.forEach((list) => {
      list.cards.forEach((card) => {
        total++;
        if (card.dueComplete) completed++;
        if (card.dueDate && !card.dueComplete && daysUntil(card.dueDate) < 0) {
          overdue++;
        }
        if (card.priority === 'HIGH' || card.priority === 'URGENT') {
          urgentOrHigh++;
        }
        priorityCounts[card.priority] = (priorityCounts[card.priority] || 0) + 1;

        card.memberIds.forEach((mId) => {
          memberTaskCounts[mId] = (memberTaskCounts[mId] || 0) + 1;
        });
      });
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const inProgress = total - completed;

    return {
      total,
      completed,
      inProgress,
      overdue,
      urgentOrHigh,
      completionRate,
      priorityCounts,
      memberTaskCounts,
    };
  }, [board.lists]);

  const currentStatusMeta = PROJECT_STATUS_META[projectStatus];

  return (
    <div className="flex flex-col gap-6 p-4 w-full text-foreground max-w-7xl mx-auto">
      {/* Project Status Banner */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
          currentStatusMeta.bg
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background/80 shadow-xs">
            {currentStatusMeta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{board.title}</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('h-6 font-semibold gap-1 text-xs border', currentStatusMeta.text)}
                  >
                    <span>{currentStatusMeta.label}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(PROJECT_STATUS_META) as ProjectStatusType[]).map((statusKey) => (
                    <DropdownMenuItem
                      key={statusKey}
                      onClick={() => setProjectStatus(statusKey)}
                      className="flex items-center gap-2"
                    >
                      {PROJECT_STATUS_META[statusKey].icon}
                      <span>{PROJECT_STATUS_META[statusKey].label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Overall project health is currently marked as <strong className={currentStatusMeta.text}>{currentStatusMeta.label}</strong>.
            </p>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="flex items-center gap-4 min-w-[200px]">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>Overall Completion</span>
              <span>{metrics.completionRate}%</span>
            </div>
            <Progress value={metrics.completionRate} className="h-2" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tasks
            </CardTitle>
            <ListTodo className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {board.lists.length} project sections</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completed
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-accent-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-green">{metrics.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.completionRate}% of project finished</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </CardTitle>
            <Clock className="w-4 h-4 text-accent-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-blue">{metrics.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Active tasks remaining</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overdue / Urgent
            </CardTitle>
            <Flame className="w-4 h-4 text-accent-rose" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-rose">{metrics.overdue + metrics.urgentOrHigh}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.overdue} overdue, {metrics.urgentOrHigh} high priority
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section breakdown */}
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Tasks by Section
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {board.lists.map((list) => {
              const listCount = list.cards.length;
              const pct = metrics.total > 0 ? Math.round((listCount / metrics.total) * 100) : 0;
              return (
                <div key={list.id} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-medium">
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
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Priority Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(Object.keys(PRIORITY_META) as Priority[]).map((pKey) => {
              const count = metrics.priorityCounts[pKey] || 0;
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              const meta = PRIORITY_META[pKey];

              return (
                <div key={pKey} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', meta.dot)} />
                    <span className="font-medium">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={meta.variant} className="text-[10px]">
                      {count} tasks
                    </Badge>
                    <span className="text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card className="bg-card/60 border-border/60 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Team Workload & Assignees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {board.members.map((member) => {
                const count = metrics.memberTaskCounts[member.id] || 0;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={member.name} src={member.avatarUrl} size="sm" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground">Team Member</p>
                      </div>
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
