import { aiAnalyticsApi, aiExecutionsApi, analyticsApi } from '@org/api-client';
import { toDateRangeQuery, type DateRangePreset } from '@org/utils';
import type {
  AICostAnalytics,
  AnalyticsDateRange,
  DeepAIAnalyticsOverview,
  AgentAnalyticsProfile,
  WorkflowAnalyticsProfile,
  NodeAnalyticsRecord,
  ConnectorAnalyticsRecord,
  ModelAnalyticsRecord,
  ErrorAnalyticsGroup,
  AIExecutionTrace,
  EvaluationsAnalyticsOverview,
  VersionComparisonResult,
  AnalyticsAlertRule,
  AnalyticsSettingsConfig,
  AIExecution,
  ReportType,
} from '@org/types';

export function parseDateRangeToDays(dateRange: string): number {
  switch (dateRange) {
    case '24H':
      return 1;
    case '7D':
      return 7;
    case '30D':
      return 30;
    case '90D':
      return 90;
    default:
      return 7;
  }
}

const RANGE_PRESETS: Record<string, DateRangePreset> = {
  '24H': 'today',
  '7D': 'last_7_days',
  '30D': 'last_30_days',
  '90D': 'last_90_days',
};

/** Studio range chip (`7D`…) → the `?from=&to=` window the analytics API reads. */
export function toAnalyticsRange(dateRange: string): AnalyticsDateRange {
  return toDateRangeQuery({ preset: RANGE_PRESETS[dateRange] ?? 'last_7_days' });
}

export const analyticsService = {
  async getDeepOverview(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<DeepAIAnalyticsOverview> {
    return aiAnalyticsApi.deepOverview(workspaceId, toAnalyticsRange(dateRange));
  },

  async getAgentAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<AgentAnalyticsProfile[]> {
    return aiAnalyticsApi.agents(workspaceId, toAnalyticsRange(dateRange));
  },

  async getAgentDetail(
    workspaceId: string,
    agentId: string,
    dateRange = '7D',
  ): Promise<AgentAnalyticsProfile> {
    return aiAnalyticsApi.agent(workspaceId, agentId, toAnalyticsRange(dateRange));
  },

  async getWorkflowAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<WorkflowAnalyticsProfile[]> {
    return aiAnalyticsApi.workflows(workspaceId, toAnalyticsRange(dateRange));
  },

  async getWorkflowDetail(
    workspaceId: string,
    workflowId: string,
    dateRange = '7D',
  ): Promise<WorkflowAnalyticsProfile> {
    return aiAnalyticsApi.workflow(workspaceId, workflowId, toAnalyticsRange(dateRange));
  },

  async getNodeAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<NodeAnalyticsRecord[]> {
    return aiAnalyticsApi.nodes(workspaceId, toAnalyticsRange(dateRange));
  },

  async getToolAndConnectorAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<{ tools: any[]; connectors: ConnectorAnalyticsRecord[] }> {
    return aiAnalyticsApi.toolsAndConnectors(workspaceId, toAnalyticsRange(dateRange));
  },

  async getModelAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<ModelAnalyticsRecord[]> {
    return aiAnalyticsApi.models(workspaceId, toAnalyticsRange(dateRange));
  },

  async getCostAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<AICostAnalytics> {
    return aiAnalyticsApi.costs(workspaceId, toAnalyticsRange(dateRange));
  },

  async getErrorAnalytics(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<ErrorAnalyticsGroup[]> {
    return aiAnalyticsApi.errors(workspaceId, toAnalyticsRange(dateRange));
  },

  async getExecutionTrace(
    workspaceId: string,
    executionId: string,
  ): Promise<AIExecutionTrace> {
    return aiAnalyticsApi.trace(workspaceId, executionId);
  },

  async getEvaluations(
    workspaceId: string,
    dateRange = '7D',
  ): Promise<EvaluationsAnalyticsOverview> {
    return aiAnalyticsApi.evaluations(workspaceId, toAnalyticsRange(dateRange));
  },

  async compareVersions(
    workspaceId: string,
    params: {
      entityType: 'AGENT' | 'WORKFLOW';
      entityId: string;
      versionA?: number;
      versionB?: number;
    },
  ): Promise<VersionComparisonResult> {
    return aiAnalyticsApi.compareVersions(workspaceId, params);
  },

  async getAlerts(
    workspaceId: string,
  ): Promise<{ rules: AnalyticsAlertRule[] }> {
    return aiAnalyticsApi.alerts(workspaceId);
  },

  async createAlertRule(
    workspaceId: string,
    rule: Partial<AnalyticsAlertRule>,
  ): Promise<AnalyticsAlertRule> {
    return aiAnalyticsApi.createAlertRule(workspaceId, rule);
  },

  async updateAlertStatus(
    workspaceId: string,
    alertId: string,
    status: 'RESOLVED' | 'ACKNOWLEDGED',
  ) {
    return aiAnalyticsApi.updateAlertStatus(workspaceId, alertId, status);
  },

  async getSettings(
    workspaceId: string,
  ): Promise<AnalyticsSettingsConfig> {
    return aiAnalyticsApi.settings(workspaceId);
  },

  async updateSettings(
    workspaceId: string,
    settings: Partial<AnalyticsSettingsConfig>,
  ): Promise<AnalyticsSettingsConfig> {
    return aiAnalyticsApi.updateSettings(workspaceId, settings);
  },

  async getExecutions(
    workspaceId: string,
    filters?: any,
  ): Promise<AIExecution[]> {
    return aiExecutionsApi.list(workspaceId, filters);
  },

  async getReportDefinitions(workspaceId: string) {
    return analyticsApi.reportDefinitions(workspaceId);
  },

  async generateReport(
    workspaceId: string,
    type: ReportType,
    dateRange = '7D',
  ) {
    return analyticsApi.report(workspaceId, type, toAnalyticsRange(dateRange));
  },

  async exportReportCsv(
    workspaceId: string,
    type: ReportType,
    dateRange = '7D',
  ) {
    return analyticsApi.reportCsv(workspaceId, type, toAnalyticsRange(dateRange));
  },
};
