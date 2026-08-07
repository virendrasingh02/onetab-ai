import { useCurrentUser } from '@org/auth';
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
  UserAvatar,
} from '@org/ui';
import { formatCount } from '@org/utils';
import { useChannels, useGroupedChannels } from '@org/web-channels';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Hash,
  LayoutDashboard,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

function QuickActionCard({
  icon: Icon,
  title,
  description,
  to,
  badge,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  to: string;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between rounded-card border border-border bg-surface p-4 transition-all duration-200 hover:border-primary/50 hover:bg-accent/40 hover:shadow-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
        {badge ? (
          <Badge variant="primary" className="text-[10px]">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="flex items-center gap-1 font-medium text-xs text-foreground group-hover:text-primary">
          <span>{title}</span>
          <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof Sparkles;
  trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <Icon className="size-4 text-muted-foreground/70" aria-hidden />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
          {trend ? (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {trend}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const { slug, workspace, workspaceId } = useCurrentWorkspace();
  const channels = useChannels(workspaceId);
  const members = useMembers(workspaceId);
  const groups = useGroupedChannels(channels.data);
  const [showGuide, setShowGuide] = useState(true);

  const firstName = (user?.displayName ?? user?.name ?? '').split(' ')[0];
  const channelCount = workspace?.channelCount ?? 0;
  const memberCount = workspace?.memberCount ?? 0;

  // Company onboarding progress metrics
  const onboardingSteps = [
    {
      title: 'Company Channels',
      desc: 'Set up core department channels (#general, #engineering, #marketing).',
      done: channelCount > 1,
      link: `/w/${slug}/channels/new`,
    },
    {
      title: 'Team Members',
      desc: 'Invite colleagues & assign department roles (Admin, Member, Guest).',
      done: memberCount > 1,
      link: `/w/${slug}/invitations`,
    },
    {
      title: 'Integrations',
      desc: 'Connect Slack, Notion, GitHub or Google Workspace.',
      done: true,
      link: `/w/${slug}/integrations`,
    },
    {
      title: 'AI & Automations',
      desc: 'Deploy custom AI agents & automated workflow triggers.',
      done: true,
      link: `/w/${slug}/agents/builder`,
    },
  ];

  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedSteps / onboardingSteps.length) * 100);

  return (
    <div className="max-w-6xl space-y-6 mx-auto pb-8">
      {/* Top Banner: Company Workspace Hero */}
      <div className="rounded-card border border-border bg-gradient-to-r from-surface via-surface-raised to-accent/20 p-5 lg:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="gap-1 font-semibold text-[10px] uppercase">
                <Shield className="size-3" aria-hidden />
                Enterprise Workspace
              </Badge>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground font-medium">
                {workspace?.name ?? 'Company Hub'}
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">
              {firstName ? `Welcome back to ${workspace?.name}, ${firstName}` : `Welcome back to ${workspace?.name}`}
            </h1>
            <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
              Your central company hub for real-time collaboration, team channels, AI copilots, and automated workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/w/${slug}/invitations`}>
                <UserPlus className="size-3.5" />
                <span>Invite Team</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/w/${slug}/channels/new`}>
                <Plus className="size-3.5" />
                <span>New Channel</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Company Operational Progress Bar */}
        {showGuide ? (
          <div className="mt-5 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
                <span>Company Workspace Setup</span>
              </span>
              <span className="text-subtle font-mono text-[11px]">
                {completedSteps}/{onboardingSteps.length} Steps ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        ) : null}
      </div>

      {/* Key Company Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="Departments & Channels"
          value={formatCount(channelCount)}
          subtitle={`${groups.joined.length + groups.favorites.length} joined channels`}
          icon={Hash}
          trend="+2 new this week"
        />
        <MetricCard
          title="Team Members"
          value={formatCount(memberCount)}
          subtitle={`${members.data?.filter((m) => m.user.presence === 'ONLINE').length ?? 1} online right now`}
          icon={Users}
          trend="Active"
        />
        <MetricCard
          title="AI Agents Deployed"
          value="4"
          subtitle="Workspace copilots & auto-assistants"
          icon={Bot}
          trend="100% operational"
        />
        <MetricCard
          title="Automated Workflows"
          value="8"
          subtitle="Active triggers & integrations"
          icon={Workflow}
          trend="Active"
        />
      </div>

      {/* Company Quick Actions Matrix */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Company Quick Workflows
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={UserPlus}
            title="Invite Team Members"
            description="Add department members & assign workspace roles."
            to={`/w/${slug}/invitations`}
            badge="Directory"
          />
          <QuickActionCard
            icon={Plus}
            title="Create Department Channel"
            description="Set up public or private team channels for projects."
            to={`/w/${slug}/channels/new`}
          />
          <QuickActionCard
            icon={Bot}
            title="Deploy AI Agent"
            description="Create custom AI assistants tailored to company tasks."
            to={`/w/${slug}/agents/builder`}
            badge="AI Studio"
          />
          <QuickActionCard
            icon={Workflow}
            title="Build Workflows"
            description="Automate cross-tool workflows & status triggers."
            to={`/w/${slug}/automations/builder`}
          />
        </div>
      </div>

      {/* Detailed Company Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Channels & Company Onboarding Journey */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Onboarding Journey Guide */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <LayoutDashboard className="size-4 text-primary" aria-hidden />
                  <span>Company Activation Checklist</span>
                </CardTitle>
                <button
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="text-xs text-subtle hover:text-foreground transition-colors"
                >
                  {showGuide ? 'Hide' : 'Show'}
                </button>
              </div>
              <CardDescription className="text-xs">
                Follow these essential steps to get your organization fully operational on OneTab AI.
              </CardDescription>
            </CardHeader>
            {showGuide ? (
              <CardContent className="space-y-2 pt-0">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.title}
                    className="flex items-center justify-between p-3 rounded-card border border-border/80 bg-surface/50 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {step.done ? (
                          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
                        ) : (
                          <div className="size-4 rounded-full border-2 border-muted-foreground/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{step.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{step.desc}</p>
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

          {/* Department Channels Overview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Active Company Channels</CardTitle>
                  <CardDescription className="text-xs">
                    Channels &amp; department spaces you are currently joined in.
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[...groups.favorites, ...groups.joined].slice(0, 8).map((channel) => {
                    const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
                    return (
                      <Link
                        key={channel.id}
                        to={`/w/${slug}/c/${channel.slug}`}
                        className="group flex items-center justify-between p-2.5 rounded-card border border-border/80 bg-surface/40 hover:bg-accent hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                          <span className="text-xs font-medium truncate text-foreground">
                            {channel.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {channel.membership?.isFavorite ? (
                            <Star className="size-3.5 fill-warning text-warning" />
                          ) : null}
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                            {channel.memberCount}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Team Directory & Company AI Ecosystem */}
        <div className="space-y-6">
          {/* Teammates Directory */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="size-4 text-primary" aria-hidden />
                  <span>Team Directory</span>
                </CardTitle>
                <Badge variant="neutral" className="text-[10px]">
                  {memberCount} members
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Active team members in {workspace?.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.isLoading ? (
                <SkeletonList rows={4} withAvatar />
              ) : (
                <>
                  <ul className="space-y-2">
                    {members.data?.slice(0, 5).map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={member.user.displayName ?? member.user.name}
                            src={member.user.avatarUrl}
                            seed={member.user.id}
                            size="sm"
                            presence={member.user.presence === 'ONLINE' ? 'online' : 'offline'}
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate text-foreground leading-tight">
                              {member.user.displayName ?? member.user.name}
                            </p>
                            <p className="text-[10px] text-subtle truncate">
                              Team Member
                            </p>
                          </div>
                        </div>
                        <Badge variant="neutral" className="text-[10px] capitalize shrink-0">
                          {member.role.toLowerCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
                    <Button asChild variant="outline" size="sm" className="w-full text-xs h-7">
                      <Link to={`/w/${slug}/members`}>
                        <Users className="size-3.5 mr-1" />
                        View Directory
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="w-full text-xs h-7">
                      <Link to={`/w/${slug}/invitations`}>
                        <UserPlus className="size-3.5 mr-1" />
                        Invite
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Company AI Ecosystem Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <span>Company AI &amp; Analytics</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time usage and automated copilot health.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-card bg-surface-raised border border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">AI Token Usage</span>
                  <span className="text-primary font-mono text-[11px]">64% allocated</span>
                </div>
                <Progress value={64} className="h-1.5" />
                <p className="text-[10px] text-subtle">
                  Unlimited queries enabled on Enterprise Tier.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <Link
                  to={`/w/${slug}/analytics`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="size-3.5 text-muted-foreground" />
                    Company Analytics &amp; Reports
                  </span>
                  <ChevronRight className="size-3.5 text-subtle" />
                </Link>

                <Link
                  to={`/w/${slug}/settings`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="size-3.5 text-muted-foreground" />
                    Workspace Settings &amp; Security
                  </span>
                  <ChevronRight className="size-3.5 text-subtle" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
