import { useCurrentUser } from '@org/auth';
import type { AttentionItem } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DateRangeFilter,
  EmptyState,
  Progress,
  SkeletonList,
  StatCard,
  UserAvatar,
  ResponsiveTabs,
} from '@org/ui';
import {
  formatBytes,
  formatCount,
  formatDate,
  formatRelative,
} from '@org/utils';
import {
  useAIUsageAnalytics,
  useAnalyticsDateRange,
  useDashboardAnalytics,
  useStorageAnalytics,
} from '@org/web-analytics';
import { useChannels, useGroupedChannels } from '@org/web-channels';
import { useIntegrations } from '@org/web-integrations';
import { useMembers } from '@org/web-members';
import {
  useAttention,
  useAttentionMutations,
  useCatchUp,
} from '@org/notifications';
import { useDocuments, useMeetings, useTasks } from '@org/web-work-tools';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Flame,
  Hash,
  History,
  Inbox,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Plus,
  UserPlus,
  Users,
  Video,
  Workflow,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AIActivitySection } from '../ai-activity-section.js';

function AttentionCard({
  item,
  onComplete,
  onSnooze,
  onDismiss,
  slug,
}: {
  item: AttentionItem;
  onComplete: (id: string) => void;
  onSnooze: (key: string) => void;
  onDismiss: (key: string) => void;
  slug: string;
}) {
  const badgeVariant =
    item.category === 'URGENT'
      ? 'destructive'
      : item.category === 'IMPORTANT'
        ? 'warning'
        : 'neutral';

  return (
    <div className="p-3 gap-2.5 flex flex-col justify-between rounded-card border border-border bg-surface transition-colors hover:border-primary/40">
      <div className="gap-3 flex items-start justify-between">
        <div className="gap-2.5 min-w-0 flex items-start">
          <div className="mt-0.5 shrink-0">
            {item.category === 'URGENT' ? (
              <Flame className="size-4 animate-pulse text-destructive" />
            ) : item.sourceType === 'task' ? (
              <CheckCircle2 className="size-4 text-amber-500" />
            ) : item.sourceType === 'mention' ? (
              <MessageSquare className="size-4 text-primary" />
            ) : (
              <AlertCircle className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="gap-2 flex flex-wrap items-center">
              <span className="text-xs font-semibold truncate text-foreground">
                {item.title}
              </span>
              <Badge
                variant={badgeVariant}
                className="px-1.5 py-0 h-4 text-[10px]"
              >
                {item.category}
              </Badge>
            </div>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => onDismiss(item.itemKey)}
          className="p-1 shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
          title="Dismiss from attention"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="pt-1 flex items-center justify-between border-t border-border/40 text-[11px]">
        <div className="gap-1.5 flex items-center truncate text-muted-foreground">
          <Clock className="size-3" />
          <span>{formatRelative(new Date(item.timestamp).getTime())}</span>
        </div>

        <div className="gap-1.5 flex shrink-0 items-center">
          {item.sourceType === 'task' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => onComplete(item.sourceId)}
            >
              Done
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => onSnooze(item.itemKey)}
          >
            Snooze
          </Button>
          <Button
            asChild
            variant="primary"
            size="sm"
            className="h-6 px-2.5 text-[11px]"
          >
            <Link to={`/w/${slug}/${item.deepLink}`}>Open</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { workspace, slug: workspaceSlug, workspaceId } = useCurrentWorkspace();
  const user = useCurrentUser();
  const slug = workspaceSlug ?? '';

  const [activeTab, setActiveTab] = useState<'home' | 'analytics'>('home');
  const [showGuide, setShowGuide] = useState(true);

  // Intelligence hooks
  const attention = useAttention(workspaceId);
  const attentionMutations = useAttentionMutations(workspaceId);
  const catchUp = useCatchUp(workspaceId);

  // Work tools & channel queries
  const channels = useChannels(workspaceId);
  const groups = useGroupedChannels(channels.data);
  const tasks = useTasks(workspaceId);
  const documents = useDocuments(workspaceId);
  const upcomingMeetings = useMeetings(workspaceId, { scope: 'upcoming' });
  const members = useMembers(workspaceId);
  const integrations = useIntegrations(workspaceId);

  // Analytics tab: one shared date range, and nothing fetched until the tab
  // is opened — these are the three most expensive aggregations in the API
  // and the home tab never shows them.
  const analyticsRange = useAnalyticsDateRange(workspaceId);
  const analyticsOptions = { enabled: activeTab === 'analytics' };
  const dashboardAnalytics = useDashboardAnalytics(
    workspaceId,
    analyticsRange.query,
    analyticsOptions,
  );
  const aiUsage = useAIUsageAnalytics(
    workspaceId,
    analyticsRange.query,
    analyticsOptions,
  );
  const storageAnalytics = useStorageAnalytics(
    workspaceId,
    analyticsRange.query,
    analyticsOptions,
  );

  const channelCount = channels.data?.length ?? 0;
  const memberCount = members.data?.length ?? 0;
  const activeTasksList = tasks.data ?? [];
  const inProgressTask = activeTasksList.find(
    (t) => t.status === 'IN_PROGRESS' || t.status === 'TODO',
  );
  const recentDoc = documents.data?.[0];
  const lastVisitedChannel = groups.favorites[0] || groups.joined[0];

  const attentionItems: AttentionItem[] = attention.data ?? [];

  const onboardingSteps = [
    {
      title: 'Join or create your first team channel',
      desc: 'Set up public topic or department channels for transparent conversations.',
      done: channelCount > 0,
      link: `/w/${slug}/channels`,
    },
    {
      title: 'Invite core coworkers and collaborators',
      desc: 'Grow your company directory to unlock direct messaging and task tagging.',
      done: memberCount > 1,
      link: `/w/${slug}/members`,
    },
    {
      title: 'Configure third-party integrations',
      desc: 'Sync status feeds from GitHub, Figma, Jira or Linear directly into channels.',
      done: (integrations.data?.length ?? 0) > 0,
      link: `/w/${slug}/integrations`,
    },
    {
      title: 'Explore AI Agents & Automations',
      desc: 'Deploy prompt assistants or automate recurring cross-platform routines.',
      done: false,
      link: `/w/${slug}/ai/agents/new`,
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Dynamic Header & Greeting */}
      <div className="gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 flex flex-col border-b border-border">
        <div>
          {/* The green "Connected" dot that sat here was hard-coded — it never
              reflected any connection, so it is gone; the shell's sync pill
              is the real signal. */}
          <h1 className="font-semibold text-xl tracking-tight text-balance text-foreground">
            {catchUp.data?.greeting ??
              `Welcome back, ${user?.displayName || user?.name || 'there'}!`}
          </h1>
          <p className="mt-1 text-xs gap-2 flex items-center text-muted-foreground">
            <span>Workspace:</span>
            <strong className="font-medium text-foreground">
              {workspace?.name ?? slug}
            </strong>
            <span>•</span>
            <span>{formatDate(new Date())}</span>
          </p>
        </div>

        {/* Tab Switcher: Home Experience vs Analytics */}
        <ResponsiveTabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'home' | 'analytics')}
          variant="segmented"
          size="sm"
          className="min-w-0 sm:self-auto sm:shrink-0 max-w-full self-start"
          items={[
            {
              value: 'home',
              label: 'Overview',
              icon: <Compass className="size-3.5 text-primary" />,
              count:
                attentionItems.length > 0 ? attentionItems.length : undefined,
            },
            {
              value: 'analytics',
              label: 'Analytics',
              icon: <BarChart3 className="size-3.5" />,
            },
          ]}
        />
      </div>

      {activeTab === 'home' ? (
        /* UNIFIED INTELLIGENT HOME WORKSPACE */
        <div className="space-y-8">
          {/* SECTION 1: NEEDS YOUR ATTENTION */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="gap-2 flex items-center">
                <Bell className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Needs Your Attention
                </h2>
                {attentionItems.length > 0 ? (
                  <Badge
                    variant="warning"
                    className="px-1.5 py-0 h-4 text-[10px]"
                  >
                    {attentionItems.length} pending
                  </Badge>
                ) : null}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Priority ranked items requiring action
              </span>
            </div>

            {attention.isLoading ? (
              <SkeletonList rows={2} />
            ) : attentionItems.length === 0 ? (
              <Card className="border-dashed bg-surface/50">
                <CardContent className="py-6 flex flex-col items-center text-center">
                  <div className="size-10 mb-2 flex items-center justify-center rounded-full bg-success/10 text-success-text">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    You're all caught up!
                  </p>
                  <p className="max-w-sm mt-0.5 text-[11px] text-muted-foreground">
                    No urgent tasks, unread mentions, or overdue items need your
                    attention right now.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="md:grid-cols-2 lg:grid-cols-3 gap-3 grid grid-cols-1">
                {attentionItems.map((item: AttentionItem) => (
                  <AttentionCard
                    key={item.itemKey}
                    item={item}
                    slug={slug}
                    onComplete={(taskId) =>
                      attentionMutations.markComplete(taskId)
                    }
                    onSnooze={(key) =>
                      attentionMutations.snooze({
                        itemKey: key,
                        durationMinutes: 60,
                      })
                    }
                    onDismiss={(key) => attentionMutations.dismiss(key)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SECTION 1b: WHAT COWORKERS, AGENTS AND WORKFLOWS ARE DOING */}
          <AIActivitySection workspaceId={workspaceId} slug={slug} />

          {/* SECTION 2: CONTINUE WHERE YOU LEFT OFF */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="gap-2 flex items-center">
                <History className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Continue Where You Left Off
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Jump right back into your active context
              </span>
            </div>

            <div className="sm:grid-cols-2 lg:grid-cols-4 gap-3 grid grid-cols-1">
              {/* Last Conversation */}
              <Link
                to={
                  lastVisitedChannel
                    ? `/w/${slug}/channels/${lastVisitedChannel.slug}`
                    : `/w/${slug}/channels`
                }
                className="group p-3.5 flex flex-col justify-between rounded-card border border-border bg-surface transition-all hover:border-primary/50"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold tracking-wider text-[10px] uppercase">
                      Conversation
                    </span>
                    <Hash className="size-3.5 transition-colors group-hover:text-primary" />
                  </div>
                  <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary">
                    {lastVisitedChannel
                      ? `#${lastVisitedChannel.name}`
                      : 'Browse Channels'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {lastVisitedChannel?.topic ||
                      'Resume discussions in channel'}
                  </p>
                </div>
                <div className="mt-3 font-medium flex items-center justify-between text-[11px] text-primary">
                  <span>Open channel</span>
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Active Task */}
              <Link
                to={
                  inProgressTask
                    ? `/w/${slug}/projects?taskId=${inProgressTask.id}`
                    : `/w/${slug}/projects`
                }
                className="group p-3.5 flex flex-col justify-between rounded-card border border-border bg-surface transition-all hover:border-primary/50"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold tracking-wider text-[10px] uppercase">
                      Active Task
                    </span>
                    <CheckCircle2 className="size-3.5 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary">
                    {inProgressTask
                      ? inProgressTask.identifier
                        ? `${inProgressTask.identifier} ${inProgressTask.title}`
                        : inProgressTask.title
                      : 'Kanban Board'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {inProgressTask
                      ? `Status: ${inProgressTask.status}`
                      : 'View and create project tasks'}
                  </p>
                </div>
                <div className="mt-3 font-medium flex items-center justify-between text-[11px] text-primary">
                  <span>Resume work</span>
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Document Editor */}
              <Link
                to={
                  recentDoc
                    ? `/w/${slug}/docs/${recentDoc.id}`
                    : `/w/${slug}/docs`
                }
                className="group p-3.5 flex flex-col justify-between rounded-card border border-border bg-surface transition-all hover:border-primary/50"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold tracking-wider text-[10px] uppercase">
                      Document
                    </span>
                    <FileText className="size-3.5 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary">
                    {recentDoc
                      ? recentDoc.title || 'Untitled Document'
                      : 'Workspace Docs'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {recentDoc
                      ? `Updated ${formatRelative(new Date(recentDoc.updatedAt).getTime())}`
                      : 'Notion-style notes and specs'}
                  </p>
                </div>
                <div className="mt-3 font-medium flex items-center justify-between text-[11px] text-primary">
                  <span>Continue writing</span>
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Direct Messages */}
              <Link
                to={`/w/${slug}/dms`}
                className="group p-3.5 flex flex-col justify-between rounded-card border border-border bg-surface transition-all hover:border-primary/50"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold tracking-wider text-[10px] uppercase">
                      Direct Messages
                    </span>
                    <MessageSquare className="size-3.5 transition-colors group-hover:text-success-text" />
                  </div>
                  <p className="text-xs font-semibold truncate text-foreground group-hover:text-primary">
                    Direct Conversations
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    1:1 chats with team members
                  </p>
                </div>
                <div className="mt-3 font-medium flex items-center justify-between text-[11px] text-primary">
                  <span>Open DMs</span>
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </section>

          {/* SECTION 3 & 4: CATCH UP + NEXT */}
          <div className="lg:grid-cols-3 gap-6 grid grid-cols-1">
            {/* Catch Up Timeline (Col span 2) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="gap-2 flex items-center">
                  <Inbox className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Catch Up (While You Were Away)
                  </h2>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px]"
                >
                  <Link to={`/w/${slug}/inbox`}>View All Inbox</Link>
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="sm:grid-cols-4 gap-2 pt-1 grid grid-cols-2">
                    <div className="p-2.5 rounded-md border border-border bg-accent/40 text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.unreadMentionsCount ?? 0}
                      </div>
                      <div className="tracking-wide text-[10px] text-muted-foreground uppercase">
                        Mentions
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md border border-border bg-accent/40 text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.tasksCompletedCount ?? 0}
                      </div>
                      <div className="tracking-wide text-[10px] text-muted-foreground uppercase">
                        Tasks Done
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md border border-border bg-accent/40 text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.decisionsMadeCount ?? 0}
                      </div>
                      <div className="tracking-wide text-[10px] text-muted-foreground uppercase">
                        Decisions
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md border border-border bg-accent/40 text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.activeHuddlesCount ?? 0}
                      </div>
                      <div className="tracking-wide text-[10px] text-muted-foreground uppercase">
                        Huddles
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-1">
                  {catchUp.data?.keyUpdates &&
                  catchUp.data.keyUpdates.length > 0 ? (
                    catchUp.data.keyUpdates.slice(0, 5).map((update) => (
                      <Link
                        key={update.id}
                        to={`/w/${slug}/${update.href}`}
                        className="p-2.5 flex items-center justify-between rounded-md border border-border/60 transition-colors hover:bg-accent/40"
                      >
                        <div className="gap-2.5 min-w-0 flex items-center">
                          {update.actor ? (
                            <UserAvatar
                              name={update.actor.name}
                              src={update.actor.avatarUrl ?? undefined}
                              className="size-6"
                            />
                          ) : (
                            <div className="size-6 font-bold flex items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
                              ✓
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate text-foreground">
                              {update.title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {update.summary}
                            </p>
                          </div>
                        </div>
                        <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(new Date(update.timestamp).getTime())}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs py-4 text-center text-muted-foreground">
                      No new activity recorded since your last visit.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Next Recommended Actions (Col span 1) */}
            <div className="space-y-3">
              <div className="gap-2 flex items-center">
                <Compass className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  What Next?
                </h2>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">
                    RECOMMENDED ACTIONS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(upcomingMeetings.data ?? []).slice(0, 2).map((meeting) => (
                    <Link
                      key={meeting.id}
                      to={`/w/${slug}/meetings?meeting=${meeting.id}`}
                      className="p-2.5 gap-2 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 transition-all hover:bg-primary/10"
                    >
                      <div className="min-w-0 gap-2 flex items-center">
                        <Clock className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium block truncate text-foreground">
                            {meeting.title}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {formatRelative(
                              new Date(meeting.startAt).getTime(),
                            )}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                  <Link
                    to={`/w/${slug}/projects`}
                    className="p-2.5 flex items-center justify-between rounded-md border border-border transition-all hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="gap-2 flex items-center">
                      <Plus className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Create Project Task
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/meetings`}
                    className="p-2.5 flex items-center justify-between rounded-md border border-border transition-all hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="gap-2 flex items-center">
                      <Video className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Schedule Team Meeting
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/ai/agents/new`}
                    className="p-2.5 flex items-center justify-between rounded-md border border-border transition-all hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="gap-2 flex items-center">
                      <Bot className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Configure AI Assistant
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/docs`}
                    className="p-2.5 flex items-center justify-between rounded-md border border-border transition-all hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="gap-2 flex items-center">
                      <FileText className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        New Spec or Note
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* ANALYTICS & METRICS TAB */
        <div className="space-y-6">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Trends compare the selected range with the period before it.
            </p>
            <DateRangeFilter
              value={analyticsRange.range}
              onChange={analyticsRange.setRange}
            />
          </div>
          <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
            <StatCard
              label="Active Coworkers"
              value={formatCount(
                dashboardAnalytics.data?.totals.members ?? memberCount,
              )}
              hint={`${memberCount} registered`}
              icon={Users}
              trend={dashboardAnalytics.data?.headline.members}
            />
            <StatCard
              label="Public & Private Channels"
              value={formatCount(
                dashboardAnalytics.data?.totals.channels ?? channelCount,
              )}
              hint={`${groups.favorites.length} pinned as favourite`}
              icon={Hash}
            />
            <StatCard
              label="Cloud Storage Used"
              value={
                storageAnalytics.data
                  ? formatBytes(storageAnalytics.data.totalBytes)
                  : storageAnalytics.isError
                    ? 'Unavailable'
                    : '—'
              }
              hint="Files, attachments & canvas assets"
              icon={BarChart3}
            />
            <StatCard
              label="AI Studio Assistant Tokens"
              value={
                aiUsage.data
                  ? formatCount(aiUsage.data.estimatedTokens)
                  : aiUsage.isError
                    ? 'Unavailable'
                    : '—'
              }
              hint="LLM inference consumed"
              icon={Bot}
            />
          </div>

          <div className="lg:grid-cols-3 gap-6 grid grid-cols-1">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold gap-2 flex items-center">
                      <LayoutDashboard
                        className="size-4 text-primary"
                        aria-hidden
                      />
                      <span>Company Activation Checklist</span>
                    </CardTitle>
                    <button
                      onClick={() => setShowGuide((prev) => !prev)}
                      className="text-xs text-subtle transition-colors hover:text-foreground"
                    >
                      {showGuide ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </CardHeader>
                {showGuide ? (
                  <CardContent className="space-y-2 pt-0">
                    {onboardingSteps.map((step) => (
                      <div
                        key={step.title}
                        className="p-3 flex items-center justify-between rounded-card border border-border/80 bg-surface/50 transition-colors hover:bg-surface"
                      >
                        <div className="gap-3 min-w-0 flex items-start">
                          <div className="mt-0.5 shrink-0">
                            {step.done ? (
                              <CheckCircle2
                                className="size-4 text-success-text"
                                aria-hidden
                              />
                            ) : (
                              <div className="size-4 rounded-full border-2 border-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {step.title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                        >
                          <Link
                            to={step.link}
                            aria-label={`Open ${step.title}`}
                          >
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                ) : null}
              </Card>

              {/* Active Channels List */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        Active Company Channels
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Channels you are currently joined in.
                      </CardDescription>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                    >
                      <Link to={`/w/${slug}/channels`}>
                        Browse all ({channelCount})
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {channels.isLoading ? (
                    <SkeletonList rows={4} />
                  ) : groups.favorites.length + groups.joined.length === 0 ? (
                    <EmptyState
                      size="sm"
                      icon={<Hash />}
                      title="No channels yet"
                      description="Join or create a channel to collaborate with your team."
                      action={
                        <Button asChild size="sm">
                          <Link to={`/w/${slug}/channels/new`}>
                            Create channel
                          </Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="sm:grid-cols-2 gap-2 grid grid-cols-1">
                      {[...groups.favorites, ...groups.joined]
                        .slice(0, 8)
                        .map((channel) => (
                          <Link
                            key={channel.id}
                            to={`/w/${slug}/channels/${channel.slug}`}
                            className="p-2.5 group flex items-center justify-between rounded-card border border-border/70 bg-surface/40 transition-colors hover:border-border hover:bg-surface"
                          >
                            <div className="gap-2 min-w-0 flex items-center">
                              <div className="text-muted-foreground transition-colors group-hover:text-primary">
                                {channel.visibility === 'PRIVATE' ? (
                                  <Lock className="size-3.5" />
                                ) : (
                                  <Hash className="size-3.5" />
                                )}
                              </div>
                              <span className="text-xs font-medium truncate text-foreground">
                                {channel.name}
                              </span>
                            </div>
                            <ChevronRight className="size-3 group-hover:translate-x-0.5 text-muted-foreground/60 transition-transform" />
                          </Link>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Quick Actions Panel */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Platform Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 w-full justify-start"
                  >
                    <Link to={`/w/${slug}/members`}>
                      <UserPlus className="size-3.5 mr-2" />
                      Invite Coworkers
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 w-full justify-start"
                  >
                    <Link to={`/w/${slug}/meetings`}>
                      <Video className="size-3.5 mr-2" />
                      Launch Huddle
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 w-full justify-start"
                  >
                    <Link to={`/w/${slug}/ai/agents/new`}>
                      <Bot className="size-3.5 mr-2" />
                      Deploy AI Assistant
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 w-full justify-start"
                  >
                    <Link to={`/w/${slug}/ai/workflows/new`}>
                      <Workflow className="size-3.5 mr-2" />
                      Build Workflows
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Storage Meter */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Storage Meter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Used Capacity</span>
                    <span className="font-semibold text-foreground">
                      {formatBytes(storageAnalytics.data?.totalBytes ?? 0)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.round(
                        ((storageAnalytics.data?.totalBytes ?? 0) /
                          (10 * 1024 * 1024 * 1024)) *
                          100,
                      ),
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    10 GB included in organization plan.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
