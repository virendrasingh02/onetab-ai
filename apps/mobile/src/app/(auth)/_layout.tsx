import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../lib/session';
import { useTheme } from '../../theme/theme';

export default function AuthLayout() {
  const { status } = useSession();
  const { colors } = useTheme();
  // Redirect to a concrete URL rather than relying on a navigator guard: on
  // web a guard redirect to the `(app)` group lands on a bare group path.
  if (status === 'signedIn') return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen
        name="two-factor"
        options={{ title: 'Two-factor authentication' }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{ title: 'Reset password' }}
      />
    </Stack>
  );
}
