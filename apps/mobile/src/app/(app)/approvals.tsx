import { approvalsApi, queryKeys } from '@org/api-client';
import type { AIApprovalRequest } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  QueryBoundary,
  Screen,
  TextField,
} from '../../components/ui';
import { humanize, relativeTime, statusTone } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { spacing } from '../../theme/tokens';

/** Human-in-the-loop decisions for actions agents and workflows want to take. */
export default function ApprovalsScreen() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const pending = useQuery({
    queryKey: queryKeys.approvals.list(workspaceId, 'PENDING'),
    queryFn: () => approvalsApi.list(workspaceId, 'PENDING'),
  });

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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.all(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.aiExecutions.all(workspaceId),
      });
    },
    onError: (error) =>
      Alert.alert('Could not record the decision', error.message),
  });

  return (
    <Screen
      refreshing={pending.isRefetching}
      onRefresh={() => void pending.refetch()}
    >
      <QueryBoundary query={pending} loadingLabel="Loading approvals…">
        {(requests) =>
          requests.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="All caught up"
              description="Nothing is waiting for your approval."
            />
          ) : (
            <>
              {requests.map((request) => (
                <ApprovalCard
                  key={request.id}
                  request={request}
                  busy={decide.isPending && decide.variables?.id === request.id}
                  onDecide={(decision, comment) =>
                    decide.mutate({ id: request.id, decision, comment })
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

function ApprovalCard({
  request,
  busy,
  onDecide,
}: {
  request: AIApprovalRequest;
  busy: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED', comment?: string) => void;
}) {
  const [comment, setComment] = useState('');
  const payload = JSON.stringify(request.proposedPayload, null, 2);
  const canDecide = request.canDecide !== false;

  const confirm = (decision: 'APPROVED' | 'REJECTED') =>
    Alert.alert(
      decision === 'APPROVED' ? 'Approve this action?' : 'Reject this action?',
      decision === 'APPROVED'
        ? 'The run continues and performs the action.'
        : 'The run stops at this step.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision === 'APPROVED' ? 'Approve' : 'Reject',
          style: decision === 'APPROVED' ? 'default' : 'destructive',
          onPress: () => onDecide(decision, comment.trim() || undefined),
        },
      ],
    );

  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="label">{humanize(request.actionType)}</AppText>
        <Badge
          label={humanize(request.state)}
          tone={statusTone(request.state)}
        />
      </View>
      <AppText variant="caption">
        {humanize(request.entityType)} · requested{' '}
        {relativeTime(request.createdAt)}
        {request.requester ? ` by ${request.requester.name}` : ''}
      </AppText>
      <AppText
        variant="caption"
        selectable
        numberOfLines={12}
        style={styles.payload}
      >
        {payload}
      </AppText>
      {canDecide ? (
        <>
          <TextField
            placeholder="Comment (optional)"
            value={comment}
            onChangeText={setComment}
            accessibilityLabel="Comment"
          />
          <View style={styles.actions}>
            <Button
              label="Reject"
              variant="secondary"
              onPress={() => confirm('REJECTED')}
              disabled={busy}
              style={styles.flex}
            />
            <Button
              label="Approve"
              onPress={() => confirm('APPROVED')}
              loading={busy}
              style={styles.flex}
            />
          </View>
        </>
      ) : (
        <AppText variant="muted">Waiting on another approver.</AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payload: { fontFamily: 'Courier', paddingVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
