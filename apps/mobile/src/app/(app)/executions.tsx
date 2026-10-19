import { aiExecutionsApi, queryKeys } from '@org/api-client';
import type { AIExecution, AIExecutionStatus } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  QueryBoundary,
  Screen,
} from '../../components/ui';
import {
  formatDuration,
  formatNumber,
  humanize,
  relativeTime,
  statusTone,
} from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { useTheme } from '../../theme/theme';
import { radius, spacing } from '../../theme/tokens';

const FILTERS: Array<{ label: string; status?: AIExecutionStatus }> = [
  { label: 'All' },
  { label: 'Running', status: 'RUNNING' },
  { label: 'Waiting', status: 'WAITING_APPROVAL' },
  { label: 'Paused', status: 'PAUSED' },
  { label: 'Failed', status: 'FAILED' },
];

/** Live monitor for agent, workflow and coworker runs, with the run controls the API offers. */
export default function ExecutionsScreen() {
  const { run, entityId } = useLocalSearchParams<{
    run?: string;
    entityId?: string;
  }>();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [status, setStatus] = useState<AIExecutionStatus | undefined>();

  const filters = { status, entityId, limit: 50 };
  const list = useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId, filters),
    queryFn: () => aiExecutionsApi.list(workspaceId, filters),
    refetchInterval: (q) =>
      q.state.data?.some((e) => e.status === 'RUNNING') ? 5000 : false,
  });

  const control = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'pause' | 'resume' | 'cancel' | 'retry';
    }): Promise<unknown> => aiExecutionsApi[action](workspaceId, id),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiExecutions.all(workspaceId),
      }),
    onError: (error) => Alert.alert('Action failed', error.message),
  });

  const confirmCancel = (id: string) =>
    Alert.alert('Cancel this run?', 'Steps that already ran are not undone.', [
      { text: 'Keep running', style: 'cancel' },
      {
        text: 'Cancel run',
        style: 'destructive',
        onPress: () => control.mutate({ id, action: 'cancel' }),
      },
    ]);

  return (
    <Screen
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const active = f.status === status;
          return (
            <Pressable
              key={f.label}
              onPress={() => setStatus(f.status)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText
                variant="label"
                style={active ? { color: colors.primaryForeground } : undefined}
              >
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <QueryBoundary query={list} loadingLabel="Loading runs…">
        {(runs) =>
          runs.length === 0 ? (
            <EmptyState
              icon="pulse-outline"
              title="No runs"
              description="Agent and workflow runs show up here as they happen."
            />
          ) : (
            <>
              {runs.map((execution) => (
                <ExecutionCard
                  key={execution.id}
                  execution={execution}
                  highlighted={execution.id === run}
                  busy={
                    control.isPending && control.variables?.id === execution.id
                  }
                  onAction={(action) =>
                    action === 'cancel'
                      ? confirmCancel(execution.id)
                      : control.mutate({ id: execution.id, action })
                  }
                />
              ))}
            </>
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

function ExecutionCard({
  execution,
  highlighted,
  busy,
  onAction,
}: {
  execution: AIExecution;
  highlighted: boolean;
  busy: boolean;
  onAction: (action: 'pause' | 'resume' | 'cancel' | 'retry') => void;
}) {
  const { colors } = useTheme();
  const s = execution.status;
  return (
    <Card
      style={
        highlighted ? { borderColor: colors.ring, borderWidth: 2 } : undefined
      }
    >
      <View style={styles.header}>
        <AppText variant="label">
          {humanize(execution.entityType)} · v{execution.version}
        </AppText>
        <Badge label={humanize(s)} tone={statusTone(s)} />
      </View>
      <AppText variant="caption">
        {relativeTime(execution.startedAt)}
        {execution.latencyMs ? ` · ${formatDuration(execution.latencyMs)}` : ''}
        {execution.tokensUsed
          ? ` · ${formatNumber(execution.tokensUsed)} tokens`
          : ''}
        {execution.model ? ` · ${execution.model}` : ''}
        {execution.user ? ` · by ${execution.user.name}` : ''}
      </AppText>
      {execution.errorsJson ? (
        <AppText
          variant="caption"
          style={{ color: colors.destructiveText }}
          numberOfLines={3}
        >
          {String(
            (execution.errorsJson as { message?: unknown }).message ??
              JSON.stringify(execution.errorsJson),
          )}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        {s === 'RUNNING' && execution.entityType === 'WORKFLOW' ? (
          <Button
            label="Pause"
            variant="secondary"
            icon="pause"
            onPress={() => onAction('pause')}
            loading={busy}
            style={styles.flex}
          />
        ) : null}
        {s === 'PAUSED' ? (
          <Button
            label="Resume"
            icon="play"
            onPress={() => onAction('resume')}
            loading={busy}
            style={styles.flex}
          />
        ) : null}
        {s === 'RUNNING' || s === 'PAUSED' || s === 'WAITING_APPROVAL' ? (
          <Button
            label="Cancel"
            variant="secondary"
            icon="stop"
            onPress={() => onAction('cancel')}
            disabled={busy}
            style={styles.flex}
          />
        ) : null}
        {s === 'FAILED' || s === 'CANCELLED' ? (
          <Button
            label="Retry"
            variant="secondary"
            icon="refresh"
            onPress={() => onAction('retry')}
            loading={busy}
            style={styles.flex}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
