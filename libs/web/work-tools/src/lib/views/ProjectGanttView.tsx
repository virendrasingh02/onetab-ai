import { Button } from '@org/ui';
import type { Milestone, PublicUser, Task } from '@org/types';
import { cn } from '@org/utils';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusIcon } from '../kanban/kanban-icons.js';

interface ProjectGanttViewProps {
  tasks: Task[];
  milestones?: Milestone[];
  members?: PublicUser[];
  onSelectTask: (task: Task) => void;
  searchQuery?: string;
}

export function ProjectGanttView({
  tasks,
  onSelectTask,
  searchQuery = '',
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.identifier && t.identifier.toLowerCase().includes(q))
      );
    });
  }, [tasks, searchQuery]);

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
    <div className="flex flex-col w-full h-full bg-background border border-border/60 rounded-xl overflow-hidden shadow-xs select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday} className="text-xs">
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
            {days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {days[days.length - 1].toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            <span>Task Bar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent-green" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flag className="size-3 text-accent-amber" />
            <span>Milestone</span>
          </div>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Tasks Tree */}
        <div className="w-72 shrink-0 border-r border-border/60 flex flex-col bg-muted/20">
          <div className="h-10 px-4 py-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider border-b border-border/60 bg-muted/40 flex items-center justify-between">
            <span>Work Item</span>
            <span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/30 font-sans text-xs">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="h-10 px-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-mono text-[10px] text-primary/80 font-bold shrink-0">
                    {task.identifier || 'TASK'}
                  </span>
                  <span className="truncate text-foreground group-hover:text-primary transition-colors font-medium">
                    {task.title}
                  </span>
                </div>
                <StatusIcon status={task.status} className="size-3.5 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Timeline Grid & Bars */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative">
          <div className="min-w-[800px] h-full flex flex-col">
            {/* Days Header */}
            <div className="h-10 flex border-b border-border/60 bg-muted/40 sticky top-0 z-10">
              {days.map((day) => {
                const dayIso = day.toISOString().split('T')[0];
                const isToday = dayIso === todayIso;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={dayIso}
                    className={cn(
                      'flex-1 min-w-[36px] flex flex-col items-center justify-center border-r border-border/30 text-[10px]',
                      isWeekend && 'bg-muted/20 text-muted-foreground/60',
                      isToday && 'bg-primary/10 text-primary font-bold',
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
            <div className="flex-1 divide-y divide-border/30 relative">
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
                  Math.min(100, ((taskStart - startDateMs) / totalDurationMs) * 100),
                );
                const rightPct = Math.max(
                  0,
                  Math.min(100, ((taskEnd - startDateMs) / totalDurationMs) * 100),
                );
                const widthPct = Math.max(3, rightPct - leftPct);

                const isDone = task.status === 'DONE';

                return (
                  <div
                    key={task.id}
                    className="h-10 relative flex items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* Vertical grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((day) => {
                        const dayIso = day.toISOString().split('T')[0];
                        const isToday = dayIso === todayIso;
                        return (
                          <div
                            key={dayIso}
                            className={cn(
                              'flex-1 min-w-[36px] border-r border-border/20 h-full',
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
                        'absolute h-6 rounded-md px-2 flex items-center gap-1.5 shadow-xs cursor-pointer text-[11px] font-medium transition-all duration-150',
                        isDone
                          ? 'bg-accent-green/80 text-accent-green-foreground border border-accent-green'
                          : 'bg-primary/85 text-primary-foreground border border-primary hover:brightness-110',
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
