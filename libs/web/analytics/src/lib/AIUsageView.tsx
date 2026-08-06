import {
  Bot,
  Coins,
  MessageSquare,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RangePicker,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatNumber,
} from '@org/analytics-ui';
import { useAIUsageAnalytics } from './use-analytics.js';

/** Consumption of the AI platform: chat, agents, workflows and token spend. */
export function AIUsageView() {
  const [days, setDays] = useState(30);
  const query = useAIUsageAnalytics(days);
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Sparkles />}
        accent="pink"
        title="AI Usage"
        description="Chat, agent and workflow consumption with reliability and token estimates"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
            <RefreshButton
              onClick={() => query.refetch()}
              busy={query.isFetching}
            />
          </>
        }
      />

      <QueryState isLoading={query.isLoading} error={query.error}>
        {data ? (
          <>
            <div className="md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Chat sessions"
                value={data.totalSessions}
                icon={MessageSquare}
                accent="blue"
                hint="all time"
              />
              <MetricCard
                label="Agents"
                value={data.totalAgents}
                icon={Bot}
                accent="violet"
                hint={`${data.activeAgents} active`}
              />
              <MetricCard
                label="Workflows"
                value={data.totalWorkflows}
                icon={Workflow}
                accent="amber"
                hint={`${data.activeWorkflows} active`}
              />
              <MetricCard
                label="Agent runs"
                value={data.agentExecutions}
                icon={Zap}
                accent="green"
                hint={`in the last ${days}d`}
              />
              <MetricCard
                label="Workflow runs"
                value={data.workflowExecutions}
                icon={Workflow}
                accent="cyan"
                hint={`avg ${formatNumber(data.avgWorkflowDurationMs)}ms`}
              />
              <MetricCard
                label="Estimated tokens"
                value={data.estimatedTokens}
                icon={Coins}
                accent="pink"
                hint="logged + transcript estimate"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title={`AI activity · last ${days} days`}
                subtitle="Chat sessions, agent runs and workflow runs per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.usageSeries}
                  accent="pink"
                  valueLabel="AI operations"
                />
              </Panel>

              <div className="space-y-6">
                <Panel title="Feature mix" subtitle={`Last ${days} days`}>
                  <Breakdown
                    slices={data.featureBreakdown}
                    emptyMessage="No AI activity in this range."
                  />
                </Panel>

                <Panel title="Reliability" subtitle="Successful runs">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs mb-1.5 flex justify-between">
                        <span className="text-foreground">Agent runs</span>
                        <span className="font-semibold text-foreground">
                          {data.agentSuccessRate}%
                        </span>
                      </div>
                      <ProgressBar pct={data.agentSuccessRate} accent="green" />
                    </div>
                    <div>
                      <div className="text-xs mb-1.5 flex justify-between">
                        <span className="text-foreground">Workflow runs</span>
                        <span className="font-semibold text-foreground">
                          {data.workflowSuccessRate}%
                        </span>
                      </div>
                      <ProgressBar
                        pct={data.workflowSuccessRate}
                        accent="blue"
                      />
                    </div>
                  </div>
                </Panel>
              </div>
            </div>

            <Panel
              title="Busiest agents"
              subtitle={`Execution volume over the last ${days} days`}
            >
              <DataTable
                columns={['Agent', 'Runs', 'Success rate', 'Tokens']}
                rows={data.topAgents.map((agent) => [
                  <span className="font-medium text-foreground">
                    {agent.name}
                  </span>,
                  formatNumber(agent.executions),
                  <span
                    className={
                      agent.successRate >= 90
                        ? 'text-success'
                        : agent.successRate >= 70
                          ? 'text-warning'
                          : 'text-destructive'
                    }
                  >
                    {agent.successRate}%
                  </span>,
                  formatNumber(agent.tokens),
                ])}
                emptyMessage="No agent executions recorded in this range."
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
