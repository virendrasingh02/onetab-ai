import {
  Badge,
  Button,
  EmptyState,
  Panel,
  Page,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { Hash, MessagesSquare, Reply } from 'lucide-react';
import { useState } from 'react';

export interface ThreadSummary {
  id: string;
  channel: string;
  title: string;
  author: string;
  replies: number;
  lastReply: string;
  unread: boolean;
}

const threads: ThreadSummary[] = [
  {
    id: '1',
    channel: 'engineering',
    title: 'Qdrant collection schema — one collection per workspace?',
    author: 'Dev User',
    replies: 8,
    lastReply: '12m ago',
    unread: true,
  },
  {
    id: '2',
    channel: 'design',
    title: 'Sidebar grouping: platform sections vs. flat list',
    author: 'Priya Raman',
    replies: 4,
    lastReply: '2h ago',
    unread: true,
  },
  {
    id: '3',
    channel: 'general',
    title: 'Notes from the Slack import dry run',
    author: 'Admin',
    replies: 12,
    lastReply: 'Yesterday',
    unread: false,
  },
];

function ThreadList({ items }: { items: ThreadSummary[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="Nothing here"
        description="Threads you follow or are mentioned in will collect here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((thread) => (
        <li
          key={thread.id}
          className="gap-3 p-4 flex items-start hover:bg-muted/50"
        >
          <UserAvatar name={thread.author} seed={thread.id} />

          <div className="min-w-0 flex-1">
            <div className="gap-2 flex flex-wrap items-center">
              <Badge variant="outline">
                <Hash aria-hidden />
                {thread.channel}
              </Badge>
              {thread.unread ? <Badge variant="primary">Unread</Badge> : null}
            </div>

            <p className="mt-1.5 text-sm font-medium text-foreground">
              {thread.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Started by {thread.author} · {thread.replies} replies · last reply{' '}
              {thread.lastReply}
            </p>
          </div>

          <Button variant="ghost" size="sm" leadingIcon={<Reply />}>
            Reply
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Every thread the reader follows, across channels, in one place. */
export function ThreadsView() {
  const [tab, setTab] = useState('all');

  return (
    <Page>
      <PageHeader
        title="Threads"
        description="Follow-up conversations from every channel you are in."
        icon={<MessagesSquare />}
        accent="amber"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Thread filters" className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Panel flush>
            <ThreadList items={threads} />
          </Panel>
        </TabsContent>

        <TabsContent value="unread">
          <Panel flush>
            <ThreadList items={threads.filter((thread) => thread.unread)} />
          </Panel>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
