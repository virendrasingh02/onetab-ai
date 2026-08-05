import { Bot, Coins, MessageSquare, Sparkles, Workflow, Zap } from 'lucide-react';
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
        icon={<Sparkles className="w-6 h-6 text-pink-400" />}
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <MetricCard
                label="Chat sessions"
                value={data.totalSessions}
                icon={MessageSquare}
                color="bg-blue-600/20 text-blue-400"
                hint="all time"
              />
              <MetricCard
                label="Agents"
                value={data.totalAgents}
                icon={Bot}
                color="bg-purple-600/20 text-purple-400"
                hint={`${data.activeAgents} active`}
              />
              <MetricCard
                label="Workflows"
                value={data.totalWorkflows}
                icon={Workflow}
                color="bg-amber-600/20 text-amber-400"
                hint={`${data.activeWorkflows} active`}
              />
              <MetricCard
                label="Agent runs"
                value={data.agentExecutions}
                icon={Zap}
                color="bg-emerald-600/20 text-emerald-400"
                hint={`in the last ${days}d`}
              />
              <MetricCard
                label="Workflow runs"
                value={data.workflowExecutions}
                icon={Workflow}
                color="bg-cyan-600/20 text-cyan-400"
                hint={`avg ${formatNumber(data.avgWorkflowDurationMs)}ms`}
              />
              <MetricCard
                label="Estimated tokens"
                value={data.estimatedTokens}
                icon={Coins}
                color="bg-pink-600/20 text-pink-400"
                hint="logged + transcript estimate"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`AI activity · last ${days} days`}
                subtitle="Chat sessions, agent runs and workflow runs per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.usageSeries}
                  color="from-pink-600 to-purple-500"
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
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Agent runs</span>
                        <span className="font-semibold text-white">
                          {data.agentSuccessRate}%
                        </span>
                      </div>
                      <ProgressBar
                        pct={data.agentSuccessRate}
                        color="from-emerald-600 to-teal-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-300">Workflow runs</span>
                        <span className="font-semibold text-white">
                          {data.workflowSuccessRate}%
                        </span>
                      </div>
                      <ProgressBar
                        pct={data.workflowSuccessRate}
                        color="from-blue-600 to-cyan-400"
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
                  <span className="text-slate-100 font-medium">
                    {agent.name}
                  </span>,
                  formatNumber(agent.executions),
                  <span
                    className={
                      agent.successRate >= 90
                        ? 'text-emerald-400'
                        : agent.successRate >= 70
                          ? 'text-amber-400'
                          : 'text-red-400'
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
