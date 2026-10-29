import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys, workToolsApi } from '@org/api-client';
import type { TaskStatus } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { showActionSheet } from '../../../components/action-sheet';
import { useKeyboardAvoidingProps } from '../../../components/navigation';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  Divider,
  ErrorState,
  IconButton,
  keyboardDismissMode,
  ListRow,
  LoadingState,
  rowDividerInset,
  SectionHeader,
  TextField,
} from '../../../components/ui';
import { relativeTime } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const STATUS_OPTIONS: Array<{ key: TaskStatus; label: string }> = [
  { key: 'BACKLOG', label: 'Backlog' },
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'DONE', label: 'Done' },
  { key: 'CANCELLED', label: 'Canceled' },
];

export default function TaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();

  const [newComment, setNewComment] = useState('');

  const taskQuery = useQuery({
    queryKey: queryKeys.workTools.task(workspaceId, taskId),
    queryFn: () => workToolsApi.task(workspaceId, taskId),
    enabled: Boolean(workspaceId && taskId),
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.workTools.taskComments(workspaceId, taskId),
    queryFn: () => workToolsApi.taskComments(workspaceId, taskId),
    enabled: Boolean(workspaceId && taskId),
  });

  // Prefix of every task key (board, detail, comments, Home card).
  const invalidateTasks = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.workTools.all(workspaceId), 'tasks'],
    });

  const updateStatusMutation = useMutation({
    mutationFn: (status: TaskStatus) =>
      workToolsApi.updateTask(workspaceId, taskId, { status }),
    onSuccess: () => {
      haptics.light();
      void invalidateTasks();
    },
    onError: (err) => Alert.alert('Could not update status', err.message),
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      workToolsApi.addTaskComment(workspaceId, taskId, { content }),
    onSuccess: () => {
      haptics.success();
      setNewComment('');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.taskComments(workspaceId, taskId),
      });
    },
    onError: (err) => Alert.alert('Could not post comment', err.message),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => workToolsApi.deleteTask(workspaceId, taskId),
    onSuccess: () => {
      haptics.warning();
      queryClient.removeQueries({
        queryKey: queryKeys.workTools.task(workspaceId, taskId),
      });
      void invalidateTasks();
      router.back();
    },
    onError: (err) => Alert.alert('Could not delete task', err.message),
  });

  if (taskQuery.isPending) {
    return <LoadingState label="Loading task details…" />;
  }

  if (taskQuery.error || !taskQuery.data) {
    return (
      <ErrorState
        error={taskQuery.error ?? new Error('Task not found')}
        onRetry={() => void taskQuery.refetch()}
      />
    );
  }

  const task = taskQuery.data;

  const handleChangeStatus = () => {
    haptics.selection();
    showActionSheet({
      options: STATUS_OPTIONS.map((opt) => ({
        label: opt.label,
        onPress: () => updateStatusMutation.mutate(opt.key),
      })),
    });
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      'Delete Task',
      'Are you sure you want to permanently delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTaskMutation.mutate(),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView {...keyboardAvoiding} style={styles.container}>
      <Stack.Screen
        options={{
          title: task.identifier ?? 'Task Detail',
          headerRight: () => (
            <IconButton
              icon="trash-outline"
              label="Delete task"
              onPress={confirmDelete}
            />
          ),
        }}
      />

      <ScrollView
        keyboardDismissMode={keyboardDismissMode}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title & Status Bar */}
        <Card style={styles.headerCard}>
          <View style={styles.statusRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change status"
              onPress={handleChangeStatus}
              style={[styles.statusButton, { backgroundColor: colors.selected }]}
            >
              <AppText style={[styles.statusButtonText, { color: colors.primaryText }]}>
                {task.status.replace(/_/g, ' ')}
              </AppText>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>

            <Badge
              label={task.priority}
              tone={
                task.priority === 'URGENT'
                  ? 'danger'
                  : task.priority === 'HIGH'
                    ? 'warning'
                    : 'neutral'
              }
            />
          </View>

          <AppText style={[styles.title, { color: colors.foreground }]}>
            {task.title}
          </AppText>

          {task.description ? (
            <AppText style={[styles.description, { color: colors.subtle }]}>
              {task.description}
            </AppText>
          ) : (
            <AppText style={[styles.noDescription, { color: colors.subtle }]}>
              No description provided.
            </AppText>
          )}
        </Card>

        {/* Task Properties */}
        <SectionHeader title="Details" />
        <Card>
          <ListRow
            icon="person-outline"
            title="Assignee"
            subtitle={task.assignee?.displayName ?? 'Unassigned'}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="calendar-outline"
            title="Due Date"
            subtitle={task.dueDate ? relativeTime(task.dueDate) : 'No due date'}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="time-outline"
            title="Created"
            subtitle={relativeTime(task.createdAt)}
          />
        </Card>

        {/* Comments Section */}
        <SectionHeader title={`Comments (${commentsQuery.data?.length ?? 0})`} />
        {commentsQuery.error ? (
          <ErrorState
            error={commentsQuery.error}
            onRetry={() => void commentsQuery.refetch()}
          />
        ) : (commentsQuery.data ?? []).length === 0 ? (
          <Card style={styles.emptyCommentsCard}>
            <AppText style={[styles.emptyCommentsText, { color: colors.subtle }]}>
              No comments yet. Start the discussion below.
            </AppText>
          </Card>
        ) : (
          <Card>
            {(commentsQuery.data ?? []).map((comment, idx) => (
              <View key={comment.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Avatar
                      name={comment.author?.displayName ?? 'User'}
                      uri={comment.author?.avatarUrl}
                      size={28}
                    />
                    <View style={styles.commentMeta}>
                      <AppText style={[styles.commentAuthor, { color: colors.foreground }]}>
                        {comment.author?.displayName ?? 'Team member'}
                      </AppText>
                      <AppText style={[styles.commentTime, { color: colors.subtle }]}>
                        {relativeTime(comment.createdAt)}
                      </AppText>
                    </View>
                  </View>
                  <AppText style={[styles.commentBody, { color: colors.foreground }]}>
                    {comment.content}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Add Comment Input Bar */}
      <View
        style={[
          styles.commentInputBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <TextField
          placeholder="Add a comment…"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          style={{ flex: 1 }}
        />
        <IconButton
          icon="send"
          label="Post comment"
          onPress={() => {
            if (newComment.trim()) addCommentMutation.mutate(newComment.trim());
          }}
          disabled={!newComment.trim() || addCommentMutation.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.sm,
  },
  headerCard: {
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  noDescription: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  emptyCommentsCard: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 13,
  },
  commentItem: {
    padding: spacing.md,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 11,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 36,
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
