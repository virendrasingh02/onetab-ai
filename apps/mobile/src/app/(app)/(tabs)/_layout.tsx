import Ionicons from '@expo/vector-icons/Ionicons';
import { notificationApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, useRouter } from 'expo-router';
import type { ColorValue } from 'react-native';
import { IconButton, type IconName } from '../../../components/ui';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );

export default function TabsLayout() {
  const { colors } = useTheme();
  const { workspace, workspaceId } = useWorkspace();
  const router = useRouter();

  const unread = useQuery({
    queryKey: queryKeys.notifications.unreadCount(workspaceId),
    queryFn: () => notificationApi.unreadCount(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });

  const bell = () => (
    <IconButton
      icon={unread.data?.count ? 'notifications' : 'notifications-outline'}
      label={
        unread.data?.count
          ? `Notifications, ${unread.data.count} unread`
          : 'Notifications'
      }
      onPress={() => router.push('/notifications')}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerRight: bell,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: workspace?.name ?? 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: tabIcon('chatbubbles-outline') }}
      />
      <Tabs.Screen
        name="agents"
        options={{ title: 'Agents', tabBarIcon: tabIcon('sparkles-outline') }}
      />
      <Tabs.Screen
        name="automations"
        options={{
          title: 'Automations',
          tabBarIcon: tabIcon('git-network-outline'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('grid-outline') }}
      />
    </Tabs>
  );
}
