import { useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  LoadingState,
  Page,
  PageHeader,
} from '@org/ui';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Clock,
  Coins,
  Cpu,
  Download,
  FileSpreadsheet,
  GitBranch,
  GitCompare,
  History,
  Layers,
  Plug,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react';
import { cn } from '@org/utils';
import { analyticsService } from '../services/analyticsService.js';
import { useStudioSession } from '../session-guard.js';

// Sub-views
import { OverviewView } from './analytics/overview-view.js';
import { AgentsView } from './analytics/agents-view.js';
import { WorkflowsView } from './analytics/workflows-view.js';
import { ExecutionExplorerView } from './analytics/execution-explorer-view.js';
import { TracesTimelineView } from './analytics/traces-timeline-view.js';
import { NodesView } from './analytics/nodes-view.js';
import { ToolsConnectorsView } from './analytics/tools-connectors-view.js';
import { ModelsTokensView } from './analytics/models-tokens-view.js';
import { CostUsageView } from './analytics/cost-usage-view.js';
import { ErrorsReliabilityView } from './analytics/errors-reliability-view.js';
import { EvaluationsQualityView } from './analytics/evaluations-quality-view.js';
import { VersionComparisonView } from './analytics/version-comparison-view.js';
import { AlertsAnomaliesView } from './analytics/alerts-anomalies-view.js';
import { ReportsExportsView } from './analytics/reports-exports-view.js';
import { AnalyticsSettingsView } from './analytics/analytics-settings-view.js';

export type AnalyticsTabId =
  | 'overview'
  | 'agents'
  | 'workflows'
  | 'executions'
  | 'traces'
  | 'nodes'
  | 'tools'
  | 'models'
  | 'cost'
  | 'errors'
  | 'evaluations'
  | 'versions'
  | 'alerts'
  | 'reports'
  | 'settings';

