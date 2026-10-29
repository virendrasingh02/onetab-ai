import Ionicons from '@expo/vector-icons/Ionicons';
import { coworkersApi } from '@org/api-client';
import type { CoworkerExecutionLog } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  IconButton,
  ListRow,
  LoadingState,
  rowDividerInset,
  Screen,
  SectionHeader,
  TextField,
} from '../../../components/ui';
import { humanize, relativeTime, statusTone } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { spacing } from '../../../theme/tokens';

export default function CoworkerDetailScreen() {
  const { coworkerId } = useLocalSearchParams<{ coworkerId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState('');

  const coworkerQuery = useQuery({
    queryKey: ['mobile', 'coworker-detail', workspaceId, coworkerId],
    queryFn: () => coworkersApi.get(workspaceId, coworkerId),
    enabled: Boolean(workspaceId && coworkerId),
  });

  const logsQuery = useQuery({
    queryKey: ['mobile', 'coworker-logs', workspaceId, coworkerId],
    queryFn: () =>
      coworkersApi
        .logs(workspaceId, coworkerId)
        .catch(() => [] as CoworkerExecutionLog[]),
    enabled: Boolean(workspaceId && coworkerId),
  });

  const executeMutation = useMutation({
    mutationFn: (prompt: string) =>
      coworkersApi.execute(workspaceId, coworkerId, { promptText: prompt }),
    onSuccess: (result) => {
      haptics.success();
      setPromptModalOpen(false);
      setTaskPrompt('');
      Alert.alert(
        'Task Launched',
        `Coworker started working on your request: ${result.coworkerName}`,
        [
          { text: 'OK' },
          {
            text: 'View Executions',
            onPress: () => router.push('/executions'),
          },
        ],
      );
      void queryClient.invalidateQueries({
        queryKey: ['mobile', 'coworker-logs', workspaceId, coworkerId],
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Execution failed', err.message);
    },
  });

  if (coworkerQuery.isPending) {
    return <LoadingState label="Loading coworker details…" />;
  }

  if (coworkerQuery.error || !coworkerQuery.data) {
    return (
      <ErrorState
        error={coworkerQuery.error ?? new Error('Coworker not found')}
        onRetry={() => void coworkerQuery.refetch()}
      />
    );
  }

  const coworker = coworkerQuery.data;

  return (
    <Screen
      scroll
      refreshing={coworkerQuery.isRefetching || logsQuery.isRefetching}
      onRefresh={() => {
        void coworkerQuery.refetch();
        void logsQuery.refetch();
      }}
    >
      <Stack.Screen options={{ title: coworker.name || 'AI Coworker' }} />

      {/* Main Profile Header */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Avatar
            name={coworker.name}
            uri={coworker.avatarUrl}
            size={56}
          />
          <View style={styles.headerInfo}>
            <AppText style={[styles.name, { color: colors.foreground }]}>
              {coworker.name}
            </AppText>
            {coworker.role ? (
              <AppText style={[styles.role, { color: colors.subtle }]}>
                {coworker.role}
              </AppText>
            ) : null}
            <View style={{ marginTop: 4 }}>
              <Badge
                label={coworker.status ? humanize(coworker.status) : 'Available'}
                tone={coworker.status === 'AVAILABLE' ? 'success' : 'neutral'}
              />
            </View>
          </View>
        </View>

        {coworker.description ? (
          <AppText style={[styles.description, { color: colors.subtle }]}>
            {coworker.description}
          </AppText>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            label="Assign Task"
            icon="play-outline"
            onPress={() => {
              haptics.selection();
              setPromptModalOpen(true);
            }}
            style={styles.actionBtn}
          />
          <Button
            label="Executions"
            icon="pulse-outline"
            variant="secondary"
            onPress={() => router.push('/executions')}
            style={styles.actionBtn}
          />
        </View>
      </Card>

      {/* Linked Specialists / Agents */}
      {coworker.agentLinks && coworker.agentLinks.length > 0 ? (
        <>
          <SectionHeader title={`Specialist Agents (${coworker.agentLinks.length})`} />
          <Card>
            {coworker.agentLinks.map((link, idx) => (
              <View key={link.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon="sparkles"
                  title={link.agent?.id ? `Agent (${link.agent.id})` : 'Specialist Agent'}
                  subtitle="Specialist Agent"
                  onPress={() => {
                    if (link.agent?.id) {
                      router.push({
                        pathname: '/agent/[agentId]',
                        params: { agentId: link.agent.id },
                      });
                    }
                  }}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Execution Logs */}
      <SectionHeader title={`Recent Execution Logs (${logsQuery.data?.length ?? 0})`} />
      {(logsQuery.data ?? []).length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={28} color={colors.subtle} />
          <AppText style={[styles.emptyText, { color: colors.subtle }]}>
            No runs recorded for this coworker yet. Tap Assign Task above to launch one.
          </AppText>
        </Card>
      ) : (
        <Card>
          {(logsQuery.data ?? []).slice(0, 10).map((log, idx) => (
            <View key={log.id}>
              {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
              <ListRow
                title={log.promptText || 'Coworker Execution'}
                subtitle={[
                  `Status: ${log.status}`,
                  log.tokensUsed ? `${log.tokensUsed} tokens` : null,
                  relativeTime(log.executedAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  <Badge
                    label={log.status}
                    tone={statusTone(log.status)}
                  />
                }
              />
            </View>
          ))}
        </Card>
      )}

      {/* Task Prompt Modal */}
      <Modal
        visible={promptModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPromptModalOpen(false)}
      >
        <Screen edges={['top', 'bottom']} scroll>
          <View style={styles.modalHeader}>
            <AppText style={[styles.modalTitle, { color: colors.foreground }]}>
              Assign Task to {coworker.name}
            </AppText>
            <IconButton
              icon="close"
              label="Close"
              onPress={() => setPromptModalOpen(false)}
            />
          </View>

          <View style={styles.formWrap}>
            <TextField
              label="Prompt / Task Description"
              placeholder="e.g. Audit all unread PRs, summarize open incidents, or review release readiness…"
              value={taskPrompt}
              onChangeText={setTaskPrompt}
              multiline
              numberOfLines={6}
              autoFocus
            />

            <Button
              label={executeMutation.isPending ? 'Launching Task…' : 'Run Coworker'}
              disabled={!taskPrompt.trim() || executeMutation.isPending}
              onPress={() => executeMutation.mutate(taskPrompt.trim())}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  role: {
    fontSize: 14,
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formWrap: {
    paddingHorizontal: spacing.md,
  },
});
