import {
  BarChart,
  Breakdown,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RangePicker,
  RefreshButton,
  formatBytes,
  formatNumber,
} from '@org/analytics-ui';
import { analyticsApi, queryKeys } from '@org/api-client';
import type { ReportType } from '@org/types';
import { Badge, Button, Card, CardContent } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  CheckSquare,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Files,
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

export function WorkspaceCompanyAnalytics({
  workspaceId,
  workspaceName = 'Workspace',
  onNavigateToTab,
}: WorkspaceCompanyAnalyticsProps) {
  const [days, setDays] = useState(30);
  const [subTab, setSubTab] = useState<
    'overview' | 'reports' | 'ai-usage' | 'storage'
  >('overview');

  // Dashboard Overview query
  const dashboardQuery = useQuery({
    queryKey: queryKeys.analytics.dashboard(workspaceId ?? '', days),
    queryFn: () => analyticsApi.dashboard(workspaceId as string, days),
    enabled: !!workspaceId,
  });

  // AI Usage query
  const aiUsageQuery = useQuery({
    queryKey: queryKeys.analytics.aiUsage(workspaceId ?? '', days),
    queryFn: () => analyticsApi.aiUsage(workspaceId as string, days),
    enabled: !!workspaceId && subTab === 'ai-usage',
  });

  // Storage query
  const storageQuery = useQuery({
    queryKey: queryKeys.analytics.storage(workspaceId ?? '', days),
    queryFn: () => analyticsApi.storage(workspaceId as string, days),
    enabled: !!workspaceId && subTab === 'storage',
  });

  // Report definitions query
  const reportDefsQuery = useQuery({
    queryKey: queryKeys.analytics.reports(workspaceId ?? ''),
    queryFn: () => analyticsApi.reportDefinitions(workspaceId as string),
    enabled: !!workspaceId && subTab === 'reports',
  });

  const [downloadingReport, setDownloadingReport] = useState<string | null>(
    null,
  );

  const handleDownloadReport = async (type: ReportType) => {
    if (!workspaceId) return;
    try {
      setDownloadingReport(type);
      const csvData = await analyticsApi.reportCsv(
        workspaceId,
        type,
        days,
      );
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${workspaceName.toLowerCase().replace(/\s+/g, '-')}-${type}-report-${days}d.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Ignore or handled
    } finally {
      setDownloadingReport(null);
    }
  };

  const data = dashboardQuery.data;

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <span>Company Analytics & Usage</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor activity trends, engagement metrics, and resource quotas for{' '}
            {workspaceName}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <RangePicker days={days} onChange={setDays} />
          <RefreshButton
            onClick={() => {
              dashboardQuery.refetch();
              if (subTab === 'ai-usage') aiUsageQuery.refetch();
              if (subTab === 'storage') storageQuery.refetch();
              if (subTab === 'reports') reportDefsQuery.refetch();
            }}
            busy={
              dashboardQuery.isFetching ||
              aiUsageQuery.isFetching ||
              storageQuery.isFetching
            }
          />
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('overview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            subTab === 'overview'
              ? 'bg-accent text-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <BarChart3 className="size-3.5" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('ai-usage')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            subTab === 'ai-usage'
              ? 'bg-accent text-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>AI & Compute</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('storage')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            subTab === 'storage'
              ? 'bg-accent text-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <HardDrive className="size-3.5" />
          <span>Storage & Files</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('reports')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            subTab === 'reports'
              ? 'bg-accent text-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <FileSpreadsheet className="size-3.5" />
          <span>Export Reports</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {subTab === 'overview' && (
        <QueryState
          isLoading={dashboardQuery.isLoading}
          error={dashboardQuery.error}
        >
          {data ? (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <MetricCard
                  label="Team Members"
                  value={data.totals.members}
                  icon={Users}
                  accent="blue"
                  trend={data.headline.members}
                />
                <MetricCard
                  label="Channels"
                  value={data.totals.channels}
                  icon={Hash}
                  accent="violet"
                />
                <MetricCard
                  label="Messages"
                  value={data.totals.messages}
                  icon={MessageSquare}
                  accent="green"
                  trend={data.headline.messages}
                />
                <MetricCard
                  label="Tasks"
                  value={data.totals.tasks}
                  icon={CheckSquare}
                  accent="amber"
                  trend={data.headline.tasks}
                />
                <MetricCard
                  label="Documents"
                  value={data.totals.docs}
                  icon={FileText}
                  accent="cyan"
                />
                <MetricCard
                  label="Projects"
                  value={data.totals.projects}
                  icon={FolderKanban}
                  accent="indigo"
                />
                <MetricCard
                  label="AI Sessions"
                  value={data.headline.aiSessions.current}
                  icon={Bot}
                  accent="pink"
                  trend={data.headline.aiSessions}
                  hint={`in the last ${days}d`}
                />
                <MetricCard
                  label="Storage Used"
                  value={formatBytes(data.totals.storageBytes)}
                  icon={HardDrive}
                  accent="orange"
                  hint={`${formatNumber(data.totals.uploads)} files`}
                />
              </div>

              {/* Activity Trend Chart & Event Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel
                  title={`Tracked Workspace Activity · Last ${days} Days`}
                  subtitle={`${formatNumber(
                    data.headline.events.current,
                  )} interaction events recorded`}
                  className="lg:col-span-2"
                >
                  <BarChart series={data.activitySeries} />
                </Panel>

                <Panel
                  title="Feature Usage Breakdown"
                  subtitle="Activity by product surface"
                >
                  <Breakdown
                    slices={data.eventBreakdown}
                    emptyMessage="No activity recorded in this period. Data appears as teammates collaborate."
                  />
                </Panel>
              </div>

              {/* Quick Quota & Plan Summary Card */}
              <Card className="border-border bg-surface-inset/40">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Need deeper analytics or custom data exports?
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upgrade to Pro for unlimited telemetry retention,
                        advanced agent performance monitoring, and audit logs.
                      </p>
                    </div>
                  </div>
                  {onNavigateToTab ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateToTab('billing')}
                      className="text-xs shrink-0"
                    >
                      View Plans & Quotas
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </QueryState>
      )}

      {/* Tab 2: AI & Compute */}
      {subTab === 'ai-usage' && (
        <QueryState
          isLoading={aiUsageQuery.isLoading}
          error={aiUsageQuery.error}
        >
          {aiUsageQuery.data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
                <MetricCard
                  label="Chat sessions"
                  value={aiUsageQuery.data.totalSessions}
                  icon={MessageSquare}
                  accent="blue"
                  hint="all time"
                />
                <MetricCard
                  label="Agents"
                  value={aiUsageQuery.data.totalAgents}
                  icon={Bot}
                  accent="violet"
                  hint={`${aiUsageQuery.data.activeAgents} active`}
                />
                <MetricCard
                  label="Workflows"
                  value={aiUsageQuery.data.totalWorkflows}
                  icon={Sparkles}
                  accent="amber"
                  hint={`${aiUsageQuery.data.activeWorkflows} active`}
                />
                <MetricCard
                  label="Agent runs"
                  value={aiUsageQuery.data.agentExecutions}
                  icon={Zap}
                  accent="green"
                  hint={`in the last ${days}d`}
                />
                <MetricCard
                  label="Workflow runs"
                  value={aiUsageQuery.data.workflowExecutions}
                  icon={Sparkles}
                  accent="cyan"
                  hint={`avg ${formatNumber(aiUsageQuery.data.avgWorkflowDurationMs)}ms`}
                />
                <MetricCard
                  label="Estimated tokens"
                  value={aiUsageQuery.data.estimatedTokens}
                  icon={Coins}
                  accent="pink"
                  hint="logged + transcript estimate"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel
                  title={`AI Activity · Last ${days} Days`}
                  subtitle="Chat sessions, agent runs and workflow executions"
                  className="lg:col-span-2"
                >
                  <BarChart
                    series={aiUsageQuery.data.usageSeries}
                    accent="pink"
                    valueLabel="AI operations"
                  />
                </Panel>

                <Panel title="Feature Mix" subtitle={`Last ${days} days`}>
                  <Breakdown
                    slices={aiUsageQuery.data.featureBreakdown}
                    emptyMessage="No AI activity in this range."
                  />
                </Panel>
              </div>
            </div>
          ) : null}
        </QueryState>
      )}

      {/* Tab 3: Storage */}
      {subTab === 'storage' && (
        <QueryState
          isLoading={storageQuery.isLoading}
          error={storageQuery.error}
        >
          {storageQuery.data ? (
            <div className="space-y-6">
              <Panel className="mb-2">
                <div className="gap-3 mb-4 flex flex-wrap items-end justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      Total Storage Capacity & Usage
                    </h3>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      {formatNumber(storageQuery.data.totalFiles)} files across the workspace
                    </p>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {formatBytes(storageQuery.data.totalBytes)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {' '}
                      / {formatBytes(storageQuery.data.quotaBytes)}
                    </span>
                  </span>
                </div>
                <ProgressBar
                  pct={storageQuery.data.usedPct}
                  accent={storageQuery.data.usedPct >= 80 ? 'amber' : 'green'}
                />
                <p className="text-xs mt-2 text-muted-foreground">
                  {storageQuery.data.usedPct}% of workspace quota consumed —{' '}
                  {formatBytes(
                    Math.max(
                      0,
                      storageQuery.data.quotaBytes - storageQuery.data.totalBytes,
                    ),
                  )}{' '}
                  available
                </p>
              </Panel>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <MetricCard
                  label="Files stored"
                  value={storageQuery.data.totalFiles}
                  icon={Files}
                  accent="blue"
                />
                <MetricCard
                  label="Total size"
                  value={formatBytes(storageQuery.data.totalBytes)}
                  icon={HardDrive}
                  accent="green"
                />
                <MetricCard
                  label={`Uploaded · ${days}d`}
                  value={storageQuery.data.growthSeries.reduce(
                    (sum, point) => sum + point.value,
                    0,
                  )}
                  icon={TrendingUp}
                  accent="amber"
                />
                <MetricCard
                  label="Contributors"
                  value={storageQuery.data.topUploaders.length}
                  icon={Users}
                  accent="violet"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel
                  title={`Upload Volume · Last ${days} Days`}
                  subtitle="Files added per day"
                  className="lg:col-span-2"
                >
                  <BarChart
                    series={storageQuery.data.growthSeries}
                    accent="green"
                    valueLabel="files"
                  />
                </Panel>

                <Panel title="By File Type" subtitle="Share of bytes stored">
                  <Breakdown
                    slices={storageQuery.data.byType}
                    formatValue={formatBytes}
                    emptyMessage="No files uploaded yet."
                  />
                </Panel>
              </div>
            </div>
          ) : null}
        </QueryState>
      )}

      {/* Tab 4: Export Reports */}
      {subTab === 'reports' && (
        <QueryState
          isLoading={reportDefsQuery.isLoading}
          error={reportDefsQuery.error}
        >
          {reportDefsQuery.data ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Generate and download comprehensive analytics reports for{' '}
                {workspaceName} in CSV format for executive reporting or audit
                records.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportDefsQuery.data.map((report) => (
                  <Card
                    key={report.type}
                    className="p-5 flex flex-col justify-between gap-4 border-border bg-surface hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          {report.name}
                        </span>
                        <Badge variant="neutral" className="text-[10px] uppercase">
                          CSV
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {report.description}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReport(report.type)}
                      disabled={downloadingReport === report.type}
                      className="text-xs font-medium self-start"
                    >
                      {downloadingReport === report.type ? (
                        <span className="flex items-center gap-1.5">
                          <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Exporting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Download className="size-3.5" />
                          Download {days}d Report
                        </span>
                      )}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </QueryState>
      )}
    </div>
  );
}
