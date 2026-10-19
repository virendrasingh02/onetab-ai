import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionSheetHost } from '../components/action-sheet';
import { LockOverlay } from '../components/lock-overlay';
import { OfflineBanner } from '../components/offline-banner';
import { Button, EmptyState, Screen } from '../components/ui';
import { appConfig } from '../lib/config';
import { queryClient } from '../lib/query';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../theme/theme';

if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, locked, retry, signOut } = useSession();
  const { colors, dark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' && status !== 'loading')
      void SplashScreen.hideAsync();
  }, [status]);

  // The native root view shows through during transitions, keyboard resizes
  // and sheet presentation; keep it the app background so dark mode never
  // flashes white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  if (status === 'loading') return null;

  if (status === 'unreachable') {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Can't reach Onetab AI"
          description={`Check your connection. The app is trying ${appConfig.apiUrl}.`}
          action={
            <>
              <Button label="Try again" onPress={retry} />
              <Button
                label="Sign out"
                variant="ghost"
                onPress={() => void signOut()}
              />
            </>
          }
        />
      </Screen>
    );
  }

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Each group's layout redirects when the session does not fit it. */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <OfflineBanner />
      <ActionSheetHost />
      {locked ? <LockOverlay /> : null}
    </>
  );
}
