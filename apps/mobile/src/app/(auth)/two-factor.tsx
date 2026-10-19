import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AppText, Button, Card, Screen, TextField } from '../../components/ui';
import { useSession } from '../../lib/session';

export default function TwoFactorScreen() {
  const { challengeToken } = useLocalSearchParams<{
    challengeToken?: string;
  }>();
  const { completeTwoFactor } = useSession();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!challengeToken) {
      router.replace('/sign-in');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeTwoFactor(challengeToken, code.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppText variant="muted">
        Enter the 6-digit code from your authenticator app, or one of your
        recovery codes.
      </AppText>
      <Card>
        <TextField
          label="Authentication code"
          value={code}
          onChangeText={setCode}
          autoFocus
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          keyboardType="default"
          autoCapitalize="none"
          maxLength={32}
          onSubmitEditing={() => void submit()}
          error={error}
        />
        <Button
          label="Verify"
          onPress={() => void submit()}
          loading={submitting}
          disabled={code.trim().length < 6}
        />
      </Card>
    </Screen>
  );
}
