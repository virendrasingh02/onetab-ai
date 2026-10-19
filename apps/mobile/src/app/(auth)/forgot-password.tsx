import { authApi } from '@org/api-client';
import { useState } from 'react';
import { AppText, Button, Card, Screen, TextField } from '../../components/ui';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not send the reset email.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {sent ? (
        <Card>
          <AppText variant="heading">Check your email</AppText>
          <AppText variant="muted">
            If an account exists for {email.trim()}, a reset link is on its way.
            Open it to choose a new password, then sign in here.
          </AppText>
        </Card>
      ) : (
        <Card>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={error}
          />
          <Button
            label="Send reset link"
            onPress={() => void submit()}
            loading={submitting}
            disabled={!email.includes('@')}
          />
        </Card>
      )}
    </Screen>
  );
}
