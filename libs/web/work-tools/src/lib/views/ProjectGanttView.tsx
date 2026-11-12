import { Button } from '@org/ui';
import type { Milestone, PublicUser, Task } from '@org/types';
import { cn } from '@org/utils';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';

interface ProjectGanttViewProps {
  tasks: Task[];
  milestones?: Milestone[];
  members?: PublicUser[];
  onSelectTask: (task: Task) => void;
}

export function ProjectGanttView({
  tasks,
  onSelectTask,
}: ProjectGanttViewProps) {
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });

  const daysCount = 28;

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, [baseDate, daysCount]);

  const startDateMs = days[0].getTime();
  const endDateMs = days[days.length - 1].getTime();
  const totalDurationMs = endDateMs - startDateMs;

  const filteredTasks = tasks;

  const handlePrev = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 14);
    setBaseDate(d);
  };

  const handleNext = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 14);
    setBaseDate(d);
  };

  const handleToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-xs select-none">
      {/* Top Toolbar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60 bg-muted/40">
        <div className="gap-2 flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs"
          >
            Today
          </Button>
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/30">
            <Button variant="ghost" size="icon-sm" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-xs font-semibold ml-2 text-foreground">
            {days[0].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            –{' '}
            {days[days.length - 1].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="gap-3 text-xs flex items-center text-muted-foreground">
          <div className="gap-1.5 flex items-center">
            <span className="size-2.5 rounded-sm bg-primary" />
            <span>Task Bar</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <span className="size-2.5 rounded-sm bg-accent-green" />
            <span>Completed</span>
          </div>
          <div className="gap-1.5 flex items-center">
            <Flag className="size-3 text-accent-amber" />
            <span>Milestone</span>
          </div>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Tasks Tree */}
        <div className="w-72 flex shrink-0 flex-col border-r border-border/60 bg-muted/20">
          <div className="h-10 px-4 py-2.5 font-semibold text-xs tracking-wider flex items-center justify-between border-b border-border/60 bg-muted/40 text-muted-foreground uppercase">
            <span>Work Item</span>
            <span>Status</span>
          </div>
          <div className="text-xs flex-1 divide-y divide-border/30 overflow-y-auto font-sans">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="h-10 px-3 group flex cursor-pointer items-center justify-between transition-colors hover:bg-muted/50"
              >
                <div className="gap-2 pr-2 flex items-center truncate">
                  <span className="font-bold shrink-0 font-mono text-[10px] text-brand-text/80">
                    {task.identifier || 'TASK'}
                  </span>
                  <span className="font-medium truncate text-foreground transition-colors group-hover:text-primary">
                    {task.title}
                  </span>
                </div>
                <StatusIcon
                  status={task.stateId || task.status}
                  className="size-3.5 shrink-0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Timeline Grid & Bars */}
        <div className="relative flex-1 overflow-x-auto overflow-y-auto">
          <div className="flex h-full min-w-[800px] flex-col">
            {/* Days Header */}
            <div className="h-10 top-0 sticky z-10 flex border-b border-border/60 bg-muted/40">
              {days.map((day) => {
                const dayIso = day.toISOString().split('T')[0];
                const isToday = dayIso === todayIso;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={dayIso}
                    className={cn(
                      'flex min-w-[36px] flex-1 flex-col items-center justify-center border-r border-border/30 text-[10px]',
                      isWeekend && 'bg-muted/20 text-muted-foreground/60',
                      isToday && 'font-bold bg-primary/10 text-primary',
                    )}
                  >
                    <span className="text-[9px] uppercase">
                      {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </span>
                    <span>{day.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* Task Rows & Bars */}
            <div className="relative flex-1 divide-y divide-border/30">
              {filteredTasks.map((task) => {
                const taskStart = task.startDate
                  ? new Date(task.startDate).getTime()
                  : task.dueDate
                    ? new Date(task.dueDate).getTime() - 86400000 * 3
                    : startDateMs + 86400000 * 2;

                const taskEnd = task.dueDate
                  ? new Date(task.dueDate).getTime()
                  : taskStart + 86400000 * 3;

                const leftPct = Math.max(
                  0,
                  Math.min(
                    100,
                    ((taskStart - startDateMs) / totalDurationMs) * 100,
                  ),
                );
                const rightPct = Math.max(
                  0,
                  Math.min(
                    100,
                    ((taskEnd - startDateMs) / totalDurationMs) * 100,
                  ),
                );
                const widthPct = Math.max(3, rightPct - leftPct);

                const isDone = task.status === 'DONE';

                return (
                  <div
                    key={task.id}
                    className="h-10 relative flex items-center transition-colors hover:bg-muted/20"
                  >
                    {/* Vertical grid lines */}
                    <div className="inset-0 pointer-events-none absolute flex">
                      {days.map((day) => {
                        const dayIso = day.toISOString().split('T')[0];
                        const isToday = dayIso === todayIso;
                        return (
                          <div
                            key={dayIso}
                            className={cn(
                              'h-full min-w-[36px] flex-1 border-r border-border/20',
                              isToday && 'bg-primary/5',
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Gantt Bar */}
                    <div
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      onClick={() => onSelectTask(task)}
                      className={cn(
                        'h-6 px-2 gap-1.5 font-medium absolute flex cursor-pointer items-center rounded-md text-[11px] shadow-xs transition-all duration-150',
                        isDone
                          ? 'text-accent-green-foreground border border-accent-green bg-accent-green/80'
                          : 'border border-primary bg-primary/85 text-primary-foreground hover:brightness-110',
                      )}
                    >
                      <span className="truncate">{task.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
