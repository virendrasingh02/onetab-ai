import { automationsApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
} from '../../../../components/ui';
import { humanize, relativeTime } from '../../../../lib/format';
import { useWorkspace } from '../../../../lib/workspace';
import { spacing } from '../../../../theme/tokens';

export default function AutomationsTab() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const workflows = useQuery({
    queryKey: queryKeys.automations.list(workspaceId),
    queryFn: () => automationsApi.list(workspaceId),
  });

  return (
    <Screen
      refreshing={workflows.isRefetching}
      onRefresh={() => void workflows.refetch()}
    >
      <View style={styles.actions}>
        <Button
          label="New automation"
          icon="add"
          onPress={() => router.push('/automation/new')}
          style={styles.action}
        />
        <Button
          label="All runs"
          icon="pulse-outline"
          variant="secondary"
          onPress={() => router.push('/executions')}
          style={styles.action}
        />
      </View>
      <SectionHeader title="Workflows" />
      <QueryBoundary query={workflows} loadingLabel="Loading automations…">
        {(list) => {
          const visible = list.filter((w) => !w.archivedAt);
          if (visible.length === 0) {
            return (
              <EmptyState
                icon="git-network-outline"
                title="No automations yet"
                description="Create one here and design its steps in the workflow builder on the web."
              />
            );
          }
          return (
            <Card style={styles.listCard}>
              {visible.map((wf, index) => (
                <View key={wf.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    icon="git-network-outline"
                    title={wf.name}
                    subtitle={`${humanize(wf.triggerType)} trigger · ${wf._count.executions} runs · updated ${relativeTime(wf.updatedAt)}`}
                    right={
                      <Badge
                        label={wf.isActive ? 'On' : 'Off'}
                        tone={wf.isActive ? 'success' : 'neutral'}
                      />
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/automation/[workflowId]',
                        params: { workflowId: wf.id },
                      })
                    }
                  />
                </View>
              ))}
            </Card>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1 },
  listCard: { paddingVertical: spacing.xs },
});
