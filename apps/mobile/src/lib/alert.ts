import { Alert as NativeAlert, Platform } from 'react-native';
import { runWebAlert, type BrowserDialogs } from './web-alert';

/**
 * Drop-in for React Native's `Alert`: the native dialog on iOS/Android, the
 * browser's dialogs on web (where react-native-web's `Alert.alert` does
 * nothing). Import this instead of `Alert` from `react-native`.
 */
export const Alert: Pick<typeof NativeAlert, 'alert'> = {
  alert(title, message, buttons, options) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons, options);
      return;
    }
    // The app compiles without the DOM lib; on web `globalThis` is `window`.
    runWebAlert(
      globalThis as unknown as BrowserDialogs,
      title,
      message,
      buttons?.map(({ text, style, onPress }) => ({
        text,
        style,
        onPress: onPress ? () => (onPress as () => unknown)() : undefined,
      })),
    );
  },
};
