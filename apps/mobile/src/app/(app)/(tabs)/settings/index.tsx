import { notificationApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../../../lib/alert';
import {
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
  ToggleRow,
} from '../../../../components/ui';
import { biometricSupport, type BiometricSupport } from '../../../../lib/biometrics';
import { appConfig } from '../../../../lib/config';
import {
  registerForPush,
  unregisterForPush,
} from '../../../../lib/push';
import { useSession } from '../../../../lib/session';
import { useWorkspace } from '../../../../lib/workspace';
import { spacing } from '../../../../theme/tokens';

export default function SettingsTab() {
  const { user, biometricLock, setBiometricLock, signOut } = useSession();
  const { workspaceId, workspace, workspaces } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void biometricSupport().then(setSupport);
  }, []);

  // Notification preferences
  const prefs = useQuery({
    queryKey: queryKeys.notifications.preferences(workspaceId),
    queryFn: () => notificationApi.preferences(workspaceId),
  });

  const savePrefs = useMutation({
    mutationFn: (input: { pushEnabled?: boolean; mentionsOnly?: boolean }) =>
      notificationApi.updatePreferences(workspaceId, input),
    onSuccess: (saved) =>
      queryClient.setQueryData(
        queryKeys.notifications.preferences(workspaceId),
        saved,
      ),
    onError: (error) => Alert.alert('Could not save', error.message),
  });

  const enablePush = async () => {
    const status = await registerForPush(true).catch(() => 'denied' as const);
    if (status === 'denied') {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for Onetab AI in system settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  };

  const disablePushHere = async () => {
    await unregisterForPush();
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      'This device stops receiving notifications for your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          },
        },
      ],
    );

  const profileName = user?.displayName || user?.name || 'My Profile';

  return (
    <Screen>
      {/* WhatsApp-style Profile Hero Card */}
      <Card style={styles.profileCard}>
        <ListRow
          avatar={{
            name: profileName,
            uri: user?.avatarUrl,
          }}
          title={profileName}
          subtitle={user?.email}
          right={<Badge label="Edit" tone="info" />}
          onPress={() => router.push('/profile')}
        />
        {workspaces.length > 1 ? (
          <>
            <Divider inset={rowDividerInset} />
            <ListRow
              icon="business-outline"
              title={workspace?.name ?? 'Workspace'}
              subtitle={`Switch workspace · ${workspaces.length} available`}
              onPress={() => router.push('/workspaces')}
            />
          </>
        ) : null}
      </Card>

      {/* Account & Security */}
      <SectionHeader title="Account & Security" />
      <Card>
        <ToggleRow
          label={`Unlock with ${support?.label ?? 'biometrics'}`}
          description={
            support && !support.available
              ? 'Set up Face ID, Touch ID or a fingerprint on this device first.'
              : 'Require biometric authentication on launch.'
          }
          value={biometricLock}
          onValueChange={(val) => void setBiometricLock(val)}
          disabled={!support?.available}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="shield-checkmark-outline"
          title="Security & Sessions"
          subtitle="Manage active device sessions"
          onPress={() => router.push('/settings')}
        />
      </Card>

      {/* Chat & Notifications */}
      <SectionHeader title="Chat & Notifications" />
      <Card>
        <ToggleRow
          label="Push notifications"
          description="Alerts for messages and direct mentions"
          value={prefs.data?.pushEnabled ?? false}
          onValueChange={(pushEnabled) => {
            savePrefs.mutate({ pushEnabled });
            if (pushEnabled) void enablePush();
            else void disablePushHere();
          }}
        />
        <Divider inset={rowDividerInset} />
        <ToggleRow
          label="Mentions only"
          description="Suppress alerts for regular channel traffic"
          value={prefs.data?.mentionsOnly ?? false}
          onValueChange={(mentionsOnly) => savePrefs.mutate({ mentionsOnly })}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="folder-outline"
          title="Files & Media"
          subtitle="Shared documents, images and downloads"
          onPress={() => router.push('/files')}
        />
      </Card>

      {/* Workspace Management */}
      <SectionHeader title={`Workspace · ${workspace?.name ?? ''}`} />
      <Card>
        <ListRow
          icon="people-outline"
          title="Team & Coworkers"
          subtitle="Members, roles and autonomous AI teammates"
          onPress={() => router.push('/team')}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="extension-puzzle-outline"
          title="Integrations & Connectors"
          subtitle="GitHub, Slack, Google, Linear and tools"
          onPress={() => router.push('/integrations')}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="bar-chart-outline"
          title="Analytics & AI Usage"
          subtitle="Token usage and workflow throughput"
          onPress={() => router.push('/analytics')}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="card-outline"
          title="Plan & Billing"
          subtitle="Subscription tier, limits and invoices"
          onPress={() => router.push('/billing')}
        />
      </Card>

      {/* App & System */}
      <SectionHeader title="App Info" />
      <Card>
        <ListRow
          icon="information-circle-outline"
          title="Onetab AI Native"
          subtitle={`Version ${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '1'})`}
          chevron={false}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="globe-outline"
          title="Open Web App"
          subtitle={appConfig.webUrl}
          onPress={() => void Linking.openURL(appConfig.webUrl)}
        />
      </Card>

      <View style={styles.signOutWrap}>
        <Button
          label="Sign out"
          variant="destructive"
          loading={signingOut}
          onPress={confirmSignOut}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  signOutWrap: {
    paddingVertical: spacing.xl,
  },
});
