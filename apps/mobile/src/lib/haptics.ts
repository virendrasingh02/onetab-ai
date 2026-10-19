import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin, fire-and-forget wrapper over `expo-haptics` so every control can give
 * the same platform feedback. No-ops on web, and never throws (devices
 * without a Taptic Engine / vibrator just ignore it).
 */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>): void {
  if (!supported) return;
  effect().catch(() => undefined);
}

export const haptics = {
  /** Toggles, segment changes, picker ticks. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Primary button presses, sending a message, pull-to-refresh trigger. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Long-press menus. */
  medium: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  error: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
