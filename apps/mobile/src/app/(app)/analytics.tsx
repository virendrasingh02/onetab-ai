import { agentsApi, analyticsApi, queryKeys } from '@org/api-client';
import type { TimeSeriesPoint } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Badge,
  Card,
  Divider,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
  StatTile,
} from '../../components/ui';
import {
  formatBytes,
  formatNumber,
  humanize,
  relativeTime,
  statusTone,
} from '../../lib/format';
import { lastDaysRange } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { useTheme } from '../../theme/theme';
import { radius, spacing } from '../../theme/tokens';

const RANGES = [7, 30, 90] as const;

function trend(changePct: number | null): string | undefined {
  if (changePct === null) return undefined;
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${Math.round(changePct)}% vs previous`;
}

/** A compact bar chart: plain views, no chart library, accessible as a summary. */
function MiniBars({
  series,
  label,
}: {
  series: TimeSeriesPoint[];
  label: string;
}) {
  const { colors } = useTheme();
  const values = series.map((p) => p.value);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatNumber(total)} total over ${series.length} days, peak ${formatNumber(max)}`}
    >
      <View style={styles.bars}>
        {series.map((point) => (
          <View
            key={point.date}
            style={[
              styles.bar,
              {
                height: `${Math.max(2, (point.value / max) * 100)}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const range = useMemo(() => lastDaysRange(days), [days]);

  const dashboard = useQuery({
    queryKey: queryKeys.analytics.dashboard(workspaceId, range),
    queryFn: () => analyticsApi.dashboard(workspaceId, range),
  });
  const ai = useQuery({
    queryKey: [...queryKeys.analytics.all(workspaceId), 'ai-usage', days],
    queryFn: () => analyticsApi.aiUsage(workspaceId, range),
  });
  const logs = useQuery({
    queryKey: queryKeys.agents.workspaceLogs(workspaceId),
    queryFn: () => agentsApi.workspaceLogs(workspaceId),
  });

  return (
    <Screen
      refreshing={dashboard.isRefetching || ai.isRefetching}
      onRefresh={() =>
        void Promise.all([dashboard.refetch(), ai.refetch(), logs.refetch()])
      }
    >
      <View style={styles.ranges} accessibilityRole="tablist">
        {RANGES.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDays(d)}
            accessibilityRole="tab"
            accessibilityState={{ selected: d === days }}
            style={[
              styles.range,
              {
                backgroundColor: d === days ? colors.primary : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText
              variant="label"
              style={
                d === days ? { color: colors.primaryForeground } : undefined
              }
            >
              {d} days
            </AppText>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Workspace" />
      <QueryBoundary query={dashboard}>
        {(d) => (
          <>
            <View style={styles.grid}>
              <StatTile
                label="Messages"
                value={formatNumber(d.headline.messages.current)}
                hint={trend(d.headline.messages.changePct)}
              />
              <StatTile
                label="Active members"
                value={formatNumber(d.headline.members.current)}
                hint={trend(d.headline.members.changePct)}
              />
              <StatTile
                label="AI sessions"
                value={formatNumber(d.headline.aiSessions.current)}
                hint={trend(d.headline.aiSessions.changePct)}
              />
              <StatTile
                label="Storage"
                value={formatBytes(d.totals.storageBytes)}
                hint={`${formatNumber(d.totals.uploads)} files`}
              />
            </View>
            {d.activitySeries.length ? (
              <Card>
                <AppText variant="label">Activity</AppText>
                <MiniBars series={d.activitySeries} label="Activity" />
              </Card>
            ) : null}
          </>
        )}
      </QueryBoundary>

      <SectionHeader title="AI usage" />
      <QueryBoundary query={ai}>
        {(s) => (
          <>
            <View style={styles.grid}>
              <StatTile
                label="Agent runs"
                value={formatNumber(s.agentExecutions)}
                hint={`${Math.round(s.agentSuccessRate)}% success`}
              />
              <StatTile
                label="Workflow runs"
                value={formatNumber(s.workflowExecutions)}
                hint={`${Math.round(s.workflowSuccessRate)}% success`}
              />
              <StatTile
                label="Tokens (est.)"
                value={formatNumber(s.estimatedTokens)}
              />
              <StatTile
                label="Active workflows"
                value={`${s.activeWorkflows}/${s.totalWorkflows}`}
              />
            </View>
            {s.usageSeries.length ? (
              <Card>
                <AppText variant="label">AI usage</AppText>
                <MiniBars series={s.usageSeries} label="AI usage" />
              </Card>
            ) : null}
            {s.topAgents.length ? (
              <Card style={styles.listCard}>
                <AppText variant="label">Top agents</AppText>
                {s.topAgents.map((agent, index) => (
                  <View key={agent.agentId}>
                    {index > 0 ? <Divider /> : null}
                    <ListRow
                      title={agent.name}
                      subtitle={`${formatNumber(agent.executions)} runs · ${formatNumber(agent.tokens)} tokens`}
                      right={
                        <Badge
                          label={`${Math.round(agent.successRate)}%`}
                          tone={agent.successRate >= 90 ? 'success' : 'warning'}
                        />
                      }
                    />
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </QueryBoundary>

      <SectionHeader title="Execution log" />
      <QueryBoundary query={logs}>
        {(entries) => (
          <Card style={styles.listCard}>
            {entries.length === 0 ? (
              <AppText variant="muted">No agent runs yet.</AppText>
            ) : (
              entries.slice(0, 25).map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    title={entry.agent?.name ?? 'Agent'}
                    subtitle={`${relativeTime(entry.executedAt)} · ${formatNumber(entry.tokensUsed)} tokens`}
                    right={
                      <Badge
                        label={humanize(entry.status)}
                        tone={statusTone(entry.status)}
                      />
                    }
                  />
                </View>
              ))
            )}
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  ranges: { flexDirection: 'row', gap: spacing.sm },
  range: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  listCard: { paddingVertical: spacing.sm },
});
