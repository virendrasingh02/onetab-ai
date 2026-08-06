import {
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  Panel,
} from '@org/ui';
import {
  Calendar,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

interface ScheduledItem {
  id: string;
  title: string;
  destination: string;
  scheduledFor: string;
  status: 'QUEUED' | 'PENDING' | 'PAUSED';
  type: 'MESSAGE' | 'DIGEST' | 'DOC_RELEASE';
}

const initialScheduleList: ScheduledItem[] = [
  {
    id: 's1',
    title: 'Weekly Sprint Progress Summary & Retrospective Notes',
    destination: '#announcements',
    scheduledFor: 'Tomorrow at 09:00 AM',
    status: 'QUEUED',
    type: 'MESSAGE',
  },
  {
    id: 's2',
    title: 'AI Agent Activity Digest & Token Usage Summary',
    destination: '#analytics-reports',
    scheduledFor: 'Friday at 05:00 PM',
    status: 'PENDING',
    type: 'DIGEST',
  },
  {
    id: 's3',
    title: 'Product Release v2.4 Feature Specs Document Publication',
    destination: 'Docs / Release Notes',
    scheduledFor: 'Monday at 08:00 AM',
    status: 'QUEUED',
    type: 'DOC_RELEASE',
  },
];

export function ScheduleView() {
  const [items, setItems] = useState<ScheduledItem[]>(initialScheduleList);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <Page>
      <PageHeader
        title="Schedule"
        description="Schedule messages, posts, and publications for automatic workspace delivery."
        icon={<Clock />}
        accent="blue"
        actions={
          <Button leadingIcon={<Plus />}>
            New Scheduled Item
          </Button>
        }
      />

      <Panel>
        {items.length === 0 ? (
          <EmptyState
            icon={<Clock />}
            title="No scheduled items"
            description="Create a scheduled message or document publication to automate delivery."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    {item.type === 'MESSAGE' ? (
                      <Send className="size-4" />
                    ) : item.type === 'DIGEST' ? (
                      <MessageSquare className="size-4" />
                    ) : (
                      <Calendar className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {item.title}
                      </h3>
                      <Badge variant={item.status === 'QUEUED' ? 'primary' : 'neutral'}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Destination: <span className="font-medium text-foreground">{item.destination}</span>
                    </p>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-subtle font-mono">
                      <Clock className="size-3" />
                      <span>{item.scheduledFor}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete schedule"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="size-4 text-subtle hover:text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
