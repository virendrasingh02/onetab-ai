import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Page,
  PageHeader,
  Panel,
} from '@org/ui';
import {
  CalendarClock,
  Copy,
  Link2,
  MoreHorizontal,
  Trash2,
  Video,
} from 'lucide-react';
import { useState } from 'react';

export interface MeetingItem {
  id: string;
  title: string;
  when: string;
  duration: string;
  host: string;
  participants: number;
  live: boolean;
}

const sampleMeetings: MeetingItem[] = [
  {
    id: '1',
    title: 'Daily standup',
    when: 'Today, 9:30 AM',
    duration: '15 min',
    host: 'Admin',
    participants: 6,
    live: true,
  },
  {
    id: '2',
    title: 'Vector search design review',
    when: 'Today, 2:00 PM',
    duration: '45 min',
    host: 'Dev User',
    participants: 4,
    live: false,
  },
  {
    id: '3',
    title: 'Workspace roadmap sync',
    when: 'Tomorrow, 11:00 AM',
    duration: '30 min',
    host: 'Priya Raman',
    participants: 9,
    live: false,
  },
];

/** Scheduled and live calls for the workspace, ahead of the calendar screen. */
export function MeetingsView() {
  const [meetings, setMeetings] = useState<MeetingItem[]>(sampleMeetings);

  return (
    <Page>
      <PageHeader
        title="Meetings"
        description="Video calls scheduled in this workspace, and the one running now."
        icon={<Video />}
        accent="green"
        actions={<Button leadingIcon={<Video />}>Start a meeting</Button>}
      />

      {meetings.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CalendarClock />}
            title="No meetings scheduled"
            description="Start a call now, or schedule one from the calendar."
            action={<Button leadingIcon={<Video />}>Start a meeting</Button>}
          />
        </Panel>
      ) : (
        <div className="gap-3 grid sm:grid-cols-2 xl:grid-cols-3">
          {meetings.map((meeting) => (
            <Panel key={meeting.id}>
              <div className="gap-2 flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate text-foreground">
                    {meeting.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meeting.when} · {meeting.duration}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${meeting.title}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>
                      <Link2 aria-hidden />
                      Copy join link
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy aria-hidden />
                      Duplicate meeting
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        setMeetings((prev) =>
                          prev.filter((entry) => entry.id !== meeting.id),
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                      Cancel meeting
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 gap-2 flex flex-wrap items-center">
                {meeting.live ? (
                  <Badge variant="destructive">Live now</Badge>
                ) : (
                  <Badge variant="neutral">Scheduled</Badge>
                )}
                <Badge variant="outline">{meeting.participants} invited</Badge>
                <span className="text-xs text-muted-foreground">
                  Hosted by {meeting.host}
                </span>
              </div>

              <Button
                className="mt-4 w-full"
                variant={meeting.live ? 'primary' : 'outline'}
                leadingIcon={<Video />}
              >
                {meeting.live ? 'Join now' : 'Join when it starts'}
              </Button>
            </Panel>
          ))}
        </div>
      )}
    </Page>
  );
}
