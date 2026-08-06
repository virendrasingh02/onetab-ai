import type { Accent } from '@org/design-system';
import { accentClasses, Page, PageHeader, Panel } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  CheckCircle,
  FileText,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  icon: LucideIcon;
  accent: Accent;
}

const activities: ActivityEntry[] = [
  {
    id: '1',
    user: 'Admin',
    action: 'completed task',
    target: 'Setup Qdrant Vector Collection',
    time: '10 minutes ago',
    icon: CheckCircle,
    accent: 'green',
  },
  {
    id: '2',
    user: 'Dev User',
    action: 'updated document',
    target: 'Architecture Overview',
    time: '1 hour ago',
    icon: FileText,
    accent: 'blue',
  },
  {
    id: '3',
    user: 'Dev User',
    action: 'commented on task',
    target: 'Kanban Board Interface',
    time: '2 hours ago',
    icon: MessageSquare,
    accent: 'violet',
  },
];

export function ActivityTimelineView() {
  return (
    <Page>
      <PageHeader
        title="Activity"
        description="A running log of everything happening in this workspace."
        icon={<Activity />}
        accent="violet"
      />

      <Panel>
        {/* An ordered list: the sequence is the meaning of a timeline. */}
        <ol className="space-y-5 pl-6 relative border-l border-border">
          {activities.map((entry) => {
            const Icon = entry.icon;
            return (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'top-1 size-6 absolute -left-[31px] flex items-center justify-center rounded-full border bg-surface',
                    accentClasses[entry.accent].text,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="max-w-xl p-3 rounded-lg border bg-surface-muted">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{entry.user}</span>{' '}
                    {entry.action}{' '}
                    <span className="font-medium text-accent-blue">
                      {entry.target}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.time}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </Page>
  );
}
