import {
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RefreshButton,
  TimeSeriesChart,
  formatBytes,
  formatNumber,
  formatRelative,
} from '@org/analytics-ui';
import type { ReportType } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DateRangeFilter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@org/ui';
import { formatDateRangeSpan, getDateRangeLabel, resolveDateRange } from '@org/utils';
import {
  useAIUsageAnalytics,
  useAnalyticsDateRange,
  useDashboardAnalytics,
  useReportDefinitions,
  useReportDownload,
  useStorageAnalytics,
  useUserAnalytics,
} from '@org/web-analytics';
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  CheckSquare,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Files,
  Flame,
  FolderKanban,
  HardDrive,
  Hash,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

export interface WorkspaceCompanyAnalyticsProps {
  workspaceId: string | undefined;
  workspaceName?: string;
  onNavigateToTab?: (tab: string) => void;
}

type AnalyticsTab = 'overview' | 'people' | 'ai-usage' | 'storage' | 'reports';

/**
 * Settings → Analytics: the workspace's analytics surface.
 *
 * One `DateRangeFilter` drives every tab. Each tab's data comes from the
 * shared `@org/web-analytics` hooks, fetched once per (workspace, range) and
 * shared by the KPI cards, the chart and the tables under it — and only
 * fetched when its tab is actually open.
 */
