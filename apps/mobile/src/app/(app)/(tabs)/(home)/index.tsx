import Ionicons from '@expo/vector-icons/Ionicons';
import {
  approvalsApi,
  intelligenceApi,
  notificationApi,
  queryKeys,
  workToolsApi,
} from '@org/api-client';
import type { Task, AIApprovalRequest, NotificationView } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
} from '../../../../components/ui';
import { relativeTime, statusTone } from '../../../../lib/format';
import { haptics } from '../../../../lib/haptics';
import { useSession } from '../../../../lib/session';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { radius, spacing } from '../../../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { workspaceId, workspace } = useWorkspace();
  const { colors } = useTheme();

  // 1. Assigned tasks query
  const tasksQuery = useQuery({
    // Under the shared work-tools tasks prefix so task edits refresh it.
    queryKey: queryKeys.workTools.tasks(workspaceId, undefined, {
      assigneeId: user?.id,
    }),
    queryFn: () =>
      workToolsApi
        .tasks(workspaceId, user?.id ? { assigneeId: user.id } : undefined)
        .catch(() => [] as Task[]),
    enabled: Boolean(workspaceId),
  });

  // 2. Pending approvals
  const approvalsQuery = useQuery({
    queryKey: queryKeys.approvals.list(workspaceId, 'PENDING'),
    queryFn: () =>
      approvalsApi.list(workspaceId, 'PENDING').catch(() => [] as AIApprovalRequest[]),
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
  });

  // 3. AI Catch-Up / Briefing
  const catchUpQuery = useQuery({
    queryKey: ['mobile', 'home-catch-up', workspaceId],
    queryFn: () => intelligenceApi.catchUp(workspaceId).catch(() => null),
    enabled: Boolean(workspaceId),
  });

  // 4. Recent notifications / unread items
  const notificationsQuery = useQuery({
    queryKey: ['mobile', 'home-notifications', workspaceId],
    queryFn: () =>
      notificationApi
        .list(workspaceId, { limit: 5 })
        .then((res) => res.items)
        .catch(() => [] as NotificationView[]),
    enabled: Boolean(workspaceId),
  });

  const isRefreshing =
    tasksQuery.isRefetching ||
    approvalsQuery.isRefetching ||
    catchUpQuery.isRefetching ||
    notificationsQuery.isRefetching;

  const onRefresh = () => {
    void Promise.all([
      tasksQuery.refetch(),
      approvalsQuery.refetch(),
      catchUpQuery.refetch(),
      notificationsQuery.refetch(),
    ]);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const pendingApprovalsCount = approvalsQuery.data?.length ?? 0;
  const assignedTasks = tasksQuery.data ?? [];
  const openTasks = assignedTasks.filter(
    (t) => t.status !== 'DONE' && t.status !== 'CANCELLED',
  );

  return (
    <Screen refreshing={isRefreshing} onRefresh={onRefresh}>
      {/* Workspace & Greeting Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <AppText style={[styles.greeting, { color: colors.subtle }]}>
            {greeting}, {user?.displayName?.split(' ')[0] ?? 'there'}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch workspace"
            onPress={() => {
              haptics.selection();
              router.push('/workspaces');
            }}
            style={styles.workspacePill}
          >
            <AppText style={[styles.workspaceName, { color: colors.foreground }]}>
              {workspace?.name ?? 'Workspace'}
            </AppText>
            <Ionicons name="chevron-down" size={16} color={colors.subtle} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/profile')}
        >
          <Avatar
            name={user?.displayName ?? 'You'}
            uri={user?.avatarUrl}
            size={44}
          />
        </Pressable>
      </View>

      {/* Pending Approvals Notice Banner */}
      {pendingApprovalsCount > 0 ? (
        <Pressable
          onPress={() => {
            haptics.medium();
            router.push('/approvals');
          }}
          style={[
            styles.bannerAlert,
            { backgroundColor: colors.selected, borderColor: colors.primary },
          ]}
        >
          <View style={styles.bannerAlertContent}>
            <Ionicons name="hand-left" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.bannerAlertTitle, { color: colors.primaryText }]}>
                {pendingApprovalsCount === 1
                  ? '1 action waiting for your approval'
                  : `${pendingApprovalsCount} actions waiting for your approval`}
              </AppText>
              <AppText style={[styles.bannerAlertDesc, { color: colors.subtle }]}>
                AI coworkers and automations require your sign-off
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
          </View>
        </Pressable>
      ) : null}

      {/* Quick Action Navigation Grid */}
      <View style={styles.quickActionsGrid}>
        <Pressable
          style={[styles.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            haptics.selection();
            router.push('/dm/new');
          }}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.selected }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
          </View>
          <AppText style={[styles.actionCardLabel, { color: colors.foreground }]}>New DM</AppText>
        </Pressable>

        <Pressable
          style={[styles.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            haptics.selection();
            router.push('/tasks');
          }}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.selected }]}>
            <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
          </View>
          <AppText style={[styles.actionCardLabel, { color: colors.foreground }]}>Tasks</AppText>
        </Pressable>

        <Pressable
          style={[styles.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            haptics.selection();
            router.push('/documents');
          }}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.selected }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          </View>
          <AppText style={[styles.actionCardLabel, { color: colors.foreground }]}>Docs</AppText>
        </Pressable>

        <Pressable
          style={[styles.quickActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            haptics.selection();
            router.push('/meetings');
          }}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.selected }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          <AppText style={[styles.actionCardLabel, { color: colors.foreground }]}>Meetings</AppText>
        </Pressable>
      </View>

      {/* AI Daily Catch-Up / Briefing */}
      {catchUpQuery.data ? (
        <View style={styles.section}>
          <SectionHeader
            title="Daily AI Catch-Up"
            action={
              <Button
                label="Activity"
                variant="ghost"
                onPress={() => router.push('/updates')}
              />
            }
          />
          <Card style={[styles.catchUpCard, { borderColor: colors.border }]}>
            <View style={styles.catchUpHeader}>
              <View style={[styles.sparkleWrap, { backgroundColor: colors.selected }]}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <AppText style={[styles.catchUpTitle, { color: colors.primaryText }]}>
                {catchUpQuery.data.greeting || 'Workspace Briefing'}
              </AppText>
            </View>
            <AppText style={[styles.catchUpBody, { color: colors.foreground }]}>
              {[
                catchUpQuery.data.unreadDMsCount
                  ? `${catchUpQuery.data.unreadDMsCount} unread DMs`
                  : null,
                catchUpQuery.data.unreadMentionsCount
                  ? `${catchUpQuery.data.unreadMentionsCount} mentions`
                  : null,
                catchUpQuery.data.tasksAssignedCount
                  ? `${catchUpQuery.data.tasksAssignedCount} tasks assigned`
                  : null,
                catchUpQuery.data.decisionsMadeCount
                  ? `${catchUpQuery.data.decisionsMadeCount} decisions made`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'You are up to date on workspace activity.'}
            </AppText>
            {catchUpQuery.data.keyUpdates && catchUpQuery.data.keyUpdates.length > 0 ? (
              <View style={styles.highlightsContainer}>
                {catchUpQuery.data.keyUpdates.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.highlightRow}>
                    <Ionicons name="ellipse" size={6} color={colors.primary} style={{ marginTop: 6 }} />
                    <AppText style={[styles.highlightText, { color: colors.subtle }]}>
                      {item.title}: {item.summary}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}

      {/* Assigned Tasks Module */}
      <View style={styles.section}>
        <SectionHeader
          title={`Your Tasks (${openTasks.length})`}
          action={
            <Button
              label="View all"
              variant="ghost"
              onPress={() => router.push('/tasks')}
            />
          }
        />
        {openTasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.primary} />
            <AppText style={[styles.emptyCardTitle, { color: colors.foreground }]}>
              All caught up!
            </AppText>
            <AppText style={[styles.emptyCardDesc, { color: colors.subtle }]}>
              You have no active tasks assigned to you.
            </AppText>
            <Button
              label="Open Tasks & Kanban"
              variant="secondary"
              onPress={() => router.push('/tasks')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : (
          <Card>
            {openTasks.slice(0, 4).map((task, idx) => (
              <View key={task.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  title={task.title}
                  subtitle={
                    [
                      task.priority ? `Priority: ${task.priority}` : null,
                      task.dueDate ? `Due ${relativeTime(task.dueDate)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No due date'
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

      {/* Recent Activity & Mentions */}
      <View style={styles.section}>
        <SectionHeader
          title="Recent Activity"
          action={
            <Button
              label="Notifications"
              variant="ghost"
              onPress={() => router.push('/notifications')}
            />
          }
        />
        {(notificationsQuery.data ?? []).length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="notifications-outline" size={28} color={colors.subtle} />
            <AppText style={[styles.emptyCardTitle, { color: colors.foreground }]}>
              No recent notifications
            </AppText>
          </Card>
        ) : (
          <Card>
            {(notificationsQuery.data ?? []).slice(0, 4).map((item, idx) => (
              <View key={item.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  title={item.title}
                  subtitle={item.body ?? relativeTime(item.createdAt)}
                  right={
                    <AppText style={[styles.timeText, { color: colors.subtle }]}>
                      {relativeTime(item.createdAt)}
                    </AppText>
                  }
                  onPress={() => {
                    haptics.selection();
                    router.push('/notifications');
                  }}
                />
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* Productivity Modules Shortcuts Bar */}
      <View style={[styles.section, { marginBottom: spacing.xl }]}>
        <SectionHeader title="Workspace Productivity" />
        <Card>
          <ListRow
            icon="time-outline"
            title="Timesheet & Attendance"
            subtitle="Punch in/out, view working hours and daily logs"
            onPress={() => {
              haptics.selection();
              router.push('/timesheet');
            }}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="people-outline"
            title="Team & AI Coworkers"
            subtitle="Browse directory, coworkers roster and installed agents"
            onPress={() => {
              haptics.selection();
              router.push('/team');
            }}
          />
          <Divider inset={rowDividerInset} />
          <ListRow
            icon="pie-chart-outline"
            title="Workspace Analytics"
            subtitle="AI usage, workflow runs and health metrics"
            onPress={() => {
              haptics.selection();
              router.push('/analytics');
            }}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  workspaceName: {
    fontSize: 22,
    fontWeight: '700',
  },
  bannerAlert: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bannerAlertDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.md,
  },
  catchUpCard: {
    padding: spacing.md,
    borderWidth: 1,
  },
  catchUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sparkleWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catchUpTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  catchUpBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  highlightsContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  highlightText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptyCardDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
  },
});
