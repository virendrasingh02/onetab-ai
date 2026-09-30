import { analyticsApi } from '@org/api-client';
import { INITIAL_ANALYTICS } from './mockData.js';

export const analyticsService = {
  async getAnalytics(dateRange = '7D', workspaceId = null) {
    let multiplier = 1;
    let days = 7;
    if (dateRange === '24H') {
      multiplier = 0.2;
      days = 1;
    } else if (dateRange === '30D') {
      multiplier = 4.2;
      days = 30;
    } else if (dateRange === '90D') {
      multiplier = 12.5;
      days = 90;
    }

    const base = INITIAL_ANALYTICS;

    // Try fetching live workspace AI usage metrics if workspaceId is provided
    if (workspaceId) {
      try {
        const live = await analyticsApi.aiUsage(workspaceId, { days });
        if (live && (live.totalSessions > 0 || live.agentExecutions > 0 || live.estimatedTokens > 0)) {
          const totalRuns = (live.agentExecutions || 0) + (live.workflowExecutions || 0);
          const successRuns = Math.round(totalRuns * ((live.agentSuccessRate || 95) / 100));
          const failedRuns = Math.max(0, totalRuns - successRuns);

          return {
            dateRange,
            summary: {
              totalExecutions: totalRuns,
              successfulExecutions: successRuns,
              failedExecutions: failedRuns,
              pendingApprovals: 0,
              successRate: live.agentSuccessRate || 98.4,
              avgLatencyMs: Math.round(live.avgWorkflowDurationMs || 640),
              totalTokens: live.estimatedTokens > 1000000
                ? `${(live.estimatedTokens / 1000000).toFixed(1)}M`
                : `${(live.estimatedTokens / 1000).toFixed(1)}k`,
              totalCost: `$${((live.estimatedTokens / 1000000) * 8.5).toFixed(2)}`,
              activeAgentsCount: live.activeAgents || 1,
            },
            timeSeries: (live.usageSeries && live.usageSeries.length > 0)
              ? live.usageSeries.map((s) => ({
                  date: s.timestamp.slice(5, 10),
                  success: Math.round(s.value * 0.96),
                  failed: Math.round(s.value * 0.04),
                }))
              : base.timeSeries,
            modelsBreakdown: base.modelsBreakdown,
            latencyPercentiles: {
              p50: `${Math.round((live.avgWorkflowDurationMs || 600) * 0.75)}ms`,
              p90: `${Math.round((live.avgWorkflowDurationMs || 600) * 1.5)}ms`,
              p99: `${Math.round((live.avgWorkflowDurationMs || 600) * 2.8)}ms`,
            },
          };
        }
      } catch (err) {
        console.warn('Live AI analytics retrieval fallback:', err);
      }
    }

    const summary = {
      totalExecutions: Math.round(base.summary.totalExecutions * multiplier),
      successfulExecutions: Math.round(base.summary.successfulExecutions * multiplier),
      failedExecutions: Math.round(base.summary.failedExecutions * multiplier),
      pendingApprovals: Math.round(base.summary.pendingApprovals * (dateRange === '24H' ? 0.3 : 1)),
      successRate: base.summary.successRate,
      avgLatencyMs: base.summary.avgLatencyMs,
      totalTokens: `${(4.8 * multiplier).toFixed(1)}M`,
      totalCost: `$${(58.82 * multiplier).toFixed(2)}`,
      activeAgentsCount: base.summary.activeAgentsCount,
    };

    return {
      dateRange,
      summary,
      timeSeries: base.timeSeries,
      modelsBreakdown: base.modelsBreakdown,
      latencyPercentiles: {
        p50: '820ms',
        p90: '1.9s',
        p99: '3.4s',
      },
    };
  },
};
