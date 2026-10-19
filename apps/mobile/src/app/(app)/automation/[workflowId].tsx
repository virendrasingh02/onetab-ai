import { automationsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
  ToggleRow,
} from '../../../components/ui';
import { webLink } from '../../../lib/config';
import {
  formatDuration,
  humanize,
  relativeTime,
  statusTone,
} from '../../../lib/format';
import { useWorkspace } from '../../../lib/workspace';
import { spacing } from '../../../theme/tokens';

function stepCount(nodesJson: string): number {
  try {
    const nodes = JSON.parse(nodesJson) as unknown;
    return Array.isArray(nodes) ? nodes.length : 0;
  } catch {
    return 0;
  }
}

export default function AutomationDetailScreen() {
  const { workflowId } = useLocalSearchParams<{ workflowId: string }>();
  const { workspaceId, workspace } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const workflow = useQuery({
    queryKey: queryKeys.automations.detail(workspaceId, workflowId),
    queryFn: () => automationsApi.get(workspaceId, workflowId),
  });
  const executions = useQuery({
    queryKey: queryKeys.automations.executions(workspaceId, workflowId),
    queryFn: () => automationsApi.executions(workspaceId, workflowId),
    // Keep an eye on runs in flight without polling an idle screen forever.
    refetchInterval: (q) =>
      q.state.data?.some((e) => e.status === 'RUNNING') ? 5000 : false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.automations.all(workspaceId),
    });

  const toggle = useMutation({
    mutationFn: (isActive: boolean) =>
      automationsApi.update(workspaceId, workflowId, { isActive }),
    onSuccess: () => void invalidate(),
    onError: (error) => Alert.alert('Could not update', error.message),
  });

  const trigger = useMutation({
    mutationFn: () =>
      automationsApi.trigger(workspaceId, workflowId, { source: 'mobile' }),
    onSuccess: (res) => {
      void invalidate();
      Alert.alert(
        'Run started',
        res.status === 'WAITING_APPROVAL'
          ? 'The run is waiting for an approval.'
          : `Finished with status ${humanize(res.status)}.`,
      );
    },
    onError: (error) =>
      Alert.alert('Could not run the automation', error.message),
  });

  const confirmRun = () =>
    Alert.alert(
      'Run this automation now?',
      'Its steps will run for real, including any external actions.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run', onPress: () => trigger.mutate() },
      ],
    );

  return (
    <Screen
      refreshing={workflow.isRefetching}
      onRefresh={() =>
        void Promise.all([workflow.refetch(), executions.refetch()])
      }
    >
      <QueryBoundary query={workflow} loadingLabel="Loading automation…">
        {(wf) => (
          <>
            <Stack.Screen options={{ title: wf.name }} />
            <Card>
              <AppText variant="heading">{wf.name}</AppText>
              {wf.description ? (
                <AppText variant="body">{wf.description}</AppText>
              ) : null}
              <AppText variant="caption">
                {humanize(wf.triggerType)} trigger · {stepCount(wf.nodesJson)}{' '}
                steps · {wf._count.executions} runs
              </AppText>
              <ToggleRow
                label="Enabled"
                description="Disabled automations ignore their trigger."
                value={wf.isActive}
                onValueChange={(value) => toggle.mutate(value)}
                disabled={toggle.isPending}
              />
            </Card>
            <View style={styles.actions}>
              <Button
                label="Run now"
                icon="play"
                onPress={confirmRun}
                loading={trigger.isPending}
                style={styles.flex}
              />
              <Button
                label="Edit steps"
                icon="open-outline"
                variant="secondary"
                onPress={() =>
                  void WebBrowser.openBrowserAsync(
                    webLink(workspace?.slug, `automations/builder/${wf.id}`),
                  )
                }
                style={styles.flex}
              />
            </View>

            <SectionHeader title="Executions" />
            <QueryBoundary query={executions}>
              {(runs) => (
                <Card style={styles.listCard}>
                  {runs.length === 0 ? (
                    <AppText variant="muted">No runs yet.</AppText>
                  ) : (
                    runs.slice(0, 30).map((run, index) => {
                      const duration =
                        run.finishedAt && run.startedAt
                          ? formatDuration(
                              new Date(run.finishedAt).getTime() -
                                new Date(run.startedAt).getTime(),
                            )
                          : null;
                      return (
                        <View key={run.id}>
                          {index > 0 ? <Divider /> : null}
                          <ListRow
                            title={relativeTime(run.startedAt)}
                            subtitle={
                              duration ? `took ${duration}` : 'in progress'
                            }
                            right={
                              <Badge
                                label={humanize(run.status)}
                                tone={statusTone(run.status)}
                              />
                            }
                            onPress={() =>
                              router.push({
                                pathname: '/executions',
                                params: { entityId: wf.id },
                              })
                            }
                          />
                        </View>
                      );
                    })
                  )}
                </Card>
              )}
            </QueryBoundary>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  listCard: { paddingVertical: spacing.xs },
});
