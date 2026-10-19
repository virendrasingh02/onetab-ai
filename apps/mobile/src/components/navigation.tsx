import { notificationApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useWorkspace } from '../lib/workspace';
import { useTheme } from '../theme/theme';
import { IconButton } from './ui';

type StackScreenOptions = NonNullable<
  ComponentProps<typeof Stack>['screenOptions']
>;

/**
 * Stack defaults shared by every navigator so pushes feel like the platform:
 * full-width swipe-back on iOS, the Material slide on Android, and headers
 * that sit flush with the content.
 */
export function useStackScreenOptions(): Exclude<
  StackScreenOptions,
  (...args: never[]) => unknown
> {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.foreground,
    headerTitleStyle: { color: colors.foreground },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.background },
    fullScreenGestureEnabled: true,
    animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
  };
}

/** Bell in the header of every tab, filled while there is something unread. */
export function NotificationsBell() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const unread = useQuery({
    queryKey: queryKeys.notifications.unreadCount(workspaceId),
    queryFn: () => notificationApi.unreadCount(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });
  const count = unread.data?.count ?? 0;
  return (
    <IconButton
      icon={count ? 'notifications' : 'notifications-outline'}
      label={count ? `Notifications, ${count} unread` : 'Notifications'}
      onPress={() => router.push('/notifications')}
    />
  );
}

/**
 * The native stack each bottom tab owns. iOS gets the collapsing large title
 * (Settings / Mail style); the header background blends into the screen until
 * content scrolls under it.
 */
export function TabStack({
  title,
  largeTitle = true,
}: {
  title: string;
  largeTitle?: boolean;
}) {
  const { colors } = useTheme();
  const base = useStackScreenOptions();
  const large = largeTitle && Platform.OS === 'ios';
  return (
    <Stack
      screenOptions={{
        ...base,
        headerRight: () => <NotificationsBell />,
        headerLargeTitle: large,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: colors.background },
        headerLargeTitleStyle: { color: colors.foreground },
        headerStyle: {
          backgroundColor: large ? colors.background : colors.card,
        },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}

/**
 * Props for a `KeyboardAvoidingView` that wraps a whole screen under a stack
 * header. Uses the measured header height (not a guessed constant, which is
 * wrong with large titles / Dynamic Type / iPad), and `padding` on Android
 * too: Expo apps draw edge-to-edge there, so the window no longer resizes for
 * the keyboard by itself.
 */
export function useKeyboardAvoidingProps(): {
  behavior: 'padding' | undefined;
  keyboardVerticalOffset: number;
} {
  const headerHeight = useHeaderHeight();
  return {
    behavior: Platform.OS === 'web' ? undefined : 'padding',
    keyboardVerticalOffset: headerHeight,
  };
}

/**
 * Options for a screen presented as a modal: an iOS page sheet with a
 * "Cancel" button (iOS sheets have no back chevron; swipe-down also closes),
 * and Android's normal back arrow.
 */
export function useModalScreenOptions(): (title: string) => {
  title: string;
  presentation: 'modal';
  headerLeft?: () => ReactNode;
} {
  const router = useRouter();
  const { colors } = useTheme();
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (title) => ({
    title,
    presentation: 'modal',
    headerLeft:
      Platform.OS === 'ios'
        ? () => (
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={{ color: colors.primaryText, fontSize: 17 }}>
                Cancel
              </Text>
            </Pressable>
          )
        : undefined,
  });
}
