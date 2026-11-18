import Ionicons from '@expo/vector-icons/Ionicons';
import { memberApi, queryKeys, workToolsApi } from '@org/api-client';
import type { TaskPriority, TaskStatus } from '@org/types';
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
import { copyToClipboard } from '../../../lib/clipboard';
import { showActionSheet } from '../../../components/action-sheet';
import { BottomSheet } from '../../../components/mobile-ui';
import { useKeyboardAvoidingProps } from '../../../components/navigation';
import {
  AppText,
  Avatar,
  Badge,
  Button,
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
import { dueDatePresets, formatDueDate } from '../../../lib/due-date';
import {
  sendOrQueueAction,
  usePendingActions,
} from '../../../lib/offline-queue';
import { MOBILE_OFFLINE_ACTION } from '../../../lib/offline-queue-core';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

type UpdateTaskInput = Parameters<typeof workToolsApi.updateTask>[2];

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

  const pendingActions = usePendingActions(workspaceId);
  const queuedComments = pendingActions.filter(
    (a) =>
      a.kind === MOBILE_OFFLINE_ACTION.TaskCommentCreate &&
      (a.payload as { taskId?: string }).taskId === taskId,
  );
  const hasQueuedTaskChanges = pendingActions.some(
    (a) =>
      a.kind === MOBILE_OFFLINE_ACTION.TaskUpdate &&
      (a.payload as { taskId?: string }).taskId === taskId,
  );

  const updateTaskMutation = useMutation({
    mutationFn: (input: UpdateTaskInput) =>
      sendOrQueueAction({
        kind: MOBILE_OFFLINE_ACTION.TaskUpdate,
        workspaceId,
        // One queued entry per task + field set: the latest choice wins.
        dedupeKey: `task.update:${taskId}:${Object.keys(input).sort().join(',')}`,
        payload: { taskId, input },
        send: () => workToolsApi.updateTask(workspaceId, taskId, input),
      }),
    onSuccess: (outcome, input) => {
      haptics.light();
      if (outcome.status === 'queued') {
        // Show the change now; the server copy replaces it after replay.
        const { assigneeIds, ...scalar } = input;
        queryClient.setQueryData(
          queryKeys.workTools.task(workspaceId, taskId),
          (old: typeof taskQuery.data) =>
            old
              ? {
                  ...old,
                  ...scalar,
                  ...(assigneeIds ? { assigneeIds } : {}),
                }
              : old,
        );
        return;
      }
      void invalidateTasks();
    },
    onError: (err) => Alert.alert('Could not update task', err.message),
  });

  // Members load only once the assignee sheet opens.
  const [assigneeSheetOpen, setAssigneeSheetOpen] = useState(false);
  const [draftAssignees, setDraftAssignees] = useState<string[]>([]);
  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId),
    queryFn: () => memberApi.list(workspaceId),
    enabled: Boolean(workspaceId) && assigneeSheetOpen,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      sendOrQueueAction({
        kind: MOBILE_OFFLINE_ACTION.TaskCommentCreate,
        workspaceId,
        // Each comment is its own creation — never collapsed into another.
        dedupeKey: `comment:${taskId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        payload: { taskId, input: { content } },
        send: () =>
          workToolsApi.addTaskComment(workspaceId, taskId, { content }),
      }),
    onSuccess: (outcome) => {
      haptics.success();
      setNewComment('');
      if (outcome.status === 'queued') return;
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
        onPress: () => updateTaskMutation.mutate({ status: opt.key }),
      })),
    });
  };

  const handleChangePriority = () => {
    haptics.selection();
    showActionSheet({
      title: 'Priority',
      options: [
        ...PRIORITY_OPTIONS.map((opt) => ({
          label: opt.key === task.priority ? `${opt.label} ✓` : opt.label,
          onPress: () => updateTaskMutation.mutate({ priority: opt.key }),
        })),
        {
          label: 'No priority',
          onPress: () => updateTaskMutation.mutate({ priority: null }),
        },
      ],
    });
  };

  const handleChangeDueDate = () => {
    haptics.selection();
    showActionSheet({
      title: 'Due date',
      options: [
        ...dueDatePresets(new Date()).map((preset) => ({
          label: preset.label,
          onPress: () =>
            updateTaskMutation.mutate({ dueDate: preset.date.toISOString() }),
        })),
        ...(task.dueDate
          ? [
              {
                label: 'Clear due date',
                destructive: true,
                onPress: () => updateTaskMutation.mutate({ dueDate: null }),
              },
            ]
          : []),
      ],
    });
  };

  const currentAssigneeIds =
    task.assigneeIds && task.assigneeIds.length > 0
      ? task.assigneeIds
      : task.assigneeId
        ? [task.assigneeId]
        : [];
  const assigneeLabel = (() => {
    const people =
      task.assignees && task.assignees.length > 0
        ? task.assignees
        : task.assignee
          ? [task.assignee]
          : [];
    if (people.length === 0) return 'Unassigned';
    const names = people.map((p) => p.displayName || p.name);
    return names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  })();

  const openAssigneeSheet = () => {
    haptics.selection();
    setDraftAssignees(currentAssigneeIds);
    setAssigneeSheetOpen(true);
  };

  const toggleDraftAssignee = (userId: string) => {
    haptics.selection();
    setDraftAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const saveAssignees = () => {
    setAssigneeSheetOpen(false);
    const unchanged =
      draftAssignees.length === currentAssigneeIds.length &&
      draftAssignees.every((id, i) => id === currentAssigneeIds[i]);
    if (unchanged) return;
    // First entry is the primary assignee (server keeps assigneeId in sync).
    updateTaskMutation.mutate({ assigneeIds: draftAssignees });
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <IconButton
                icon="share-outline"
                label="Copy / Share task"
                onPress={() => {
                  haptics.selection();
                  const shareText = [
                    `${task.identifier ?? 'Task'}: ${task.title}`,
                    task.description,
                  ]
                    .filter(Boolean)
                    .join('\n\n');
                  void copyToClipboard(shareText, { label: 'Task details' });
                }}
              />
              <IconButton
                icon="trash-outline"
                label="Delete task"
                onPress={confirmDelete}
              />
            </View>
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
              style={[
                styles.statusButton,
                { backgroundColor: colors.selected },
              ]}
            >
              <AppText
                style={[styles.statusButtonText, { color: colors.primaryText }]}
              >
                {task.status.replace(/_/g, ' ')}
              </AppText>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Priority: ${task.priority ?? 'none'}. Change priority`}
              onPress={handleChangePriority}
              hitSlop={8}
            >
              <Badge
                label={task.priority ?? 'No priority'}
                tone={
                  task.priority === 'URGENT'
                    ? 'danger'
                    : task.priority === 'HIGH'
                      ? 'warning'
                      : 'neutral'
                }
              />
            </Pressable>
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

          {hasQueuedTaskChanges ? (
            <View style={styles.queuedRow} accessibilityLiveRegion="polite">
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={colors.subtle}
              />
              <AppText style={[styles.commentTime, { color: colors.subtle }]}>
                Changes saved on this device — they sync when you're online
              </AppText>
            </View>
          ) : null}
        </Card>

        {/* Task Properties */}
        <SectionHeader title="Details" />
        <Card>
          <ListRow
            icon="person-outline"
            title={currentAssigneeIds.length > 1 ? 'Assignees' : 'Assignee'}
            subtitle={assigneeLabel}
            onPress={openAssigneeSheet}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="calendar-outline"
            title="Due Date"
            subtitle={
              task.dueDate ? formatDueDate(task.dueDate) : 'No due date'
            }
            onPress={handleChangeDueDate}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="time-outline"
            title="Created"
            subtitle={relativeTime(task.createdAt)}
          />
        </Card>

        {/* Comments Section */}
        <SectionHeader
          title={`Comments (${commentsQuery.data?.length ?? 0})`}
        />
        {commentsQuery.error ? (
          <ErrorState
            error={commentsQuery.error}
            onRetry={() => void commentsQuery.refetch()}
          />
        ) : (commentsQuery.data ?? []).length === 0 ? (
          <Card style={styles.emptyCommentsCard}>
            <AppText
              style={[styles.emptyCommentsText, { color: colors.subtle }]}
            >
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
                      <AppText
                        style={[
                          styles.commentAuthor,
                          { color: colors.foreground },
                        ]}
                      >
                        {comment.author?.displayName ?? 'Team member'}
                      </AppText>
                      <AppText
                        style={[styles.commentTime, { color: colors.subtle }]}
                      >
                        {relativeTime(comment.createdAt)}
                      </AppText>
                    </View>
                  </View>
                  <AppText
                    style={[styles.commentBody, { color: colors.foreground }]}
                  >
                    {comment.content}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        )}

        {queuedComments.length > 0 ? (
          <>
            <SectionHeader title="Waiting to send" />
            <Card>
              {queuedComments.map((action, idx) => (
                <View key={action.id}>
                  {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                  <View style={styles.commentItem}>
                    <View style={styles.queuedRow}>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={16}
                        color={colors.subtle}
                        accessibilityLabel="Not sent yet"
                      />
                      <AppText
                        style={[styles.commentTime, { color: colors.subtle }]}
                      >
                        Sends when you're back online
                      </AppText>
                    </View>
                    <AppText
                      style={[styles.commentBody, { color: colors.foreground }]}
                    >
                      {
                        (action.payload as { input?: { content?: string } })
                          .input?.content
                      }
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
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

      <BottomSheet
        visible={assigneeSheetOpen}
        onClose={() => setAssigneeSheetOpen(false)}
        title="Assignees"
      >
        {membersQuery.isPending ? (
          <LoadingState label="Loading members…" />
        ) : membersQuery.error ? (
          <ErrorState
            error={membersQuery.error}
            onRetry={() => void membersQuery.refetch()}
          />
        ) : (
          <>
            {(membersQuery.data ?? []).map((member) => {
              const selected = draftAssignees.includes(member.user.id);
              return (
                <ListRow
                  key={member.user.id}
                  avatar={{
                    name: member.user.name,
                    uri: member.user.avatarUrl,
                  }}
                  title={member.user.displayName || member.user.name}
                  subtitle={
                    selected && draftAssignees[0] === member.user.id
                      ? 'Primary assignee'
                      : member.user.jobTitle
                  }
                  chevron={false}
                  onPress={() => toggleDraftAssignee(member.user.id)}
                  right={
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.subtle}
                      accessibilityLabel={
                        selected ? 'Selected' : 'Not selected'
                      }
                    />
                  }
                />
              );
            })}
            <View style={styles.sheetActions}>
              <Button
                label={
                  draftAssignees.length === 0
                    ? 'Save as unassigned'
                    : `Save (${draftAssignees.length})`
                }
                onPress={saveAssignees}
              />
            </View>
          </>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const PRIORITY_OPTIONS: Array<{ key: TaskPriority; label: string }> = [
  { key: 'URGENT', label: 'Urgent' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

const styles = StyleSheet.create({
  sheetActions: {
    paddingTop: spacing.md,
  },
  queuedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
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
