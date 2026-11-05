import { userApi } from '@org/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import {
  AppText,
  Button,
  Card,
  QueryBoundary,
  Screen,
  SectionHeader,
  TextField,
} from '../../components/ui';
import { useSession } from '../../lib/session';
import { Alert } from '../../lib/alert';
import { spacing } from '../../theme/tokens';

const CONFIRMATION = 'DELETE';

/**
 * Deletes the account from inside the app, as both stores require. Everything
 * here states what the API actually does: see `AccountDeletionService`.
 */
export default function DeleteAccountScreen() {
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const preview = useQuery({
    queryKey: ['mobile', 'account-deletion-preview'],
    queryFn: () => userApi.deletionPreview(),
  });

  const remove = useMutation({
    mutationFn: () =>
      userApi.deleteAccount({
        confirmation: CONFIRMATION,
        password: password || undefined,
        twoFactorCode: twoFactorCode || undefined,
      }),
    onSuccess: async () => {
      await signOut();
      Alert.alert('Account deleted', 'Your account has been deleted.');
    },
  });

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This happens immediately and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => remove.mutate(),
        },
      ],
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Screen>
        <QueryBoundary query={preview} loadingLabel="Checking your account…">
          {(plan) => {
            const blocked = plan.workspacesToTransfer.length > 0;
            const ready =
              confirmation === CONFIRMATION &&
              (!plan.requiresPassword || Boolean(password)) &&
              (!plan.requiresTwoFactor || Boolean(twoFactorCode));
            return (
              <>
                <SectionHeader title="What is deleted" />
                <Card>
                  <AppText variant="body">
                    Your profile, sign-in methods, sessions, notifications,
                    preferences, private AI chats and connected app tokens are
                    deleted, and you leave every workspace.
                  </AppText>
                  {plan.workspacesToDelete.length > 0 ? (
                    <AppText variant="body">
                      These workspaces have no other members and are deleted
                      too:{' '}
                      {plan.workspacesToDelete.map((w) => w.name).join(', ')}.
                    </AppText>
                  ) : null}
                </Card>

                <SectionHeader title="What is kept" />
                <Card>
                  <AppText variant="muted">
                    Tasks, documents and comments you added to a shared
                    workspace stay there, shown as “Deleted user”. People who
                    already received your messages keep their copies. Our
                    payment provider keeps billing records as the law requires,
                    audit logs keep an anonymous ID, and backups expire on their
                    normal schedule.
                  </AppText>
                </Card>

                {blocked ? (
                  <Card>
                    <AppText variant="body">
                      You own workspaces other people use:{' '}
                      {plan.workspacesToTransfer.map((w) => w.name).join(', ')}.
                      Transfer ownership to another member first, then come back
                      here.
                    </AppText>
                  </Card>
                ) : (
                  <>
                    <SectionHeader title="Confirm it is you" />
                    <Card>
                      {plan.requiresPassword ? (
                        <TextField
                          label="Password"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          autoComplete="current-password"
                          textContentType="password"
                        />
                      ) : null}
                      {plan.requiresTwoFactor ? (
                        <TextField
                          label="Authenticator or recovery code"
                          value={twoFactorCode}
                          onChangeText={setTwoFactorCode}
                          autoCapitalize="none"
                          autoComplete="one-time-code"
                          textContentType="oneTimeCode"
                        />
                      ) : null}
                      <TextField
                        label={`Type ${CONFIRMATION} to confirm`}
                        value={confirmation}
                        onChangeText={setConfirmation}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        error={remove.error?.message}
                      />
                      <Button
                        label="Delete my account"
                        variant="destructive"
                        disabled={!ready}
                        loading={remove.isPending}
                        onPress={confirmDelete}
                      />
                    </Card>
                  </>
                )}
              </>
            );
          }}
        </QueryBoundary>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
});
