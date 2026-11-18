import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQueueStatus } from '../lib/offline-queue';
import { pendingLabel } from '../lib/offline-queue-core';
import { useTheme } from '../theme/theme';

/**
 * A slim notice while the device is offline (cached data stays readable), and
 * while changes made offline are waiting for, or being sent to, the server.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const { pending, syncing } = useOfflineQueueStatus();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false);
      }),
    [],
  );

  let message: string | null = null;
  if (offline) {
    message =
      pending > 0
        ? `You're offline — ${pendingLabel(pending)} will sync later`
        : "You're offline — showing saved data";
  } else if (pending > 0) {
    message = syncing
      ? `Syncing ${pendingLabel(pending)}…`
      : `${pendingLabel(pending)} waiting to sync`;
  }

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.banner,
        { top: insets.top + 4, backgroundColor: colors.foreground },
      ]}
    >
      <Text style={[styles.text, { color: colors.background }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    opacity: 0.92,
  },
  text: { fontSize: 13, fontWeight: '600' },
});
