import { authApi, notificationApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
  ToggleRow,
} from '../../components/ui';
import { biometricSupport, type BiometricSupport } from '../../lib/biometrics';
import { appConfig } from '../../lib/config';
import { relativeTime } from '../../lib/format';
import {
  registerForPush,
  unregisterForPush,
  type PushStatus,
} from '../../lib/push';
import { useSession } from '../../lib/session';
import { useWorkspace } from '../../lib/workspace';

export default function SettingsScreen() {
  const { biometricLock, setBiometricLock, signOut } = useSession();
  const { workspaceId, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void biometricSupport().then(setSupport);
  }, []);

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

  const devices = useQuery({
    queryKey: queryKeys.notifications.devices(),
    queryFn: () => notificationApi.devices(),
  });
  const sessions = useQuery({
    queryKey: ['mobile', 'auth-sessions'],
    queryFn: () => authApi.getSessions(),
  });

  const enablePush = async () => {
    const status = await registerForPush(true).catch(() => 'denied' as const);
    setPushStatus(status);
    void devices.refetch();
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
    setPushStatus(null);
    void devices.refetch();
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

  return (
    <Screen>
      <SectionHeader title="Security" />
      <Card>
        <ToggleRow
          label={`Unlock with ${support?.label ?? 'biometrics'}`}
          description={
            support && !support.available
              ? 'Set up Face ID, Touch ID or a fingerprint on this device first.'
              : 'Require it when opening the app after a minute away.'
          }
          value={biometricLock}
          onValueChange={(value) => void setBiometricLock(value)}
          disabled={!support?.available}
        />
      </Card>

      <SectionHeader title={`Notifications · ${workspace?.name ?? ''}`} />
      <QueryBoundary query={prefs}>
        {(p) => (
          <Card>
            <ToggleRow
              label="Push notifications"
              description="For this workspace, on all your devices."
              value={p.pushEnabled}
              onValueChange={(pushEnabled) => savePrefs.mutate({ pushEnabled })}
            />
            <Divider />
            <ToggleRow
              label="Mentions only"
              description="Only notify me when I'm mentioned."
              value={p.mentionsOnly}
              onValueChange={(mentionsOnly) =>
                savePrefs.mutate({ mentionsOnly })
              }
            />
            {p.quietHoursStart && p.quietHoursEnd ? (
              <AppText variant="caption">
                Quiet hours {p.quietHoursStart}–{p.quietHoursEnd} (change on the
                web).
              </AppText>
            ) : null}
          </Card>
        )}
      </QueryBoundary>

      <SectionHeader title="This device" />
      <Card>
        {appConfig.easProjectId ? null : (
          <AppText variant="caption">
            Push is not configured in this build (no EAS project id). See the
            mobile README.
          </AppText>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="Enable push here"
            variant="secondary"
            onPress={() => void enablePush()}
            style={{ flex: 1 }}
          />
          <Button
            label="Stop push here"
            variant="ghost"
            onPress={() => void disablePushHere()}
            style={{ flex: 1 }}
          />
        </View>
        {pushStatus ? (
          <Badge
            label={`Push: ${pushStatus}`}
            tone={pushStatus === 'registered' ? 'success' : 'warning'}
          />
        ) : null}
        <QueryBoundary query={devices}>
          {(list) => (
            <AppText variant="caption">
              {list.length} device{list.length === 1 ? '' : 's'} registered for
              push
              {list.length
                ? `: ${list.map((d) => d.deviceDisplayName ?? d.appId).join(', ')}`
                : ''}
            </AppText>
          )}
        </QueryBoundary>
      </Card>

      <SectionHeader title="Signed-in sessions" />
      <QueryBoundary query={sessions}>
        {(list) => (
          <Card style={{ paddingVertical: 4 }}>
            {list.map((s, index) => (
              <View key={s.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  icon={
                    s.deviceType === 'mobile'
                      ? 'phone-portrait-outline'
                      : s.deviceType === 'tablet'
                        ? 'tablet-portrait-outline'
                        : 'desktop-outline'
                  }
                  title={`${s.browser} on ${s.os}`}
                  subtitle={`${s.location} · ${relativeTime(s.lastActiveAt)}`}
                  right={
                    s.isCurrent ? (
                      <Badge label="This device" tone="success" />
                    ) : null
                  }
                />
              </View>
            ))}
          </Card>
        )}
      </QueryBoundary>

      <Button
        label="Sign out"
        variant="destructive"
        onPress={confirmSignOut}
        loading={signingOut}
      />
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        Onetab AI {Application.nativeApplicationVersion ?? ''} (
        {Application.nativeBuildVersion ?? 'dev'}) · {appConfig.variant}
      </AppText>
    </Screen>
  );
}
