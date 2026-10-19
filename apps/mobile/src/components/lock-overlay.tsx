import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../lib/session';
import { useTheme } from '../theme/theme';
import { AppText, Button } from './ui';

/**
 * Covers the app until the owner passes the biometric check. It sits above the
 * navigator rather than replacing it, so unlocking returns to the exact screen.
 */
export function LockOverlay() {
  const { unlock, signOut, user } = useSession();
  const { colors } = useTheme();

  // Prompt once when the overlay appears; afterwards only on an explicit tap.
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void unlock();
  }, [unlock]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.inner}>
        <AppText variant="title">Onetab AI is locked</AppText>
        <AppText variant="muted">{user?.email ?? ''}</AppText>
        <Button
          label="Unlock"
          icon="finger-print-outline"
          onPress={() => void unlock()}
        />
        <Button
          label="Sign out"
          variant="ghost"
          onPress={() => void signOut()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  inner: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    gap: 12,
    alignItems: 'stretch',
  },
});
