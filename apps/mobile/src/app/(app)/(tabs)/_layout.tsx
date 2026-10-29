import Ionicons from '@expo/vector-icons/Ionicons';
import { automationsApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { NativeTabs, type SFSymbolIcon } from 'expo-router/native-tabs';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';

type SFSymbol = Exclude<NonNullable<SFSymbolIcon['sf']>, object>;
type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The platform's own tab bar (UITabBar on iOS — Liquid Glass on iOS 26 —
 * and the Material 3 navigation bar on Android) instead of a JS imitation.
 * Re-tapping the active tab pops its stack and scrolls to the top natively.
 * Each tab owns a native stack (`<tab>/_layout.tsx`) for its header.
 */
function TabIcon({
  sf,
  sfSelected,
  ionicon,
}: {
  sf: SFSymbol;
  sfSelected: SFSymbol;
  ionicon: IoniconName;
}) {
  return (
    <NativeTabs.Trigger.Icon
      sf={{ default: sf, selected: sfSelected }}
      src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name={ionicon} />}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { workspaceId } = useWorkspace();

  // Shares the Home dashboard's cache entry; no extra request when warm.
  const overview = useQuery({
    queryKey: queryKeys.automations.overview(workspaceId),
    queryFn: () => automationsApi.overview(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 120_000,
  });
  const pendingApprovals = overview.data?.pendingApprovalsCount ?? 0;

  return (
    <NativeTabs
      tintColor={colors.primaryText}
      iconColor={{ default: colors.subtle, selected: colors.primaryText }}
      labelStyle={{
        default: { color: colors.subtle },
        selected: { color: colors.primaryText },
      }}
      backgroundColor={colors.card}
      indicatorColor={colors.selected}
      rippleColor={colors.accent}
      badgeBackgroundColor={colors.destructive}
      labelVisibilityMode="labeled"
      minimizeBehavior="onScrollDown"
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <TabIcon sf="house" sfSelected="house.fill" ionicon="home-outline" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        <TabIcon
          sf="bubble.left.and.bubble.right"
          sfSelected="bubble.left.and.bubble.right.fill"
          ionicon="chatbubbles-outline"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agents">
        <NativeTabs.Trigger.Label>Coworkers</NativeTabs.Trigger.Label>
        <TabIcon sf="sparkles" sfSelected="sparkles" ionicon="sparkles-outline" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="updates">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <TabIcon
          sf="bell"
          sfSelected="bell.fill"
          ionicon="notifications-outline"
        />
        <NativeTabs.Trigger.Badge hidden={pendingApprovals === 0}>
          {pendingApprovals > 99 ? '99+' : String(pendingApprovals)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <TabIcon
          sf="person.crop.circle"
          sfSelected="person.crop.circle.fill"
          ionicon="person-circle-outline"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
