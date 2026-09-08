import { useCurrentUser } from '@org/auth';
import type { AttentionItem, TrendDelta } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  SkeletonList,
  TrendBadge,
  UserAvatar,
} from '@org/ui';
import {
  formatBytes,
  formatCount,
  formatDate,
  formatRelative,
} from '@org/utils';
import {
  useAIUsageAnalytics,
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
import { useDocuments, useTasks } from '@org/web-work-tools';
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

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className = '',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Users;
  trend?: TrendDelta;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="size-8 flex items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="font-semibold text-2xl tracking-tight text-foreground">
          {value}
        </div>
        <div className="gap-2 flex items-center text-xs text-muted-foreground">
          {trend ? <TrendBadge trend={trend} /> : null}
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

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
    <div className="p-3 rounded-card border border-border bg-surface transition-colors hover:border-primary/40 flex flex-col justify-between gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 shrink-0">
            {item.category === 'URGENT' ? (
              <Flame className="size-4 text-destructive animate-pulse" />
            ) : item.sourceType === 'task' ? (
              <CheckCircle2 className="size-4 text-amber-500" />
            ) : item.sourceType === 'mention' ? (
              <MessageSquare className="size-4 text-primary" />
            ) : (
              <AlertCircle className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground truncate">
                {item.title}
              </span>
              <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                {item.category}
              </Badge>
            </div>
            {item.description ? (
              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                {item.description}
              </p>
            ) : null}
          </div>
        </div>

        <button
          onClick={() => onDismiss(item.itemKey)}
          className="text-muted-foreground/60 hover:text-foreground shrink-0 transition-colors p-1"
          title="Dismiss from attention"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
        <div className="text-muted-foreground flex items-center gap-1.5 truncate">
          <Clock className="size-3" />
          <span>{formatRelative(new Date(item.timestamp).getTime())}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.sourceType === 'task' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={() => onComplete(item.sourceId)}
            >
              Done
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => onSnooze(item.itemKey)}
          >
            Snooze
          </Button>
          <Button asChild variant="primary" size="sm" className="h-6 text-[11px] px-2.5">
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
  const members = useMembers(workspaceId);
  const integrations = useIntegrations(workspaceId);

  // Analytics queries (preserved for Analytics tab)
  const dashboardAnalytics = useDashboardAnalytics(30);
  const aiUsage = useAIUsageAnalytics(30);
  const storageAnalytics = useStorageAnalytics(30);

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
      link: `/w/${slug}/agents/builder`,
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Dynamic Header & Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground flex items-center gap-2.5">
            <span>
              {catchUp.data?.greeting ?? `Welcome back, ${user?.displayName || user?.name || 'there'}!`}
            </span>
            <span className="size-2 rounded-full bg-emerald-500 inline-block" title="Connected" />
          </h1>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
            <span>Workspace:</span>
            <strong className="text-foreground font-medium">{workspace?.name ?? slug}</strong>
            <span>•</span>
            <span>{formatDate(new Date())}</span>
          </p>
        </div>

        {/* Tab Switcher: Home Experience vs Analytics */}
        <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'home'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="size-3.5 text-primary" />
            <span>Overview &amp; Action</span>
            {attentionItems.length > 0 ? (
              <Badge variant="primary" className="text-[10px] px-1 py-0 h-4">
                {attentionItems.length}
              </Badge>
            ) : null}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'analytics'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="size-3.5" />
            <span>Analytics &amp; Metrics</span>
          </button>
        </div>
      </div>

      {activeTab === 'home' ? (
        /* UNIFIED INTELLIGENT HOME WORKSPACE */
        <div className="space-y-8">
          {/* SECTION 1: NEEDS YOUR ATTENTION */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Needs Your Attention
                </h2>
                {attentionItems.length > 0 ? (
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
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
              <Card className="bg-surface/50 border-dashed">
                <CardContent className="py-6 flex flex-col items-center text-center">
                  <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    You're all caught up!
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5">
                    No urgent tasks, unread mentions, or overdue items need your attention right now.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {attentionItems.map((item: AttentionItem) => (
                  <AttentionCard
                    key={item.itemKey}
                    item={item}
                    slug={slug}
                    onComplete={(taskId) => attentionMutations.markComplete(taskId)}
                    onSnooze={(key) => attentionMutations.snooze({ itemKey: key, durationMinutes: 60 })}
                    onDismiss={(key) => attentionMutations.dismiss(key)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SECTION 2: CONTINUE WHERE YOU LEFT OFF */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Continue Where You Left Off
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Jump right back into your active context
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Last Conversation */}
              <Link
                to={lastVisitedChannel ? `/w/${slug}/c/${lastVisitedChannel.slug}` : `/w/${slug}/channels`}
                className="group p-3.5 rounded-card border border-border bg-surface hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wider">
                      Conversation
                    </span>
                    <Hash className="size-3.5 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                    {lastVisitedChannel ? `#${lastVisitedChannel.name}` : 'Browse Channels'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {lastVisitedChannel?.topic || 'Resume discussions in channel'}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-primary font-medium">
                  <span>Open channel</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Active Task */}
              <Link
                to={inProgressTask ? `/w/${slug}/tasks?taskId=${inProgressTask.id}` : `/w/${slug}/tasks`}
                className="group p-3.5 rounded-card border border-border bg-surface hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wider">
                      Active Task
                    </span>
                    <CheckCircle2 className="size-3.5 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                    {inProgressTask ? (inProgressTask.identifier ? `${inProgressTask.identifier} ${inProgressTask.title}` : inProgressTask.title) : 'Kanban Board'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {inProgressTask ? `Status: ${inProgressTask.status}` : 'View and create project tasks'}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-primary font-medium">
                  <span>Resume work</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Document Editor */}
              <Link
                to={recentDoc ? `/w/${slug}/docs/${recentDoc.id}` : `/w/${slug}/docs`}
                className="group p-3.5 rounded-card border border-border bg-surface hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wider">
                      Document
                    </span>
                    <FileText className="size-3.5 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                    {recentDoc ? recentDoc.title || 'Untitled Document' : 'Workspace Docs'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {recentDoc ? `Updated ${formatRelative(new Date(recentDoc.updatedAt).getTime())}` : 'Notion-style notes and specs'}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-primary font-medium">
                  <span>Continue writing</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>

              {/* Direct Messages */}
              <Link
                to={`/w/${slug}/dms`}
                className="group p-3.5 rounded-card border border-border bg-surface hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-muted-foreground mb-2">
                    <span className="text-[10px] uppercase font-semibold tracking-wider">
                      Direct Messages
                    </span>
                    <MessageSquare className="size-3.5 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                    Direct Conversations
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    1:1 chats with team members
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-primary font-medium">
                  <span>Open DMs</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          </section>

          {/* SECTION 3 & 4: CATCH UP + NEXT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catch Up Timeline (Col span 2) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Catch Up (While You Were Away)
                  </h2>
                </div>
                <Button asChild variant="outline" size="sm" className="h-6 text-[11px]">
                  <Link to={`/w/${slug}/inbox`}>View All Inbox</Link>
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2.5 rounded-md bg-accent/40 border border-border text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.unreadMentionsCount ?? 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Mentions
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-accent/40 border border-border text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.tasksCompletedCount ?? 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Tasks Done
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-accent/40 border border-border text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.decisionsMadeCount ?? 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Decisions
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md bg-accent/40 border border-border text-center">
                      <div className="text-lg font-bold text-foreground">
                        {catchUp.data?.activeHuddlesCount ?? 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Huddles
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-1">
                  {catchUp.data?.keyUpdates && catchUp.data.keyUpdates.length > 0 ? (
                    catchUp.data.keyUpdates.slice(0, 5).map((update) => (
                      <Link
                        key={update.id}
                        to={`/w/${slug}/${update.href}`}
                        className="p-2.5 flex items-center justify-between rounded-md border border-border/60 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {update.actor ? (
                            <UserAvatar
                              name={update.actor.name}
                              src={update.actor.avatarUrl ?? undefined}
                              className="size-6"
                            />
                          ) : (
                            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {update.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {update.summary}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatRelative(new Date(update.timestamp).getTime())}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No new activity recorded since your last visit.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Next Recommended Actions (Col span 1) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
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
                  <Link
                    to={`/w/${slug}/tasks`}
                    className="p-2.5 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Create Project Task
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/meetings`}
                    className="p-2.5 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Video className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Schedule Team Meeting
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/agents/builder`}
                    className="p-2.5 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        Configure AI Assistant
                      </span>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>

                  <Link
                    to={`/w/${slug}/docs`}
                    className="p-2.5 rounded-md border border-border hover:border-primary/40 hover:bg-accent/30 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
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
        /* ANALYTICS & METRICS TAB (Preserved Foundation) */
        <div className="space-y-6">
          <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
            <MetricCard
              title="Active Coworkers"
              value={formatCount(dashboardAnalytics.data?.totals.members ?? memberCount)}
              subtitle={`${memberCount} registered`}
              icon={Users}
              trend={dashboardAnalytics.data?.headline.members}
            />
            <MetricCard
              title="Public & Private Channels"
              value={formatCount(dashboardAnalytics.data?.totals.channels ?? channelCount)}
              subtitle={`${groups.favorites.length} pinned as favourite`}
              icon={Hash}
            />
            <MetricCard
              title="Cloud Storage Used"
              value={formatBytes(storageAnalytics.data?.totalBytes ?? 0)}
              subtitle="Files, attachments & canvas assets"
              icon={BarChart3}
            />
            <MetricCard
              title="AI Studio Assistant Tokens"
              value={formatCount(aiUsage.data?.estimatedTokens ?? 0)}
              subtitle="LLM inference consumed"
              icon={Bot}
            />
          </div>

          <div className="lg:grid-cols-3 gap-6 grid grid-cols-1">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold gap-2 flex items-center">
                      <LayoutDashboard className="size-4 text-primary" aria-hidden />
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
                              <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
                            ) : (
                              <div className="size-4 rounded-full border-2 border-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">{step.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{step.desc}</p>
                          </div>
                        </div>
                        <Button asChild variant="ghost" size="icon-sm" className="shrink-0">
                          <Link to={step.link} aria-label={`Open ${step.title}`}>
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
                    <Button asChild variant="outline" size="sm" className="text-xs h-7">
                      <Link to={`/w/${slug}/channels`}>Browse all ({channelCount})</Link>
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
                          <Link to={`/w/${slug}/channels/new`}>Create channel</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="sm:grid-cols-2 gap-2 grid grid-cols-1">
                      {[...groups.favorites, ...groups.joined].slice(0, 8).map((channel) => (
                        <Link
                          key={channel.id}
                          to={`/w/${slug}/c/${channel.slug}`}
                          className="p-2.5 group flex items-center justify-between rounded-card border border-border/70 bg-surface/40 hover:bg-surface hover:border-border transition-colors"
                        >
                          <div className="gap-2 min-w-0 flex items-center">
                            <div className="text-muted-foreground group-hover:text-primary transition-colors">
                              {channel.visibility === 'PRIVATE' ? (
                                <Lock className="size-3.5" />
                              ) : (
                                <Hash className="size-3.5" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-foreground truncate">
                              {channel.name}
                            </span>
                          </div>
                          <ChevronRight className="size-3 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
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
                  <CardTitle className="text-sm font-semibold">Platform Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                    <Link to={`/w/${slug}/members`}>
                      <UserPlus className="size-3.5 mr-2" />
                      Invite Coworkers
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                    <Link to={`/w/${slug}/meetings`}>
                      <Video className="size-3.5 mr-2" />
                      Launch Huddle
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                    <Link to={`/w/${slug}/agents/builder`}>
                      <Bot className="size-3.5 mr-2" />
                      Deploy AI Assistant
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                    <Link to={`/w/${slug}/automations/builder`}>
                      <Workflow className="size-3.5 mr-2" />
                      Build Workflows
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Storage Meter */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Storage Meter</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Used Capacity</span>
                    <span className="font-semibold text-foreground">
                      {formatBytes(storageAnalytics.data?.totalBytes ?? 0)}
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.round(((storageAnalytics.data?.totalBytes ?? 0) / (10 * 1024 * 1024 * 1024)) * 100))} />
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
