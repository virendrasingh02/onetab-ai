import { Badge, Button, Page, PageHeader, Panel, Toolbar } from '@org/ui';
import { cn } from '@org/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react';
import { useState } from 'react';

export interface EventItem {
  id: string;
  title: string;
  startAt: string;
  location?: string;
  category: 'MEETING' | 'TASK_DUE' | 'MILESTONE';
}

const sampleEvents: EventItem[] = [
  {
    id: '1',
    title: 'Sprint review & demo',
    startAt: '10:00 AM',
    location: 'Matrix room #general',
    category: 'MEETING',
  },
  {
    id: '2',
    title: 'Qdrant vector pipeline migration',
    startAt: '02:00 PM',
    location: 'Dev sync',
    category: 'TASK_DUE',
  },
  {
    id: '3',
    title: 'Phase 5 release milestone',
    startAt: '05:00 PM',
    category: 'MILESTONE',
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TODAY = 5;

export function CalendarView() {
  const [events] = useState<EventItem[]>(sampleEvents);
  const dates = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <Page width="full">
      <PageHeader
        title="Calendar"
        description="Meetings, due dates and milestones in one schedule."
        icon={<CalendarIcon />}
        accent="green"
        actions={
          <Toolbar aria-label="Calendar controls">
            <div className="p-0.5 flex items-center rounded-lg border bg-surface">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 text-sm font-medium">August 2026</span>
              <Button variant="ghost" size="icon-sm" aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
            <Button leadingIcon={<Plus />}>Schedule event</Button>
          </Toolbar>
        }
      />

      <div className="gap-6 lg:grid-cols-3 grid flex-1 grid-cols-1">
        <Panel className="lg:col-span-2">
          <div
            role="grid"
            aria-label="August 2026"
            aria-rowcount={6}
            aria-colcount={7}
          >
            <div
              role="row"
              className="mb-2 gap-2 text-xs font-medium grid grid-cols-7 text-center text-muted-foreground"
            >
              {DAYS.map((day) => (
                <div key={day} role="columnheader">
                  {day}
                </div>
              ))}
            </div>

            <div role="row" className="gap-2 grid grid-cols-7">
              {dates.map((date) => {
                const isToday = date === TODAY;
                return (
                  <div
                    key={date}
                    role="gridcell"
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'min-h-16 p-2 text-xs flex flex-col justify-between rounded-lg border',
                      'transition-colors duration-(--duration-fast)',
                      isToday
                        ? 'font-semibold border-success/40 bg-success/10 text-success'
                        : 'bg-background hover:border-border-strong',
                    )}
                  >
                    <span>{date}</span>
                    {isToday ? (
                      <span
                        aria-hidden
                        className="size-1.5 self-end rounded-full bg-success"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Today’s agenda" subtitle="Friday, 5 August">
          <ul className="space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="p-3 rounded-lg border bg-surface-muted"
              >
                <div className="mb-1 gap-2 flex items-center justify-between">
                  <span className="gap-1 text-xs flex items-center font-mono text-success">
                    <Clock className="size-3" aria-hidden /> {event.startAt}
                  </span>
                  <Badge variant="neutral" className="text-[10px] uppercase">
                    {event.category.replace('_', ' ')}
                  </Badge>
                </div>
                <h3 className="text-sm font-medium text-foreground">
                  {event.title}
                </h3>
                {event.location ? (
                  <p className="mt-1 gap-1 text-xs flex items-center text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    {event.location}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
