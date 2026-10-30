import Ionicons from '@expo/vector-icons/Ionicons';
import {
  authApi,
  invitationApi,
  memberApi,
  queryKeys,
} from '@org/api-client';
import type { Invitation, WorkspaceMember } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
  TextField,
} from '../../../components/ui';
import { humanize, relativeTime } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const ROLES = ['ADMIN', 'MEMBER', 'GUEST'] as const;

export default function WorkspaceAdminScreen() {
  const queryClient = useQueryClient();
  const { workspaceId, workspace } = useWorkspace();
  const { user } = useSession();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'security'>('members');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER' | 'GUEST'>('MEMBER');

  // 1. Members
  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId),
    queryFn: () => memberApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  // 2. Invitations
  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations.list(workspaceId),
    queryFn: () => invitationApi.list(workspaceId).catch(() => [] as Invitation[]),
    enabled: Boolean(workspaceId && activeTab === 'invitations'),
  });

  // 3. Active Sessions
  const sessionsQuery = useQuery({
    queryKey: ['mobile', 'admin-sessions'],
    queryFn: () => authApi.getSessions().catch(() => []),
    enabled: Boolean(activeTab === 'security'),
  });

  const invalidateMembers = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.members.list(workspaceId),
    });
  };

  const invalidateInvites = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.invitations.list(workspaceId),
    });
  };

  // Change Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: any }) =>
      memberApi.updateRole(workspaceId, memberId, role),
    onSuccess: () => {
      haptics.success();
      invalidateMembers();
      Alert.alert('Role Updated', 'Member permissions updated.');
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Update Failed', err.message);
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => memberApi.remove(workspaceId, memberId),
    onSuccess: () => {
      haptics.success();
      invalidateMembers();
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Remove Failed', err.message);
    },
  });

  // Send Invite Mutation
  const sendInviteMutation = useMutation({
    mutationFn: () =>
      invitationApi.create(workspaceId, {
        emails: [inviteEmail.trim()],
        role: inviteRole,
      }),
    onSuccess: () => {
      haptics.success();
      setInviteModalOpen(false);
      setInviteEmail('');
      invalidateInvites();
      Alert.alert('Invitation Sent', 'An invitation has been dispatched.');
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Invite Failed', err.message);
    },
  });

  // Revoke Invite
  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => invitationApi.revoke(workspaceId, inviteId),
    onSuccess: () => {
      haptics.success();
      invalidateInvites();
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Revoke Failed', err.message);
    },
  });

  const handleRoleChangePrompt = (member: WorkspaceMember) => {
    if (member.user.id === user?.id) {
      Alert.alert('Cannot Change Role', 'You cannot change your own role.');
      return;
    }

    Alert.alert(
      `Change Role for ${member.user.displayName || member.user.name}`,
      'Select the new workspace role:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Admin',
          onPress: () => updateRoleMutation.mutate({ memberId: member.id, role: 'ADMIN' }),
        },
        {
          text: 'Member',
          onPress: () => updateRoleMutation.mutate({ memberId: member.id, role: 'MEMBER' }),
        },
        {
          text: 'Viewer',
          onPress: () => updateRoleMutation.mutate({ memberId: member.id, role: 'VIEWER' }),
        },
      ],
    );
  };

  const handleRemovePrompt = (member: WorkspaceMember) => {
    Alert.alert(
      `Remove ${member.user.displayName || member.user.name}?`,
      'They will immediately lose access to all channels, tasks, and files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Member',
          style: 'destructive',
          onPress: () => removeMemberMutation.mutate(member.id),
        },
      ],
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Workspace Administration' }} />

      {/* Workspace Summary Card */}
      <View style={styles.topCardContainer}>
        <Card>
          <View style={styles.wsSummaryRow}>
            <View style={[styles.wsAvatar, { backgroundColor: colors.selected }]}>
              <Ionicons name="business-outline" size={24} color={colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{workspace?.name || 'Workspace'}</AppText>
              <AppText variant="caption" style={{ color: colors.subtle }}>
                slug: {workspace?.slug} · {membersQuery.data?.length ?? 0} members
              </AppText>
            </View>
            <Badge label="Active" tone="success" />
          </View>
        </Card>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => {
            haptics.selection();
            setActiveTab('members');
          }}
          style={[
            styles.tabItem,
            activeTab === 'members' && [styles.activeTab, { borderColor: colors.primaryText }],
          ]}
        >
          <AppText
            variant="caption"
            style={{
              fontWeight: activeTab === 'members' ? '700' : '500',
              color: activeTab === 'members' ? colors.primaryText : colors.subtle,
            }}
          >
            Members ({membersQuery.data?.length ?? 0})
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.selection();
            setActiveTab('invitations');
          }}
          style={[
            styles.tabItem,
            activeTab === 'invitations' && [styles.activeTab, { borderColor: colors.primaryText }],
          ]}
        >
          <AppText
            variant="caption"
            style={{
              fontWeight: activeTab === 'invitations' ? '700' : '500',
              color: activeTab === 'invitations' ? colors.primaryText : colors.subtle,
            }}
          >
            Invitations ({invitationsQuery.data?.length ?? 0})
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.selection();
            setActiveTab('security');
          }}
          style={[
            styles.tabItem,
            activeTab === 'security' && [styles.activeTab, { borderColor: colors.primaryText }],
          ]}
        >
          <AppText
            variant="caption"
            style={{
              fontWeight: activeTab === 'security' ? '700' : '500',
              color: activeTab === 'security' ? colors.primaryText : colors.subtle,
            }}
          >
            Security & Sessions
          </AppText>
        </Pressable>
      </View>

      {/* Tab 1: Members */}
      {activeTab === 'members' ? (
        <FlatList
          data={membersQuery.data ?? []}
          keyExtractor={(m) => m.id}
          ItemSeparatorComponent={() => <Divider inset={rowDividerInset} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRow
              avatar={{ name: item.user.name, uri: item.user.avatarUrl }}
              title={item.user.displayName || item.user.name}
              subtitle={[item.user.jobTitle, item.email].filter(Boolean).join(' · ')}
              right={
                <View style={styles.memberRight}>
                  <Pressable onPress={() => handleRoleChangePrompt(item)}>
                    <Badge label={humanize(item.role)} tone="neutral" />
                  </Pressable>
                  {item.user.id !== user?.id ? (
                    <IconButton
                      icon="trash-outline"
                      label="Remove member"
                      onPress={() => handleRemovePrompt(item)}
                    />
                  ) : null}
                </View>
              }
            />
          )}
        />
      ) : null}

      {/* Tab 2: Invitations */}
      {activeTab === 'invitations' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.inviteActionBar}>
            <Button
              label="Invite New Member"
              icon="mail-outline"
              onPress={() => setInviteModalOpen(true)}
              style={{ flex: 1 }}
            />
          </View>
          {(invitationsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="mail-outline"
              title="No pending invitations"
              description="Invite colleagues to collaborate in this workspace."
              action={
                <Button
                  label="Send Invitation"
                  icon="add"
                  onPress={() => setInviteModalOpen(true)}
                />
              }
            />
          ) : (
            <FlatList
              data={invitationsQuery.data}
              keyExtractor={(inv) => inv.id}
              ItemSeparatorComponent={() => <Divider inset={rowDividerInset} />}
              renderItem={({ item }) => (
                <ListRow
                  icon="mail-outline"
                  title={item.email || 'Invitation'}
                  subtitle={`Role: ${humanize(item.role)} · Status: ${item.status}`}
                  right={
                    <IconButton
                      icon="close-circle-outline"
                      label="Revoke invite"
                      onPress={() => revokeInviteMutation.mutate(item.id)}
                    />
                  }
                />
              )}
            />
          )}
        </View>
      ) : null}

      {/* Tab 3: Security & Sessions */}
      {activeTab === 'security' ? (
        <ScrollView contentContainerStyle={styles.securityContainer}>
          <Card>
            <AppText variant="heading">Workspace Security</AppText>
            <View style={styles.securityRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  Two-Factor Authentication (2FA)
                </AppText>
                <AppText variant="caption" style={{ color: colors.subtle }}>
                  Enforce TOTP authenticator app for all workspace members.
                </AppText>
              </View>
              <Badge label="Configured" tone="success" />
            </View>
            <Divider />
            <View style={styles.securityRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  Single Sign-On (SSO / SAML)
                </AppText>
                <AppText variant="caption" style={{ color: colors.subtle }}>
                  Enterprise identity provider connection.
                </AppText>
              </View>
              <Badge label="Enterprise" tone="neutral" />
            </View>
          </Card>

          <SectionHeader title="Active Sessions" />
          <Card>
            {(sessionsQuery.data ?? []).map((session: any, idx: number) => (
              <View key={session.id || idx}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon="phone-portrait-outline"
                  title={session.device || session.userAgent || 'Current Session'}
                  subtitle={`IP: ${session.ip || 'Unknown'} · Last active: ${relativeTime(session.lastActiveAt || new Date().toISOString())}`}
                  right={
                    session.isCurrent ? (
                      <Badge label="This device" tone="success" />
                    ) : null
                  }
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      ) : null}

      {/* Invite Member Modal */}
      <Modal
        visible={inviteModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setInviteModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Invite Colleague</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setInviteModalOpen(false)}
              />
            </View>
            <View style={styles.sheetContent}>
              <TextField
                label="Email Address"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AppText variant="label">Select Role</AppText>
              <View style={styles.rolePickerRow}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor:
                          inviteRole === r ? colors.selected : colors.background,
                        borderColor: inviteRole === r ? colors.ring : colors.border,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{
                        color: inviteRole === r ? colors.primaryText : colors.foreground,
                        fontWeight: inviteRole === r ? '600' : '400',
                      }}
                    >
                      {r}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <Button
                label={sendInviteMutation.isPending ? 'Sending…' : 'Send Invitation'}
                icon="paper-plane-outline"
                disabled={!inviteEmail.trim() || sendInviteMutation.isPending}
                onPress={() => sendInviteMutation.mutate()}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topCardContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  wsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wsAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inviteActionBar: {
    padding: spacing.md,
  },
  securityContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rolePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
