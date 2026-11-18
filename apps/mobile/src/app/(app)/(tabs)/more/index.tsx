import Ionicons from '@expo/vector-icons/Ionicons';
import { WorkspacePermission } from '@org/types';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
} from '../../../../components/ui';
import { haptics } from '../../../../lib/haptics';
import { useSession } from '../../../../lib/session';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { radius, spacing } from '../../../../theme/tokens';

export default function MoreScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { workspace, can } = useWorkspace();
  const canManageMembers = can(WorkspacePermission.MANAGE_MEMBERS);
  const { colors } = useTheme();

  return (
    <Screen edges={['bottom']}>
      {/* Workspace Banner Card */}
      <Card style={[styles.workspaceCard, { borderColor: colors.border }]}>
        <View style={styles.workspaceHeaderRow}>
          <Avatar name={workspace?.name ?? 'Workspace'} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading" numberOfLines={1}>
              {workspace?.name ?? 'Workspace'}
            </AppText>
            <AppText variant="caption" style={{ color: colors.subtle }}>
              {workspace?.memberCount ?? 1} members ·{' '}
              {workspace?.channelCount ?? 0} channels
            </AppText>
          </View>
          <Button
            label="Switch"
            variant="secondary"
            onPress={() => {
              haptics.selection();
              router.push('/workspaces');
            }}
          />
        </View>

        <Divider />

        {/* User profile row */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open user profile"
          onPress={() => {
            haptics.selection();
            router.push('/profile');
          }}
          style={styles.profileRow}
        >
          <Avatar
            name={user?.displayName || user?.name || 'You'}
            uri={user?.avatarUrl}
            size={38}
          />
          <View style={{ flex: 1, gap: 1 }}>
            <AppText
              variant="body"
              style={{ fontWeight: '600' }}
              numberOfLines={1}
            >
              {user?.displayName || user?.name || 'User'}
            </AppText>
            <AppText
              variant="caption"
              style={{ color: colors.subtle }}
              numberOfLines={1}
            >
              {user?.email ?? ''}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
        </Pressable>
      </Card>

      {/* Search Workspace Shortcut */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search whole workspace"
        onPress={() => {
          haptics.selection();
          router.push('/search');
        }}
        style={[
          styles.searchTrigger,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.subtle} />
        <AppText variant="body" style={{ flex: 1, color: colors.subtle }}>
          Search workspace
        </AppText>
      </Pressable>

      {/* 1. Productivity Suite */}
      <SectionHeader title="Productivity" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="document-text-outline"
          title="Docs & Notes"
          subtitle="Documents, notes and wikis"
          onPress={() => {
            haptics.selection();
            router.push('/documents');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="calendar-outline"
          title="Meetings & Reminders"
          subtitle="Calls, RSVPs and reminders"
          onPress={() => {
            haptics.selection();
            router.push('/meetings');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="time-outline"
          title="Timesheet & Attendance"
          subtitle="Punch in, hours and attendance"
          onPress={() => {
            haptics.selection();
            router.push('/timesheet');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="folder-outline"
          title="Storage & Files"
          subtitle="Shared files and media"
          onPress={() => {
            haptics.selection();
            router.push('/files');
          }}
        />
      </Card>

      {/* 2. AI Workspace & Tools */}
      <SectionHeader title="AI Workspace" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="sparkles-outline"
          title="AI Assistant"
          subtitle="Ask, search and analyse images"
          onPress={() => {
            haptics.selection();
            router.push('/ai/chat');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="people-outline"
          title="Coworkers & Agents"
          subtitle="Your AI teammates"
          onPress={() => {
            haptics.selection();
            router.push('/agents');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="create-outline"
          title="AI Writer"
          subtitle="Draft emails and summaries"
          onPress={() => {
            haptics.selection();
            router.push('/ai/writer');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="image-outline"
          title="AI Image Studio"
          subtitle="Generate images"
          onPress={() => {
            haptics.selection();
            router.push('/ai/images');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="git-network-outline"
          title="Agent Studio"
          subtitle="Build automations"
          onPress={() => {
            haptics.selection();
            router.push('/automation/studio');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="library-outline"
          title="Knowledge Base"
          subtitle="Collections your AI can search"
          onPress={() => {
            haptics.selection();
            router.push('/knowledge');
          }}
        />
      </Card>

      {/* 3. Workspace Administration */}
      <SectionHeader title="Workspace" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {canManageMembers ? (
          <>
            <ListRow
              icon="shield-outline"
              title="Admin & Roles"
              subtitle="Members, roles and invites"
              onPress={() => {
                haptics.selection();
                router.push('/admin');
              }}
            />
            <Divider inset={rowDividerInset} />
          </>
        ) : null}
        <ListRow
          icon="extension-puzzle-outline"
          title="Connectors & Integrations"
          subtitle="Connected apps and sync"
          onPress={() => {
            haptics.selection();
            router.push('/integrations');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="bar-chart-outline"
          title="Analytics & Usage"
          subtitle="AI usage and workflow health"
          onPress={() => {
            haptics.selection();
            router.push('/analytics');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="person-add-outline"
          title="Team Directory"
          subtitle="People and AI coworkers"
          onPress={() => {
            haptics.selection();
            router.push('/team');
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="card-outline"
          title="Plan & Billing"
          subtitle="Plan, limits and usage"
          onPress={() => {
            haptics.selection();
            router.push('/billing');
          }}
        />
      </Card>

      {/* 4. App Preferences & Security */}
      <SectionHeader title="Account" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="settings-outline"
          title="Settings"
          subtitle="Notifications, privacy, sign out"
          onPress={() => {
            haptics.selection();
            router.push('/account');
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  workspaceCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  workspaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
