import {
  aiExecutionsApi,
  approvalsApi,
  intelligenceApi,
  queryKeys,
} from '@org/api-client';
import type { AIApprovalRequest } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '../../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
} from '../../../../components/ui';
import {
  formatDuration,
  humanize,
  relativeTime,
  statusTone,
} from '../../../../lib/format';
import { routeForDeepLink } from '../../../../lib/deep-links';
import { haptics } from '../../../../lib/haptics';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { radius, spacing } from '../../../../theme/tokens';

export default function UpdatesTab() {
  const { workspaceId, workspace } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  // 1. Pending Approvals
  const pendingApprovals = useQuery({
    queryKey: queryKeys.approvals.list(workspaceId, 'PENDING'),
    queryFn: () => approvalsApi.list(workspaceId, 'PENDING'),
    refetchInterval: 15_000,
  });

  // 2. Intelligence Attention / Catch-Up
  const attention = useQuery({
    queryKey: ['mobile', 'intelligence-attention', workspaceId],
    queryFn: () => intelligenceApi.attention(workspaceId).catch(() => []),
  });

  const catchUp = useQuery({
    queryKey: ['mobile', 'intelligence-catch-up', workspaceId],
    queryFn: () => intelligenceApi.catchUp(workspaceId).catch(() => null),
  });

  // 3. Recent Executions & Automation Activity
  const recentExecutions = useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId, { limit: 8 }),
    queryFn: () => aiExecutionsApi.list(workspaceId, { limit: 8 }),
    refetchInterval: (q) =>
      q.state.data?.some((e) => e.status === 'RUNNING') ? 5000 : 30_000,
  });

  // Approval decision mutation
  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string;
    }) =>
      approvalsApi.decide(workspaceId, input.id, {
        decision: input.decision,
        comment: input.comment,
      }),
    onSuccess: () => {
      haptics.success();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.all(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiExecutions.all(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(workspaceId),
      });
    },
    onError: (error) => {
      haptics.warning();
      Alert.alert('Decision failed', error.message);
    },
  });

  const isRefreshing =
    pendingApprovals.isRefetching ||
    attention.isRefetching ||
    catchUp.isRefetching ||
    recentExecutions.isRefetching;

  const onRefresh = () => {
    void pendingApprovals.refetch();
    void attention.refetch();
    void catchUp.refetch();
    void recentExecutions.refetch();
  };

  const pendingList = pendingApprovals.data ?? [];
  const attentionList = attention.data ?? [];
  const executionsList = recentExecutions.data ?? [];

  return (
    <Screen refreshing={isRefreshing} onRefresh={onRefresh}>
      {/* Catch-Up Intelligence Brief */}
      {catchUp.data?.greeting || catchUp.data?.keyUpdates?.length ? (
        <Card style={styles.briefCard}>
          <View style={styles.briefHeader}>
            <View style={styles.briefIcon}>
              <AppText style={{ fontSize: 20 }}>✨</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="label">Daily AI Catch-Up</AppText>
              <AppText variant="caption">
                {workspace?.name} · Summarized by AI
              </AppText>
            </View>
          </View>
          {catchUp.data?.greeting ? (
            <AppText variant="body" style={styles.headline}>
              {catchUp.data.greeting}
            </AppText>
          ) : null}
          {catchUp.data?.keyUpdates?.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.highlightRow}>
              <AppText style={styles.bullet}>•</AppText>
              <AppText variant="caption" style={styles.flex}>
                <AppText variant="label" style={{ fontSize: 13 }}>
                  {item.title}:{' '}
                </AppText>
                {item.summary}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Attention Items */}
      {attentionList.length > 0 ? (
        <>
          <SectionHeader title="Needs Attention" />
          <Card>
            {attentionList.map((item, index) => (
              <View key={item.id || item.itemKey || index}>
                {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon="alert-circle-outline"
                  title={item.title}
                  subtitle={item.description}
                  right={
                    item.priorityScore ? (
                      <Badge
                        label={item.priorityScore > 80 ? 'Urgent' : 'Notice'}
                        tone={item.priorityScore > 80 ? 'danger' : 'warning'}
                      />
                    ) : null
                  }
                  onPress={() => {
                    if (item.deepLink) {
                      haptics.selection();
                      const route = routeForDeepLink(item.deepLink);
                      if (route.pathname !== '/notifications') {
                        router.push({
                          pathname: route.pathname,
                          params: route.params,
                        } as Href);
                      }
                    }
                  }}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Pending Approvals Queue */}
      <SectionHeader
        title={`Pending Approvals (${pendingList.length})`}
        action={
          pendingList.length > 0 ? (
            <Pressable
              onPress={() => router.push('/approvals')}
              hitSlop={8}
            >
              <AppText
                variant="label"
                style={{ color: colors.primaryText, fontSize: 13 }}
              >
                View all
              </AppText>
            </Pressable>
          ) : undefined
        }
      />
      {pendingList.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="muted" style={styles.emptyText}>
            ✓ All clear · No pending agent approvals
          </AppText>
        </Card>
      ) : (
        <View style={styles.approvalsList}>
          {pendingList.slice(0, 3).map((req) => (
            <PendingApprovalCard
              key={req.id}
              request={req}
              busy={decide.isPending && decide.variables?.id === req.id}
              onApprove={() => decide.mutate({ id: req.id, decision: 'APPROVED' })}
              onReject={() => decide.mutate({ id: req.id, decision: 'REJECTED' })}
            />
          ))}
        </View>
      )}

      {/* Live Automation & Workflow Executions */}
      <SectionHeader
        title="Live Workflow Activity"
        action={
          <Pressable
            onPress={() => router.push('/executions')}
            hitSlop={8}
          >
            <AppText
              variant="label"
              style={{ color: colors.primaryText, fontSize: 13 }}
            >
              History
            </AppText>
          </Pressable>
        }
      />
      {executionsList.length === 0 ? (
        <Card style={styles.emptyCard}>
          <AppText variant="muted" style={styles.emptyText}>
            No recent workflow executions recorded
          </AppText>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {executionsList.map((exec, idx) => (
            <View key={exec.id}>
              {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
              <ListRow
                title={`${humanize(exec.entityType)} ${exec.model ? `· ${exec.model}` : ''}`}
                subtitle={[
                  exec.latencyMs ? formatDuration(exec.latencyMs) : null,
                  relativeTime(exec.startedAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  <Badge
                    label={humanize(exec.status) || exec.status}
                    tone={statusTone(exec.status)}
                  />
                }
                onPress={() =>
                  router.push({
                    pathname: '/executions',
                    params: { run: exec.id },
                  })
                }
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function PendingApprovalCard({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: AIApprovalRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const requesterName = request.requester?.name || humanize(request.entityType) || 'AI Agent';

  return (
    <Card style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.flex}>
          <AppText variant="label">
            {requesterName}
          </AppText>
          <AppText variant="caption">
            {humanize(request.actionType)} · {relativeTime(request.createdAt)}
          </AppText>
        </View>
        <Badge label="Requires Approval" tone="warning" />
      </View>

      {request.proposedPayload ? (
        <AppText variant="caption" numberOfLines={3} style={styles.approvalDesc}>
          {JSON.stringify(request.proposedPayload)}
        </AppText>
      ) : null}

      <View style={styles.approvalButtons}>
        <Button
          label="Reject"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            Alert.alert(
              'Reject Action?',
              'The agent will be informed that this step was denied.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: onReject },
              ],
            );
          }}
          style={styles.decisionBtn}
        />
        <Button
          label="Approve"
          variant="primary"
          loading={busy}
          disabled={busy}
          onPress={onApprove}
          style={styles.decisionBtn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  briefCard: {
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  briefIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(96, 198, 134, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 18,
    opacity: 0.6,
  },
  emptyCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  approvalsList: {
    gap: spacing.sm,
  },
  approvalCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  approvalDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  decisionBtn: {
    flex: 1,
    minHeight: 38,
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
});
