import { notificationApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { readAiConsent, writeAiConsent } from '../../components/ai-consent';
import { Alert } from '../../lib/alert';
import {
  Button,
  Card,
  Divider,
  ListRow,
  rowDividerInset,
  Screen,
  SectionHeader,
  ToggleRow,
} from '../../components/ui';
import { biometricSupport, type BiometricSupport } from '../../lib/biometrics';
import { appConfig } from '../../lib/config';
import { registerForPush, unregisterForPush } from '../../lib/push';
import { useSession } from '../../lib/session';
import { useWorkspace } from '../../lib/workspace';
import { spacing } from '../../theme/tokens';

export default function AccountSettingsScreen() {
  const { biometricLock, setBiometricLock, signOut } = useSession();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);

  useEffect(() => {
    void biometricSupport().then(setSupport);
    void readAiConsent().then(setAiConsent);
  }, []);

  const legalLinks = (
    [
      ['Privacy policy', appConfig.privacyUrl, 'lock-closed-outline'],
      ['Terms of service', appConfig.termsUrl, 'document-text-outline'],
      ['Help & support', appConfig.supportUrl, 'help-circle-outline'],
    ] as const
  ).flatMap(([title, url, icon]) => (url ? [{ title, url, icon }] : []));

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

  return (
    <Screen>
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
      </Card>

      <SectionHeader title="Privacy & Safety" />
      <Card>
        <ToggleRow
          label="Share data with AI services"
          description="Lets AI features send your prompts, attachments and the content you ask about to the provider running the model."
          value={aiConsent}
          onValueChange={(value) => {
            setAiConsent(value);
            void writeAiConsent(value);
          }}
        />
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="ban-outline"
          title="Blocked people"
          subtitle="See and undo who you have blocked"
          onPress={() => router.push('/blocked-users')}
        />
        {legalLinks.map((link) => (
          <View key={link.title}>
            <Divider inset={rowDividerInset} />
            <ListRow
              icon={link.icon}
              title={link.title}
              onPress={() => void WebBrowser.openBrowserAsync(link.url)}
            />
          </View>
        ))}
        <Divider inset={rowDividerInset} />
        <ListRow
          icon="trash-outline"
          title="Delete account"
          subtitle="Permanently delete your account and data"
          onPress={() => router.push('/delete-account')}
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
  signOutWrap: {
    paddingVertical: spacing.xl,
  },
});