export function WorkspaceCompanyAnalytics({
  workspaceId,
  workspaceName = 'Workspace',
  onNavigateToTab,
}: WorkspaceCompanyAnalyticsProps) {
  const { range, setRange, query } = useAnalyticsDateRange(workspaceId);
  const [tab, setTab] = useState<AnalyticsTab>('overview');

  const dashboard = useDashboardAnalytics(workspaceId, query, {
    enabled: tab === 'overview',
  });
  const people = useUserAnalytics(workspaceId, query, { enabled: tab === 'people' });
  const aiUsage = useAIUsageAnalytics(workspaceId, query, {
    enabled: tab === 'ai-usage',
  });
  const storage = useStorageAnalytics(workspaceId, query, {
    enabled: tab === 'storage',
  });
  const reports = useReportDefinitions(workspaceId, { enabled: tab === 'reports' });
  const download = useReportDownload(workspaceId);

  const active = {
    overview: dashboard,
    people,
    'ai-usage': aiUsage,
    storage,
    reports,
  }[tab];

  const rangeLabel = getDateRangeLabel(range);
  const rangeSpan = formatDateRangeSpan(resolveDateRange(range));

  const changeRangeAction = (
    <Button type="button" variant="outline" size="sm" onClick={() => setRange({ preset: 'last_90_days' })}>
      Show last 90 days
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="gap-4 flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight gap-2 flex items-center text-foreground">
            <BarChart3 className="size-5 text-primary" aria-hidden />
            <span>Company Analytics & Usage</span>
          </h2>
          <p className="text-xs sm:text-sm mt-0.5 text-muted-foreground">
            Activity trends, engagement and resource quotas for {workspaceName}.
          </p>
        </div>

        <div className="gap-2 flex shrink-0 flex-wrap items-center">
          <DateRangeFilter value={range} onChange={setRange} />
          <RefreshButton onClick={() => void active.refetch()} busy={active.isFetching} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AnalyticsTab)}>
        <TabsList variant="underline" size="sm" className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">
            <BarChart3 className="size-3.5" aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users className="size-3.5" aria-hidden />
            People
          </TabsTrigger>
          <TabsTrigger value="ai-usage">
            <Sparkles className="size-3.5" aria-hidden />
            AI & Compute
          </TabsTrigger>
          <TabsTrigger value="storage">
            <HardDrive className="size-3.5" aria-hidden />
            Storage & Files
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileSpreadsheet className="size-3.5" aria-hidden />
            Export Reports
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <QueryState
            isLoading={dashboard.isLoading}
            error={dashboard.error}
            onRetry={() => void dashboard.refetch()}
          >
            {dashboard.data ? (
              <div className="space-y-6">
                <div className="gap-3.5 sm:grid-cols-4 grid grid-cols-2">
                  <MetricCard label="Team Members" value={dashboard.data.totals.members} icon={Users} accent="blue" trend={dashboard.data.headline.members} />
                  <MetricCard label="Channels" value={dashboard.data.totals.channels} icon={Hash} accent="violet" />
                  <MetricCard label="Messages" value={dashboard.data.totals.messages} icon={MessageSquare} accent="green" trend={dashboard.data.headline.messages} />
                  <MetricCard label="Tasks" value={dashboard.data.totals.tasks} icon={CheckSquare} accent="amber" trend={dashboard.data.headline.tasks} />
                  <MetricCard label="Documents" value={dashboard.data.totals.docs} icon={FileText} accent="cyan" />
                  <MetricCard label="Projects" value={dashboard.data.totals.projects} icon={FolderKanban} accent="indigo" />
                  <MetricCard
                    label="AI Sessions"
                    value={dashboard.data.headline.aiSessions.current}
                    icon={Bot}
                    accent="pink"
                    trend={dashboard.data.headline.aiSessions}
                    hint={rangeLabel}
                  />
                  <MetricCard
                    label="Storage Used"
                    value={formatBytes(dashboard.data.totals.storageBytes)}
                    icon={HardDrive}
                    accent="orange"
                    hint={`${formatNumber(dashboard.data.totals.uploads)} files`}
                  />
                </div>

                <div className="gap-6 lg:grid-cols-3 grid grid-cols-1">
                  <Panel
                    title="Tracked workspace activity"
                    subtitle={`${formatNumber(dashboard.data.headline.events.current)} interaction events · ${rangeSpan}`}
                    className="lg:col-span-2"
                  >
                    <QueryState
                      isLoading={false}
                      error={null}
                      isEmpty={dashboard.data.headline.events.current === 0}
                      emptyAction={changeRangeAction}
                    >
                      <TimeSeriesChart points={dashboard.data.activitySeries} valueLabel="events" />
                    </QueryState>
                  </Panel>

                  <Panel title="Feature usage breakdown" subtitle="Activity by product surface">
                    <Breakdown
                      slices={dashboard.data.eventBreakdown}
                      emptyMessage="No activity recorded in this period."
                    />
                  </Panel>
                </div>

                {onNavigateToTab ? (
                  <Card className="border-border bg-surface-inset/40">
                    <CardContent className="p-4 gap-4 flex flex-col items-start justify-between sm:flex-row sm:items-center">
                      <div className="gap-3 flex items-center">
                        <div className="size-10 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <TrendingUp className="size-5" aria-hidden />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">
                            Need deeper analytics or custom data exports?
                          </h4>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Upgrade for longer telemetry retention, agent performance monitoring and audit logs.
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onNavigateToTab('billing')} className="shrink-0">
                        View Plans & Quotas
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </QueryState>
        </TabsContent>

        {/* People */}
        <TabsContent value="people" className="pt-4">
          <QueryState isLoading={people.isLoading} error={people.error} onRetry={() => void people.refetch()}>
            {people.data ? (
              <div className="space-y-6">
                <div className="gap-3.5 md:grid-cols-5 grid grid-cols-2">
                  <MetricCard label="Daily active" value={people.data.dau} icon={Flame} accent="orange" hint="last 24 hours" />
                  <MetricCard label="Weekly active" value={people.data.wau} icon={CalendarDays} accent="blue" hint="last 7 days" />
                  <MetricCard label="Active in range" value={people.data.mau} icon={Users} accent="violet" hint={rangeLabel} />
                  <MetricCard label="Stickiness" value={`${people.data.stickiness}%`} icon={Activity} accent="green" hint="DAU ÷ MAU" />
                  <MetricCard label="Tracked events" value={people.data.totalEvents} icon={Activity} accent="cyan" />
                </div>

                <div className="gap-6 lg:grid-cols-3 grid grid-cols-1">
                  <Panel title="Activity" subtitle={`Events per day · ${rangeSpan}`} className="lg:col-span-2">
                    <QueryState isLoading={false} error={null} isEmpty={people.data.totalEvents === 0} emptyAction={changeRangeAction}>
                      <TimeSeriesChart points={people.data.activitySeries} accent="violet" valueLabel="events" />
                    </QueryState>
                  </Panel>
                  <Panel title="Event types" subtitle="What people are doing">
                    <Breakdown slices={people.data.eventBreakdown} emptyMessage="No events recorded in this range." />
                  </Panel>
                </div>

                <Panel title="Member engagement" subtitle="Ranked by combined events, messages and tasks">
                  <DataTable
                    columns={['Member', 'Role', 'Events', 'Messages', 'Tasks', 'Last active']}
                    rows={people.data.topUsers.map((user) => [
                      <div key="member">
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.email}</p>
                      </div>,
                      <Badge key="role" variant="neutral" className="text-[10px]">
                        {user.role}
                      </Badge>,
                      formatNumber(user.events),
                      formatNumber(user.messages),
                      formatNumber(user.tasks),
                      <span key="seen" className={user.lastActiveAt ? 'text-foreground' : 'text-muted-foreground'}>
                        {formatRelative(user.lastActiveAt)}
                      </span>,
                    ])}
                    emptyMessage="No members in this workspace yet."
                  />
                </Panel>
              </div>
            ) : null}
          </QueryState>
        </TabsContent>

        {/* AI & Compute */}
        <TabsContent value="ai-usage" className="pt-4">
          <QueryState isLoading={aiUsage.isLoading} error={aiUsage.error} onRetry={() => void aiUsage.refetch()}>
            {aiUsage.data ? (
              <div className="space-y-6">
                <div className="gap-3.5 sm:grid-cols-3 xl:grid-cols-6 grid grid-cols-2">
                  <MetricCard label="Chat sessions" value={aiUsage.data.totalSessions} icon={MessageSquare} accent="blue" hint="all time" />
                  <MetricCard label="Agents" value={aiUsage.data.totalAgents} icon={Bot} accent="violet" hint={`${aiUsage.data.activeAgents} active`} />
                  <MetricCard label="Workflows" value={aiUsage.data.totalWorkflows} icon={Sparkles} accent="amber" hint={`${aiUsage.data.activeWorkflows} active`} />
                  <MetricCard label="Agent runs" value={aiUsage.data.agentExecutions} icon={Zap} accent="green" hint={rangeLabel} />
                  <MetricCard
                    label="Workflow runs"
                    value={aiUsage.data.workflowExecutions}
                    icon={Sparkles}
                    accent="cyan"
                    hint={`avg ${formatNumber(aiUsage.data.avgWorkflowDurationMs)}ms`}
                  />
                  <MetricCard label="Estimated tokens" value={aiUsage.data.estimatedTokens} icon={Coins} accent="pink" hint="logged + transcript estimate" />
                </div>

                <div className="gap-6 lg:grid-cols-3 grid grid-cols-1">
                  <Panel title="AI activity" subtitle={`Sessions, agent runs and workflow executions · ${rangeSpan}`} className="lg:col-span-2">
                    <QueryState
                      isLoading={false}
                      error={null}
                      isEmpty={aiUsage.data.usageSeries.every((p) => p.value === 0)}
                      emptyAction={changeRangeAction}
                    >
                      <TimeSeriesChart points={aiUsage.data.usageSeries} accent="pink" valueLabel="AI operations" />
                    </QueryState>
                  </Panel>
                  <Panel title="Feature mix" subtitle={rangeLabel}>
                    <Breakdown slices={aiUsage.data.featureBreakdown} emptyMessage="No AI activity in this range." />
                  </Panel>
                </div>
              </div>
            ) : null}
          </QueryState>
        </TabsContent>

        {/* Storage */}
        <TabsContent value="storage" className="pt-4">
          <QueryState isLoading={storage.isLoading} error={storage.error} onRetry={() => void storage.refetch()}>
            {storage.data ? (
              <div className="space-y-6">
                <Panel>
                  <div className="gap-3 mb-4 flex flex-wrap items-end justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Total storage capacity & usage</h3>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        {formatNumber(storage.data.totalFiles)} files across the workspace
                      </p>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {formatBytes(storage.data.totalBytes)}
                      <span className="text-xs font-normal text-muted-foreground"> / {formatBytes(storage.data.quotaBytes)}</span>
                    </span>
                  </div>
                  <ProgressBar
                    pct={storage.data.usedPct}
                    accent={storage.data.usedPct >= 80 ? 'amber' : 'green'}
                    label={`${storage.data.usedPct}% of workspace storage used`}
                  />
                  <p className="text-xs mt-2 text-muted-foreground">
                    {storage.data.usedPct}% of workspace quota consumed —{' '}
                    {formatBytes(Math.max(0, storage.data.quotaBytes - storage.data.totalBytes))} available
                  </p>
                </Panel>

                <div className="gap-3.5 sm:grid-cols-4 grid grid-cols-2">
                  <MetricCard label="Files stored" value={storage.data.totalFiles} icon={Files} accent="blue" />
                  <MetricCard label="Total size" value={formatBytes(storage.data.totalBytes)} icon={HardDrive} accent="green" />
                  <MetricCard
                    label="Uploaded in range"
                    value={storage.data.growthSeries.reduce((sum, point) => sum + point.value, 0)}
                    icon={TrendingUp}
                    accent="amber"
                    hint={rangeLabel}
                  />
                  <MetricCard label="Contributors" value={storage.data.topUploaders.length} icon={Users} accent="violet" />
                </div>

                <div className="gap-6 lg:grid-cols-3 grid grid-cols-1">
                  <Panel title="Upload volume" subtitle={`Files added per day · ${rangeSpan}`} className="lg:col-span-2">
                    <QueryState
                      isLoading={false}
                      error={null}
                      isEmpty={storage.data.growthSeries.every((p) => p.value === 0)}
                      emptyAction={changeRangeAction}
                    >
                      <TimeSeriesChart points={storage.data.growthSeries} accent="green" valueLabel="files" />
                    </QueryState>
                  </Panel>
                  <Panel title="By file type" subtitle="Share of bytes stored">
                    <Breakdown slices={storage.data.byType} formatValue={formatBytes} emptyMessage="No files uploaded yet." />
                  </Panel>
                </div>
              </div>
            ) : null}
          </QueryState>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="pt-4">
          <QueryState
            isLoading={reports.isLoading}
            error={reports.error}
            onRetry={() => void reports.refetch()}
            isEmpty={reports.data?.length === 0}
            emptyMessage="No reports are available for this workspace."
          >
            {reports.data ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Download analytics reports for {workspaceName} as CSV. Reports cover{' '}
                  <span className="font-medium text-foreground">{rangeSpan}</span>.
                </p>

                <div className="gap-4 md:grid-cols-2 grid grid-cols-1">
                  {reports.data.map((report) => {
                    const busy = download.isPending && download.variables?.type === report.type;
                    return (
                      <Card
                        key={report.type}
                        className="p-5 gap-4 flex flex-col justify-between border-border bg-surface transition-colors hover:border-primary/40"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold gap-2 flex items-center text-foreground">
                              <FileText className="size-4 text-primary" aria-hidden />
                              {report.name}
                            </span>
                            <Badge variant="neutral" className="text-[10px] uppercase">
                              CSV
                            </Badge>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{report.description}</p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="self-start"
                          loading={busy}
                          leadingIcon={busy ? undefined : <Download />}
                          onClick={() =>
                            download.mutate(
                              {
                                type: report.type as ReportType,
                                range: query,
                                filenamePrefix: workspaceName.toLowerCase().replace(/\s+/g, '-'),
                              },
                              {
                                onError: (err) =>
                                  toast.error(err instanceof Error ? err.message : 'Could not export the report.'),
                              },
                            )
                          }
                        >
                          {busy ? 'Exporting…' : 'Download CSV'}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}
