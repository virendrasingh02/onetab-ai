import { agentsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../../../lib/alert';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
  TextField,
  ToggleRow,
} from '../../../../components/ui';
import {
  formatNumber,
  humanize,
  relativeTime,
  statusTone,
} from '../../../../lib/format';
import { useWorkspace } from '../../../../lib/workspace';
import { spacing } from '../../../../theme/tokens';

export default function AgentDetailScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const agent = useQuery({
    queryKey: queryKeys.agents.detail(workspaceId, agentId),
    queryFn: () => agentsApi.get(workspaceId, agentId),
  });
  const logs = useQuery({
    queryKey: queryKeys.agents.logs(workspaceId, agentId),
    queryFn: () => agentsApi.logs(workspaceId, agentId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.agents.all(workspaceId),
    });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) =>
      agentsApi.update(workspaceId, agentId, { isActive }),
    onSuccess: () => void invalidate(),
    onError: (error) =>
      Alert.alert('Could not update the agent', error.message),
  });

  const run = useMutation({
    mutationFn: (text: string) => agentsApi.execute(workspaceId, agentId, text),
    onSuccess: (res) => {
      setResult(res.result);
      setPrompt('');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agents.logs(workspaceId, agentId),
      });
    },
    onError: (error) => Alert.alert('Run failed', error.message),
  });

  const remove = useMutation({
    mutationFn: () => agentsApi.remove(workspaceId, agentId),
    onSuccess: () => {
      void invalidate();
      router.back();
    },
    onError: (error) =>
      Alert.alert('Could not delete the agent', error.message),
  });

  const confirmDelete = (name: string) =>
    Alert.alert(
      `Delete ${name}?`,
      'Its schedules and history are removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => remove.mutate(),
        },
      ],
    );

  return (
    <Screen
      refreshing={agent.isRefetching}
      onRefresh={() => void Promise.all([agent.refetch(), logs.refetch()])}
    >
      <QueryBoundary query={agent} loadingLabel="Loading agent…">
        {(a) => (
          <>
            <Stack.Screen options={{ title: a.name }} />
            <Card>
              <View style={styles.header}>
                <Avatar name={a.name} uri={a.avatarUrl} size={48} />
                <View style={styles.flex}>
                  <AppText variant="heading">{a.name}</AppText>
                  <AppText variant="muted">{a.role}</AppText>
                </View>
                <Badge
                  label={a.isActive ? 'Active' : 'Paused'}
                  tone={a.isActive ? 'success' : 'warning'}
                />
              </View>
              {a.description ? (
                <AppText variant="body">{a.description}</AppText>
              ) : null}
              <AppText variant="caption">
                {a.provider} · {a.model}
                {a.schedules.length
                  ? ` · ${a.schedules.length} schedule${a.schedules.length === 1 ? '' : 's'}`
                  : ''}
              </AppText>
              <ToggleRow
                label="Agent is active"
                description="Paused agents don't run on schedules, triggers or mentions."
                value={a.isActive}
                onValueChange={(value) => setActive.mutate(value)}
                disabled={setActive.isPending}
              />
            </Card>

            <View style={styles.actions}>
              <Button
                label="Chat"
                icon="chatbubble-ellipses-outline"
                onPress={() =>
                  router.push({
                    pathname: '/agent/[agentId]/chat',
                    params: { agentId },
                  })
                }
                style={styles.flex}
              />
              <Button
                label="Configure"
                icon="options-outline"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/agent/[agentId]/edit',
                    params: { agentId },
                  })
                }
                style={styles.flex}
              />
            </View>

            <SectionHeader title="Run once" />
            <Card>
              <TextField
                placeholder="What should the agent do?"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                accessibilityLabel="Prompt for a one-off run"
              />
              <Button
                label="Run"
                icon="play"
                onPress={() => run.mutate(prompt.trim())}
                loading={run.isPending}
                disabled={!prompt.trim() || !a.isActive}
              />
              {!a.isActive ? (
                <AppText variant="caption">
                  Activate the agent to run it.
                </AppText>
              ) : null}
              {result !== null ? (
                <View style={styles.result}>
                  <AppText variant="label">Result</AppText>
                  <AppText variant="body" selectable>
                    {result}
                  </AppText>
                </View>
              ) : null}
            </Card>

            <SectionHeader title="Recent runs" />
            <QueryBoundary query={logs}>
              {(entries) => (
                <Card style={styles.listCard}>
                  {entries.length === 0 ? (
                    <AppText variant="muted">No runs yet.</AppText>
                  ) : (
                    entries.slice(0, 20).map((log, index) => (
                      <View key={log.id}>
                        {index > 0 ? <Divider /> : null}
                        <ListRow
                          title={log.promptText || 'Scheduled run'}
                          subtitle={`${relativeTime(log.executedAt)} · ${formatNumber(log.tokensUsed)} tokens`}
                          right={
                            <Badge
                              label={humanize(log.status)}
                              tone={statusTone(log.status)}
                            />
                          }
                          onPress={() =>
                            Alert.alert(
                              humanize(log.status),
                              log.outputResult || 'No output.',
                            )
                          }
                        />
                      </View>
                    ))
                  )}
                </Card>
              )}
            </QueryBoundary>

            <Button
              label="Delete agent"
              variant="ghost"
              onPress={() => confirmDelete(a.name)}
              loading={remove.isPending}
            />
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  result: { gap: spacing.xs, paddingTop: spacing.sm },
  listCard: { paddingVertical: spacing.xs },
});
