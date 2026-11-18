import { Platform, Share } from 'react-native';
import { Alert } from './alert';
import { haptics } from './haptics';

export interface CopyOptions {
  /** Short label for the copied content (e.g., 'Message', 'Code', 'API Key'). Defaults to 'Content'. */
  label?: string;
  /** Whether to show a light confirmation alert or feedback toast. Defaults to true. */
  notify?: boolean;
}

/**
 * Copies text across platforms with haptic feedback.
 * Uses the Web Clipboard API on web; on devices it opens the native share
 * sheet (which includes the system "Copy" action).
 */
export async function copyToClipboard(
  text: string,
  options: CopyOptions = {},
): Promise<boolean> {
  const { label = 'Content', notify = true } = options;
  if (!text) return false;

  try {
    const nav = (
      globalThis as {
        navigator?: { clipboard?: { writeText(text: string): Promise<void> } };
      }
    ).navigator;
    if (Platform.OS === 'web' && nav?.clipboard) {
      await nav.clipboard.writeText(text);
      haptics.success();
      if (notify) {
        Alert.alert('Copied to clipboard', `${label} copied to clipboard.`);
      }
      return true;
    }

    // Native has no clipboard module installed (no expo-clipboard), so hand
    // the text to the OS share sheet — it offers "Copy" alongside apps.
    const result = await Share.share({ message: text });
    if (result.action === Share.dismissedAction) return false;
    haptics.success();
    return true;
  } catch {
    haptics.warning();
    return false;
  }
}