interface TabItem {
  id: AnalyticsTabId;
  label: string;
  icon: any;
}

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'agents', label: 'Agent Analytics', icon: Bot },
  { id: 'workflows', label: 'Workflow Analytics', icon: GitBranch },
  { id: 'executions', label: 'Execution Explorer', icon: History },
  { id: 'traces', label: 'Traces & Timeline', icon: Sparkles },
  { id: 'nodes', label: 'Node Analytics', icon: Layers },
  { id: 'tools', label: 'Tool & Connectors', icon: Plug },
  { id: 'models', label: 'Model & Tokens', icon: Cpu },
  { id: 'cost', label: 'Cost & Usage', icon: Coins },
  { id: 'errors', label: 'Errors & Reliability', icon: AlertTriangle },
  { id: 'evaluations', label: 'Evaluations & Quality', icon: Star },
  { id: 'versions', label: 'Version Comparison', icon: GitCompare },
  { id: 'alerts', label: 'Alerts & Anomalies', icon: Bell },
  { id: 'reports', label: 'Reports & Exports', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AnalyticsPage() {
  const { activeWorkspace } = useStudioSession();
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview');
  const [dateRange, setDateRange] = useState('7D');
  const [selectedTraceId, setSelectedTraceId] = useState<string>('');

  // 1. Overview Query
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
    isRefetching: isRefetchingOverview,
  } = useQuery({
    queryKey: ['deep-ai-overview', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getDeepOverview(activeWorkspace.id, dateRange),
    enabled: Boolean(activeWorkspace?.id),
  });

  // 2. Agents Query
  const {
    data: agentsData = [],
    isLoading: isLoadingAgents,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ['deep-ai-agents', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getAgentAnalytics(activeWorkspace.id, dateRange),
    enabled: Boolean(activeWorkspace?.id),
  });

  // 3. Workflows Query
  const {
    data: workflowsData = [],
    isLoading: isLoadingWorkflows,
    refetch: refetchWorkflows,
  } = useQuery({
    queryKey: ['deep-ai-workflows', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getWorkflowAnalytics(activeWorkspace.id, dateRange),
    enabled: Boolean(activeWorkspace?.id),
  });

  // 4. Executions Query
  const {
    data: executionsData = [],
    isLoading: isLoadingExecutions,
    refetch: refetchExecutions,
  } = useQuery({
    queryKey: ['workspace-ai-executions', activeWorkspace.id],
    queryFn: async () => {
      const list = await analyticsService.getExecutions(activeWorkspace.id);
      return list || [];
    },
    enabled: Boolean(activeWorkspace?.id),
  });

  // 5. Nodes Query
  const {
    data: nodesData = [],
    isLoading: isLoadingNodes,
    refetch: refetchNodes,
  } = useQuery({
    queryKey: ['deep-ai-nodes', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getNodeAnalytics(activeWorkspace.id, dateRange),
    enabled: activeTab === 'nodes' && Boolean(activeWorkspace?.id),
  });

  // 6. Tools & Connectors Query
  const {
    data: toolsConnectorsData = { tools: [], connectors: [] },
    isLoading: isLoadingTools,
    refetch: refetchTools,
  } = useQuery({
    queryKey: ['deep-ai-tools', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getToolAndConnectorAnalytics(activeWorkspace.id, dateRange),
    enabled: activeTab === 'tools' && Boolean(activeWorkspace?.id),
  });

  // 7. Models Query
  const {
    data: modelsData = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ['deep-ai-models', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getModelAnalytics(activeWorkspace.id, dateRange),
    enabled: activeTab === 'models' && Boolean(activeWorkspace?.id),
  });

  // 8. Cost Query
  const {
    data: costData,
    isLoading: isLoadingCost,
    refetch: refetchCost,
  } = useQuery({
    queryKey: ['deep-ai-cost', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getCostAnalytics(activeWorkspace.id, dateRange),
    enabled: activeTab === 'cost' && Boolean(activeWorkspace?.id),
  });

  // 9. Errors Query
  const {
    data: errorsData = [],
    isLoading: isLoadingErrors,
    refetch: refetchErrors,
  } = useQuery({
    queryKey: ['deep-ai-errors', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getErrorAnalytics(activeWorkspace.id, dateRange),
    enabled: activeTab === 'errors' && Boolean(activeWorkspace?.id),
  });

  // 10. Evaluations Query
  const {
    data: evaluationsData,
    isLoading: isLoadingEvaluations,
    refetch: refetchEvaluations,
  } = useQuery({
    queryKey: ['deep-ai-evaluations', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getEvaluations(activeWorkspace.id, dateRange),
    enabled: activeTab === 'evaluations' && Boolean(activeWorkspace?.id),
  });

  // 11. Alerts Query
  const {
    data: alertsData = { rules: [] },
    isLoading: isLoadingAlerts,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['deep-ai-alerts', activeWorkspace.id],
    queryFn: () => analyticsService.getAlerts(activeWorkspace.id),
    enabled: activeTab === 'alerts' && Boolean(activeWorkspace?.id),
  });

  // 12. Settings Query
  const {
    data: settingsData,
    isLoading: isLoadingSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['deep-ai-settings', activeWorkspace.id],
    queryFn: () => analyticsService.getSettings(activeWorkspace.id),
    enabled: activeTab === 'settings' && Boolean(activeWorkspace?.id),
  });

  const handleRefreshAll = () => {
    void refetchOverview();
    void refetchAgents();
    void refetchWorkflows();
    void refetchExecutions();
    if (activeTab === 'nodes') void refetchNodes();
    if (activeTab === 'tools') void refetchTools();
    if (activeTab === 'models') void refetchModels();
    if (activeTab === 'cost') void refetchCost();
    if (activeTab === 'errors') void refetchErrors();
    if (activeTab === 'evaluations') void refetchEvaluations();
    if (activeTab === 'alerts') void refetchAlerts();
    if (activeTab === 'settings') void refetchSettings();
  };

  const handleViewTrace = (executionId: string) => {
    setSelectedTraceId(executionId);
    setActiveTab('traces');
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Analytics & Observability Center"
        description={`Production telemetry, distributed tracing, cost forecasting, and latency analytics for ${activeWorkspace.name}.`}
        icon={<BarChart3 className="size-5" />}
        accent="violet"
        actions={
          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1 border-b sm:border-b-0 pb-1 sm:pb-0">
              {['24H', '7D', '30D', '90D'].map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className="text-xs h-7 px-2.5"
                >
                  {range}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              loading={isRefetchingOverview}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-2 text-xs scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised',
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Content Rendering */}
      <div>
        {activeTab === 'overview' && (
          isLoadingOverview || !overviewData ? (
            <LoadingState label="Computing live workspace telemetry and KPIs..." />
          ) : (
            <OverviewView
              data={overviewData}
              onNavigateToTab={(tabId) => setActiveTab(tabId as AnalyticsTabId)}
            />
          )
        )}

        {activeTab === 'agents' && (
          isLoadingAgents ? (
            <LoadingState label="Loading deep agent analytics profiles..." />
          ) : (
            <AgentsView
              agents={agentsData}
              onOpenExecution={handleViewTrace}
            />
          )
        )}

        {activeTab === 'workflows' && (
          isLoadingWorkflows ? (
            <LoadingState label="Analyzing workflow telemetry & failure hotspots..." />
          ) : (
            <WorkflowsView workflows={workflowsData} />
          )
        )}

        {activeTab === 'executions' && (
          <ExecutionExplorerView
            executions={executionsData}
            isLoading={isLoadingExecutions}
            onRefresh={() => void refetchExecutions()}
            onViewTrace={handleViewTrace}
          />
        )}

        {activeTab === 'traces' && (
          <TracesTimelineView
            initialExecutionId={selectedTraceId}
            executions={executionsData}
          />
        )}

        {activeTab === 'nodes' && (
          isLoadingNodes ? (
            <LoadingState label="Aggregating node execution performance..." />
          ) : (
            <NodesView nodes={nodesData} />
          )
        )}

        {activeTab === 'tools' && (
          isLoadingTools ? (
            <LoadingState label="Fetching connector and tool reliability metrics..." />
          ) : (
            <ToolsConnectorsView data={toolsConnectorsData} />
          )
        )}

        {activeTab === 'models' && (
          isLoadingModels ? (
            <LoadingState label="Analyzing foundation model throughput and tokens..." />
          ) : (
            <ModelsTokensView models={modelsData} />
          )
        )}

        {activeTab === 'cost' && (
          isLoadingCost || !costData ? (
            <LoadingState label="Calculating cost telemetry and projections..." />
          ) : (
            <CostUsageView costData={costData} />
          )
        )}

        {activeTab === 'errors' && (
          isLoadingErrors ? (
            <LoadingState label="Scanning fingerprinted error signatures..." />
          ) : (
            <ErrorsReliabilityView errors={errorsData} />
          )
        )}

        {activeTab === 'evaluations' && (
          isLoadingEvaluations || !evaluationsData ? (
            <LoadingState label="Loading evaluation ratings and quality feedback..." />
          ) : (
            <EvaluationsQualityView evaluations={evaluationsData} />
          )
        )}

        {activeTab === 'versions' && (
          <VersionComparisonView agents={agentsData} />
        )}

        {activeTab === 'alerts' && (
          isLoadingAlerts ? (
            <LoadingState label="Checking active anomaly rules..." />
          ) : (
            <AlertsAnomaliesView
              alerts={alertsData.rules || []}
              onRefresh={() => void refetchAlerts()}
            />
          )
        )}

        {activeTab === 'reports' && (
          <ReportsExportsView dateRange={dateRange} />
        )}

        {activeTab === 'settings' && (
          isLoadingSettings || !settingsData ? (
            <LoadingState label="Loading telemetry configuration..." />
          ) : (
            <AnalyticsSettingsView
              settings={settingsData}
              onRefresh={() => void refetchSettings()}
            />
          )
        )}
      </div>
    </Page>
  );
}
export default AnalyticsPage;
