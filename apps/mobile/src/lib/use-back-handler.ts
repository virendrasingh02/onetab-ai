import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Hook to handle the Android hardware back button cleanly.
 * Returns true from handler to indicate that the event was handled and
 * should not bubble up (e.g. closing a sheet or dismissing an image preview).
 * Automatically no-ops on iOS and Web.
 */
export function useAndroidBackHandler(
  handler: () => boolean,
  deps: unknown[] = [],
  enabled = true,
): void {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handler,
    );
    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}
