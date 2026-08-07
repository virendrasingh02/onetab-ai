import {
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bell,
  CheckCircle,
  Inbox,
  MessageSquare,
  Sparkles,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'mention' | 'activity' | 'system' | 'dm';
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Sarah Jenkins mentioned you in #general',
    body: 'Hey @team, can someone review the latest release notes draft?',
    time: '5m ago',
    read: false,
    type: 'mention',
  },
  {
    id: 'n2',
    title: 'New workflow execution finished',
    body: 'Automated CI/CD sync completed successfully with 0 errors.',
    time: '25m ago',
    read: false,
    type: 'system',
  },
  {
    id: 'n3',
    title: 'Direct message from Alex Rivera',
    body: 'I uploaded the vector database schema files into #dev-tools.',
    time: '1h ago',
    read: true,
    type: 'dm',
  },
  {
    id: 'n4',
    title: 'Workspace Pulse Update',
    body: '3 new integrations connected: GitHub, Jira, and Google Drive.',
    time: '3h ago',
    read: true,
    type: 'activity',
  },
];

interface UnreadMessage {
  id: string;
  channel: string;
  author: string;
  preview: string;
  time: string;
}

const unreadMessagesList: UnreadMessage[] = [
  {
    id: 'm1',
    channel: '#design-system',
    author: 'Elena Rostova',
    preview: 'Updated the HSL dark mode token palette and CSS variables.',
    time: '12m ago',
  },
  {
    id: 'm2',
    channel: '#announcements',
    author: 'Dev Admin',
    preview: 'Scheduled maintenance window for database migrations tonight at 10 PM.',
    time: '45m ago',
  },
  {
    id: 'm3',
    channel: '#frontend',
    author: 'Marcus Vance',
    preview: 'The new Inbox layout with embedded Notification Bell is live!',
    time: '2h ago',
  },
];

export function InboxView() {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState('notifications');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Page>
      <PageHeader
        title="Inbox"
        description="All your notifications, unread messages, mentions and updates in one place."
        icon={<Inbox />}
        accent="violet"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="primary" className="gap-1.5 px-3 py-1 text-xs">
              <Bell className="size-3.5" />
              <span>{unreadCount} Unread Notifications</span>
            </Badge>
            {unreadCount > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Embedded Notification Bell Highlight Banner */}
      <Card className="p-4 bg-surface-raised border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-0 right-0 size-3 rounded-full bg-destructive ring-2 ring-background" />
            ) : null}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Notification Bell &amp; Updates Center</span>
              <Badge variant="neutral">Embedded in Inbox</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Notifications are now integrated inside your Inbox for instant access without top-bar distraction.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setActiveTab('notifications')}
        >
          View Notifications ({notifications.length})
        </Button>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="size-4" />
            <span>Notifications</span>
            {unreadCount > 0 ? (
              <Badge variant="count">{unreadCount}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="unreads" className="gap-1.5">
            <MessageSquare className="size-4" />
            <span>Unread Messages</span>
            <Badge variant="neutral">{unreadMessagesList.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="mentions" className="gap-1.5">
            <User className="size-4" />
            <span>Mentions &amp; Replies</span>
          </TabsTrigger>
          <TabsTrigger value="starred" className="gap-1.5">
            <Star className="size-4" />
            <span>Starred</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4 space-y-3">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell />}
              title="You are all caught up!"
              description="No new notifications at this time."
            />
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Card
                    className={cn(
                      'p-4 transition-colors duration-(--duration-fast) flex items-start justify-between gap-4',
                      !item.read ? 'bg-selected/40 border-primary/30' : 'bg-surface',
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={cn(
                          'p-2 rounded-lg shrink-0 mt-0.5',
                          item.type === 'mention'
                            ? 'bg-violet-500/10 text-violet-500'
                            : item.type === 'system'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-emerald-500/10 text-emerald-500',
                        )}
                      >
                        {item.type === 'mention' ? (
                          <User className="size-4" />
                        ) : item.type === 'system' ? (
                          <Sparkles className="size-4" />
                        ) : (
                          <Zap className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {item.title}
                          </h4>
                          {!item.read ? (
                            <Badge variant="primary">New</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {item.body}
                        </p>
                        <span className="mt-1.5 block text-[10px] text-subtle font-mono">
                          {item.time}
                        </span>
                      </div>
                    </div>
                    {!item.read ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mark as read"
                        onClick={() =>
                          setNotifications((prev) =>
                            prev.map((n) =>
                              n.id === item.id ? { ...n, read: true } : n,
                            ),
                          )
                        }
                      >
                        <CheckCircle className="size-4 text-muted-foreground hover:text-success" />
                      </Button>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="unreads" className="mt-4 space-y-3">
          <ul className="space-y-2.5">
            {unreadMessagesList.map((msg) => (
              <li key={msg.id}>
                <Card className="p-4 bg-surface hover:border-border-strong transition-colors flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">
                        {msg.channel}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs font-medium text-foreground">
                        {msg.author}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {msg.preview}
                    </p>
                  </div>
                  <span className="text-[10px] text-subtle font-mono ml-4 shrink-0">
                    {msg.time}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="mentions" className="mt-4">
          <Card className="p-6 text-center text-xs text-muted-foreground">
            Mentions and replies will appear here when team members tag your profile.
          </Card>
        </TabsContent>

        <TabsContent value="starred" className="mt-4">
          <Card className="p-6 text-center text-xs text-muted-foreground">
            No starred items yet. Click the star icon on any message or notification to bookmark it for later.
          </Card>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
