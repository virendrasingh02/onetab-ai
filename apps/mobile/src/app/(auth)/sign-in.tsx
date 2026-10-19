import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { AppText, Button, Card, Screen, TextField } from '../../components/ui';
import { appConfig } from '../../lib/config';
import { useSession } from '../../lib/session';
import { spacing } from '../../theme/tokens';

const logo = require('../../../assets/splash-icon.png');

export default function SignInScreen() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { challenge } = await signIn(email.trim(), password);
      if (challenge) {
        router.push({
          pathname: '/two-factor',
          params: { challengeToken: challenge.challengeToken },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.brand}>
          <Image
            source={logo}
            style={styles.logo}
            accessibilityLabel="Onetab AI"
          />
          <AppText variant="title">Welcome back</AppText>
          <AppText variant="muted">
            Sign in to your Onetab AI workspace.
          </AppText>
        </View>
        <Card>
          <TextField
            label="Email or username"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            error={error}
          />
          <Button
            label="Sign in"
            onPress={() => void submit()}
            loading={submitting}
          />
          <Button
            label="Forgot password?"
            variant="ghost"
            onPress={() => router.push('/forgot-password')}
          />
        </Card>
        <AppText variant="caption" style={styles.center}>
          New to Onetab AI? Create an account on the web, then sign in here.
        </AppText>
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() =>
            void WebBrowser.openBrowserAsync(`${appConfig.webUrl}/register`)
          }
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { justifyContent: 'center', gap: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 72, height: 72 },
  center: { textAlign: 'center' },
});
