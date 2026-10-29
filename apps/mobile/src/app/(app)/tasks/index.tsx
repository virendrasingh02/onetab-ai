import Ionicons from '@expo/vector-icons/Ionicons';
import { queryKeys, workToolsApi } from '@org/api-client';
import type { Task, TaskPriority, TaskStatus } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { showActionSheet } from '../../../components/action-sheet';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  type IconName,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../components/ui';
import { relativeTime, statusTone } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const STATUS_COLUMNS: Array<{ key: TaskStatus; label: string; icon: IconName }> = [
  { key: 'TODO', label: 'To Do', icon: 'radio-button-off-outline' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: 'sync-outline' },
  { key: 'IN_REVIEW', label: 'In Review', icon: 'eye-outline' },
  { key: 'DONE', label: 'Done', icon: 'checkmark-circle-outline' },
  { key: 'BACKLOG', label: 'Backlog', icon: 'file-tray-outline' },
];

const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export default function TasksScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'urgent'>('all');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus] = useState<TaskStatus>('TODO');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');

  // Shared work-tools keys: one prefix invalidation refreshes this board,
  // the task detail screens and the Home "assigned to me" card together.
  const tasksQuery = useQuery({
    queryKey: queryKeys.workTools.tasks(workspaceId),
    queryFn: () => workToolsApi.tasks(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const invalidateTasks = () =>
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.workTools.all(workspaceId), 'tasks'],
    });

  const createTaskMutation = useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      status: TaskStatus;
      priority: TaskPriority;
    }) => workToolsApi.createTask(workspaceId, input),
    onSuccess: () => {
      haptics.success();
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('MEDIUM');
      void invalidateTasks();
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not create task', err.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      workToolsApi.updateTask(workspaceId, taskId, { status }),
    onSuccess: () => {
      haptics.light();
      void invalidateTasks();
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not move task', err.message);
    },
  });

  const filteredTasks = useMemo(() => {
    let list = tasksQuery.data ?? [];
    if (activeFilter === 'mine' && user?.id) {
      list = list.filter((t) => t.assigneeId === user.id);
    } else if (activeFilter === 'urgent') {
      list = list.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [tasksQuery.data, activeFilter, user?.id, search]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const col of STATUS_COLUMNS) map.set(col.key, []);
    for (const task of filteredTasks) {
      const colTasks = map.get(task.status);
      if (colTasks) colTasks.push(task);
      else map.set(task.status, [task]);
    }
    return map;
  }, [filteredTasks]);

  const handleStatusChangePrompt = (task: Task) => {
    haptics.selection();
    showActionSheet({
      options: STATUS_COLUMNS.filter((col) => col.key !== task.status).map((col) => ({
        label: col.label,
        icon: col.icon,
        onPress: () => {
          updateStatusMutation.mutate({ taskId: task.id, status: col.key });
        },
      })),
    });
  };

  return (
    <Screen
      scroll={viewMode === 'list'}
      refreshing={tasksQuery.isRefetching}
      onRefresh={() => void tasksQuery.refetch()}
      contentStyle={{ paddingHorizontal: 0 }}
    >
      {/* Top Bar: View Switcher & Create Button */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <View style={styles.viewModePills}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kanban Board view"
            onPress={() => {
              haptics.selection();
              setViewMode('board');
            }}
            style={[
              styles.modePill,
              viewMode === 'board' && { backgroundColor: colors.selected },
            ]}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={viewMode === 'board' ? colors.primary : colors.subtle}
            />
            <AppText
              style={[
                styles.modePillText,
                { color: viewMode === 'board' ? colors.primaryText : colors.subtle },
              ]}
            >
              Board
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="List view"
            onPress={() => {
              haptics.selection();
              setViewMode('list');
            }}
            style={[
              styles.modePill,
              viewMode === 'list' && { backgroundColor: colors.selected },
            ]}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === 'list' ? colors.primary : colors.subtle}
            />
            <AppText
              style={[
                styles.modePillText,
                { color: viewMode === 'list' ? colors.primaryText : colors.subtle },
              ]}
            >
              List
            </AppText>
          </Pressable>
        </View>

        <Button
          label="New task"
          icon="add"
          onPress={() => {
            haptics.selection();
            setCreateModalOpen(true);
          }}
          style={styles.newButton}
        />
      </View>

      {/* Filter Chips & Search Bar */}
      <View style={styles.filterSection}>
        <View style={styles.chipsRow}>
          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'all' && {
                backgroundColor: colors.selected,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveFilter('all');
            }}
          >
            <AppText
              style={[
                styles.filterChipText,
                { color: activeFilter === 'all' ? colors.primaryText : colors.subtle },
              ]}
            >
              All ({tasksQuery.data?.length ?? 0})
            </AppText>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'mine' && {
                backgroundColor: colors.selected,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveFilter('mine');
            }}
          >
            <AppText
              style={[
                styles.filterChipText,
                { color: activeFilter === 'mine' ? colors.primaryText : colors.subtle },
              ]}
            >
              Assigned to me
            </AppText>
          </Pressable>

          <Pressable
            style={[
              styles.filterChip,
              activeFilter === 'urgent' && {
                backgroundColor: colors.selected,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => {
              haptics.selection();
              setActiveFilter('urgent');
            }}
          >
            <AppText
              style={[
                styles.filterChipText,
                { color: activeFilter === 'urgent' ? colors.primaryText : colors.subtle },
              ]}
            >
              Urgent & High
            </AppText>
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <TextField
            placeholder="Search tasks…"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Main Content: Board or List */}
      {tasksQuery.error ? (
        <ErrorState
          error={tasksQuery.error}
          onRetry={() => void tasksQuery.refetch()}
        />
      ) : viewMode === 'board' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boardScroll}
        >
          {STATUS_COLUMNS.map((column) => {
            const colTasks = tasksByStatus.get(column.key) ?? [];
            return (
              <View
                key={column.key}
                style={[
                  styles.kanbanColumn,
                  { backgroundColor: colors.muted },
                ]}
              >
                <View style={styles.columnHeader}>
                  <View style={styles.columnTitleWrap}>
                    <Ionicons name={column.icon} size={16} color={colors.primary} />
                    <AppText style={[styles.columnTitle, { color: colors.foreground }]}>
                      {column.label}
                    </AppText>
                  </View>
                  <Badge label={String(colTasks.length)} tone="neutral" />
                </View>

                <FlatList
                  data={colTasks}
                  keyExtractor={(t) => t.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.columnTaskList}
                  ListEmptyComponent={
                    <View style={styles.emptyColumn}>
                      <AppText style={[styles.emptyColumnText, { color: colors.subtle }]}>
                        No tasks
                      </AppText>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [
                        styles.taskCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                      onPress={() => {
                        haptics.selection();
                        router.push({
                          pathname: '/tasks/[taskId]',
                          params: { taskId: item.id },
                        });
                      }}
                    >
                      <View style={styles.cardHeader}>
                        {item.identifier ? (
                          <AppText style={[styles.ticketId, { color: colors.subtle }]}>
                            {item.identifier}
                          </AppText>
                        ) : null}
                        <Badge
                          label={item.priority}
                          tone={
                            item.priority === 'URGENT'
                              ? 'danger'
                              : item.priority === 'HIGH'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                      </View>
                      <AppText style={[styles.taskTitle, { color: colors.foreground }]}>
                        {item.title}
                      </AppText>
                      {item.description ? (
                        <AppText
                          numberOfLines={2}
                          style={[styles.taskDescription, { color: colors.subtle }]}
                        >
                          {item.description}
                        </AppText>
                      ) : null}
                      <View style={styles.cardFooter}>
                        <Pressable
                          style={[styles.statusChangeBtn, { backgroundColor: colors.selected }]}
                          onPress={() => handleStatusChangePrompt(item)}
                        >
                          <AppText style={[styles.statusChangeText, { color: colors.primaryText }]}>
                            Move status
                          </AppText>
                          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                        </Pressable>
                        {item.dueDate ? (
                          <AppText style={[styles.dueDateText, { color: colors.subtle }]}>
                            {relativeTime(item.dueDate)}
                          </AppText>
                        ) : null}
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.listViewContainer}>
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon="checkbox-outline"
              title="No tasks found"
              description="Create a task or change your filter."
            />
          ) : (
            <Card>
              {filteredTasks.map((task, idx) => (
                <View key={task.id}>
                  {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                  <ListRow
                    title={task.title}
                    subtitle={
                      [
                        task.identifier ?? null,
                        `Status: ${task.status.replace(/_/g, ' ')}`,
                        `Priority: ${task.priority}`,
                        task.dueDate ? `Due: ${relativeTime(task.dueDate)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                    right={
                      <Badge
                        label={task.status.replace(/_/g, ' ')}
                        tone={statusTone(task.status)}
                      />
                    }
                    onPress={() => {
                      haptics.selection();
                      router.push({
                        pathname: '/tasks/[taskId]',
                        params: { taskId: task.id },
                      });
                    }}
                  />
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* Create Task Modal */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <Screen edges={['top', 'bottom']} scroll>
          <View style={styles.modalHeader}>
            <AppText style={[styles.modalTitle, { color: colors.foreground }]}>
              Create New Task
            </AppText>
            <IconButton
              icon="close"
              label="Close"
              onPress={() => setCreateModalOpen(false)}
            />
          </View>

          <View style={styles.formContainer}>
            <TextField
              label="Task Title"
              placeholder="e.g. Design mobile checkout flow"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <TextField
              label="Description (optional)"
              placeholder="Provide context, acceptance criteria or links…"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={4}
            />

            <AppText style={[styles.fieldLabel, { color: colors.subtle }]}>Priority</AppText>
            <View style={styles.prioritySelector}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.priorityPill,
                    newPriority === p && {
                      backgroundColor: colors.selected,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setNewPriority(p)}
                >
                  <AppText
                    style={[
                      styles.priorityPillText,
                      { color: newPriority === p ? colors.primaryText : colors.subtle },
                    ]}
                  >
                    {p}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <Button
              label={createTaskMutation.isPending ? 'Creating…' : 'Create Task'}
              disabled={!newTitle.trim() || createTaskMutation.isPending}
              onPress={() =>
                createTaskMutation.mutate({
                  title: newTitle.trim(),
                  description: newDesc.trim() || undefined,
                  status: newStatus,
                  priority: newPriority,
                })
              }
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  viewModePills: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#00000010',
    padding: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  newButton: {
    paddingHorizontal: spacing.md,
  },
  filterSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#00000020',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: spacing.xs,
  },
  boardScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  kanbanColumn: {
    width: 280,
    borderRadius: radius.lg,
    padding: spacing.sm,
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  columnTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  columnTaskList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  emptyColumn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyColumnText: {
    fontSize: 12,
  },
  taskCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  ticketId: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  statusChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusChangeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueDateText: {
    fontSize: 11,
  },
  listViewContainer: {
    paddingHorizontal: spacing.md,
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
  formContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  prioritySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  priorityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#00000020',
  },
  priorityPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
