import { agentsApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Divider,
  rowDividerInset,
  EmptyState,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
} from '../../../../components/ui';
import { humanize, relativeTime } from '../../../../lib/format';
import { useWorkspace } from '../../../../lib/workspace';
import { spacing } from '../../../../theme/tokens';

export default function AgentsTab() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const agents = useQuery({
    queryKey: queryKeys.agents.list(workspaceId),
    queryFn: () => agentsApi.list(workspaceId),
  });

  return (
    <Screen
      refreshing={agents.isRefetching}
      onRefresh={() => void agents.refetch()}
    >
      <View style={styles.actions}>
        <Button
          label="New agent"
          icon="add"
          onPress={() => router.push('/agent/new')}
          style={styles.action}
        />
        <Button
          label="Runs"
          icon="pulse-outline"
          variant="secondary"
          onPress={() => router.push('/executions')}
          style={styles.action}
        />
        <Button
          label="Approvals"
          icon="hand-left-outline"
          variant="secondary"
          onPress={() => router.push('/approvals')}
          style={styles.action}
        />
      </View>

      <SectionHeader title="Agents" />
      <QueryBoundary query={agents} loadingLabel="Loading agents…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon="sparkles-outline"
              title="No agents yet"
              description="Create one here, or design multi-step agents in AI Agent Studio on the web."
            />
          ) : (
            <Card style={styles.listCard}>
              {list.map((agent, index) => (
                <View key={agent.id}>
                  {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                  <ListRow
                    avatar={{ name: agent.name, uri: agent.avatarUrl }}
                    title={agent.name}
                    subtitle={[
                      agent.role,
                      `${agent._count.logs} runs`,
                      agent.lastActiveAt
                        ? `active ${relativeTime(agent.lastActiveAt)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    right={
                      <Badge
                        label={
                          agent.isActive
                            ? humanize(agent.status) || 'Active'
                            : 'Paused'
                        }
                        tone={agent.isActive ? 'success' : 'warning'}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/agent/[agentId]',
                        params: { agentId: agent.id },
                      })
                    }
                  />
                </View>
              ))}
            </Card>
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1 },
  listCard: { paddingVertical: spacing.xs },
});
