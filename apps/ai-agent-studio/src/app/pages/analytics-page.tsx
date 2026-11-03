import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FilterChips,
  Button,
  ErrorState,
  LoadingState,
} from '@org/ui';
import {
  BarChart3,
  Coins,
  Download,
  History,
  RefreshCw,
  Settings,
  Star,
} from 'lucide-react';
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
import { StudioPage } from '../components/studio-page.js';

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

/** The header tabs: each groups related views, picked with chips below it. */
const GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  icon: typeof BarChart3;
  views: ReadonlyArray<{ id: AnalyticsTabId; label: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: BarChart3, views: [{ id: 'overview', label: 'Overview' }] },
  {
    id: 'activity',
    label: 'Activity',
    icon: History,
    views: [
      { id: 'agents', label: 'Agents' },
      { id: 'workflows', label: 'Workflows' },
      { id: 'executions', label: 'Executions' },
      { id: 'traces', label: 'Traces' },
      { id: 'nodes', label: 'Nodes' },
    ],
  },
  {
    id: 'usage',
    label: 'Usage & cost',
    icon: Coins,
    views: [
      { id: 'cost', label: 'Cost' },
      { id: 'models', label: 'Models & tokens' },
      { id: 'tools', label: 'Tools & connectors' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: Star,
    views: [
      { id: 'errors', label: 'Errors' },
      { id: 'evaluations', label: 'Evaluations' },
      { id: 'versions', label: 'Versions' },
      { id: 'alerts', label: 'Alerts' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: Download, views: [{ id: 'reports', label: 'Reports' }] },
  { id: 'settings', label: 'Settings', icon: Settings, views: [{ id: 'settings', label: 'Settings' }] },
];

const groupOf = (tab: AnalyticsTabId) => GROUPS.find((g) => g.views.some((v) => v.id === tab)) ?? GROUPS[0];

export function AnalyticsPage() {
  const { activeWorkspace } = useStudioSession();
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview');
  const activeGroup = groupOf(activeTab);
  const [dateRange, setDateRange] = useState('7D');
  const [selectedTraceId, setSelectedTraceId] = useState<string>('');

  // 1. Overview Query
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    isError: isErrorOverview,
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
    isError: isErrorAgents,
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
    isError: isErrorWorkflows,
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
    isError: isErrorExecutions,
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
    isError: isErrorNodes,
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
    isError: isErrorTools,
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
    isError: isErrorModels,
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
    isError: isErrorCost,
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
    isError: isErrorErrors,
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
    isError: isErrorEvaluations,
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
    isError: isErrorAlerts,
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
    isError: isErrorSettings,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['deep-ai-settings', activeWorkspace.id],
    queryFn: () => analyticsService.getSettings(activeWorkspace.id),
    enabled: activeTab === 'settings' && Boolean(activeWorkspace?.id),
  });

  // A failed query must say so: without this the spinner (or an empty chart) stays up forever.
  const tabQueries: Partial<Record<AnalyticsTabId, { failed: boolean; retry: () => void }>> = {
    overview: { failed: isErrorOverview, retry: () => void refetchOverview() },
    agents: { failed: isErrorAgents, retry: () => void refetchAgents() },
    workflows: { failed: isErrorWorkflows, retry: () => void refetchWorkflows() },
    executions: { failed: isErrorExecutions, retry: () => void refetchExecutions() },
    nodes: { failed: isErrorNodes, retry: () => void refetchNodes() },
    tools: { failed: isErrorTools, retry: () => void refetchTools() },
    models: { failed: isErrorModels, retry: () => void refetchModels() },
    cost: { failed: isErrorCost, retry: () => void refetchCost() },
    errors: { failed: isErrorErrors, retry: () => void refetchErrors() },
    evaluations: { failed: isErrorEvaluations, retry: () => void refetchEvaluations() },
    alerts: { failed: isErrorAlerts, retry: () => void refetchAlerts() },
    settings: { failed: isErrorSettings, retry: () => void refetchSettings() },
  };
  const activeQuery = tabQueries[activeTab];

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
    <StudioPage
        icon={<BarChart3 />}
        title="Studio Analytics"
        description={`Runs, cost, tokens and latency for the agents in ${activeWorkspace.name}.`}
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
        tabs={{
          value: activeGroup.id,
          onValueChange: (id) => setActiveTab(GROUPS.find((g) => g.id === id)?.views[0].id ?? 'overview'),
          items: GROUPS.map(({ id, label, icon: Icon }) => ({ value: id, label, icon: <Icon className="size-4" /> })),
        }}
      >
      {activeGroup.views.length > 1 ? (
        <FilterChips
          aria-label={`${activeGroup.label} views`}
          value={activeTab}
          onChange={setActiveTab}
          options={activeGroup.views.map((v) => ({ value: v.id, label: v.label }))}
        />
      ) : null}


      {/* View Content Rendering */}
      <div>
        {activeQuery?.failed && (
          <ErrorState
            title="Couldn’t load analytics"
            description="The platform didn’t answer. Try again in a moment."
            onRetry={activeQuery.retry}
          />
        )}
        {!activeQuery?.failed && (<>
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
        </>)}
      </div>
    </StudioPage>
  );
}
export default AnalyticsPage;
