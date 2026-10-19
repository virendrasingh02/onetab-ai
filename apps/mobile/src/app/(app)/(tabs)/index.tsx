import {
  analyticsApi,
  automationsApi,
  billingApi,
  queryKeys,
} from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Badge,
  Card,
  Divider,
  ListRow,
  ProgressBar,
  QueryBoundary,
  Screen,
  SectionHeader,
  StatTile,
} from '../../../components/ui';
import {
  formatDuration,
  formatLimit,
  formatNumber,
  lastDaysRange,
  relativeTime,
  statusTone,
} from '../../../lib/format';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';
import { spacing } from '../../../theme/tokens';

export default function HomeScreen() {
  const { user } = useSession();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const range = useMemo(() => lastDaysRange(30), []);

  const aiUsage = useQuery({
    queryKey: [
      ...queryKeys.analytics.all(workspaceId),
      'ai-usage',
      range.from.slice(0, 10),
    ],
    queryFn: () => analyticsApi.aiUsage(workspaceId, range),
  });
  const overview = useQuery({
    queryKey: queryKeys.automations.overview(workspaceId),
    queryFn: () => automationsApi.overview(workspaceId),
  });
  const billing = useQuery({
    queryKey: queryKeys.billing.summary(workspaceId),
    queryFn: () => billingApi.summary(workspaceId),
  });

  const refreshing =
    aiUsage.isRefetching || overview.isRefetching || billing.isRefetching;
  const refresh = () => {
    void aiUsage.refetch();
    void overview.refetch();
    void billing.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <AppText variant="heading">
        Hi {user?.displayName || user?.name?.split(' ')[0] || 'there'} 👋
      </AppText>

      <SectionHeader title="AI activity · 30 days" />
      <QueryBoundary query={aiUsage}>
        {(stats) => (
          <View style={styles.grid}>
            <StatTile
              label="Active agents"
              value={`${stats.activeAgents}/${stats.totalAgents}`}
            />
            <StatTile
              label="Agent runs"
              value={formatNumber(stats.agentExecutions)}
              hint={`${Math.round(stats.agentSuccessRate)}% success`}
              tone={stats.agentSuccessRate >= 90 ? 'success' : 'warning'}
            />
            <StatTile
              label="Workflow runs"
              value={formatNumber(stats.workflowExecutions)}
              hint={`${Math.round(stats.workflowSuccessRate)}% success`}
              tone={stats.workflowSuccessRate >= 90 ? 'success' : 'warning'}
            />
            <StatTile
              label="Tokens (est.)"
              value={formatNumber(stats.estimatedTokens)}
            />
          </View>
        )}
      </QueryBoundary>

      <SectionHeader title="Automations" />
      <QueryBoundary query={overview}>
        {(data) => (
          <>
            <View style={styles.grid}>
              <StatTile
                label="Running now"
                value={String(data.runningExecutions)}
              />
              <StatTile
                label="Failed"
                value={String(data.failedExecutions)}
                tone={data.failedExecutions ? 'danger' : 'success'}
                hint={`${Math.round(data.successRate)}% success`}
              />
              <StatTile
                label="Median run"
                value={formatDuration(data.p50DurationMs)}
              />
              <StatTile
                label="Awaiting approval"
                value={String(data.pendingApprovalsCount)}
                tone={data.pendingApprovalsCount ? 'warning' : undefined}
              />
            </View>
            {data.pendingApprovalsCount > 0 ? (
              <Card>
                <ListRow
                  icon="hand-left-outline"
                  title={`${data.pendingApprovalsCount} approval${data.pendingApprovalsCount === 1 ? '' : 's'} waiting`}
                  subtitle="Review actions your agents want to take"
                  onPress={() => router.push('/approvals')}
                />
              </Card>
            ) : null}
            <Card>
              <AppText variant="label">Recent runs</AppText>
              {data.recentExecutions.length === 0 ? (
                <AppText variant="muted">No runs yet.</AppText>
              ) : (
                data.recentExecutions.slice(0, 5).map((run, index) => (
                  <View key={run.id}>
                    {index > 0 ? <Divider /> : null}
                    <ListRow
                      title={run.workflow.name}
                      subtitle={relativeTime(run.startedAt)}
                      right={
                        <Badge
                          label={run.status}
                          tone={statusTone(run.status)}
                        />
                      }
                      onPress={() =>
                        router.push({
                          pathname: '/automation/[workflowId]',
                          params: { workflowId: run.workflowId },
                        })
                      }
                    />
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </QueryBoundary>

      <SectionHeader title="Plan usage" />
      <QueryBoundary query={billing}>
        {(summary) => (
          <Card>
            <View style={styles.planRow}>
              <AppText variant="heading">{summary.planConfig.name}</AppText>
              <Badge
                label={summary.subscription?.status ?? 'Active'}
                tone="success"
              />
            </View>
            {[
              summary.usage.aiCredits,
              summary.usage.aiRequests,
              summary.usage.automations,
              summary.usage.storage,
            ].map((metric) => (
              <View key={metric.key} style={styles.metric}>
                <View style={styles.planRow}>
                  <AppText variant="muted">{metric.label}</AppText>
                  <AppText variant="caption">
                    {formatLimit(metric.used, metric.limit, metric.unit)}
                  </AppText>
                </View>
                {metric.limit > 0 ? (
                  <ProgressBar
                    value={metric.percentage / 100}
                    tone={
                      metric.isLimitReached
                        ? 'danger'
                        : metric.isNearLimit
                          ? 'warning'
                          : 'success'
                    }
                  />
                ) : null}
              </View>
            ))}
            <ListRow
              title="See all usage & billing"
              onPress={() => router.push('/billing')}
            />
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metric: { gap: spacing.xs },
});
