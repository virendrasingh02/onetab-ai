import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme/theme';
import { maxContentWidth, radius, spacing } from '../theme/tokens';
import { AppText, type IconName } from './ui';

export interface ActionSheetOption {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface Request {
  title?: string;
  options: ActionSheetOption[];
}

let present: ((request: Request | null) => void) | null = null;

/**
 * A list of choices, shown the way each platform does it: the system action
 * sheet on iOS, a Material bottom sheet on Android (and web). Use this instead
 * of `Alert.alert` for menus — Android dialogs show at most three buttons and
 * silently drop the rest.
 */
export function showActionSheet(request: Request): void {
  if (Platform.OS === 'ios') {
    const labels = request.options.map((o) => o.label);
    const destructive = request.options
      .map((o, index) => (o.destructive ? index : -1))
      .filter((index) => index >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: request.title,
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: destructive.length ? destructive : undefined,
      },
      (index) => request.options[index]?.onPress(),
    );
    return;
  }
  present?.(request);
}

/** Mounted once at the root; renders the Android / web sheet. */
export function ActionSheetHost() {
  const { colors } = useTheme();
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    present = setRequest;
    return () => {
      present = null;
    };
  }, []);

  const close = () => setRequest(null);

  return (
    <Modal
      visible={Boolean(request)}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}
        >
          <SafeAreaView edges={['bottom']}>
            <View
              style={[styles.handle, { backgroundColor: colors.borderStrong }]}
            />
            {request?.title ? (
              <AppText variant="muted" style={styles.title}>
                {request.title}
              </AppText>
            ) : null}
            {request?.options.map((option) => {
              const tint = option.destructive
                ? colors.destructiveText
                : colors.foreground;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => {
                    haptics.selection();
                    close();
                    option.onPress();
                  }}
                  accessibilityRole="button"
                  android_ripple={{ color: colors.accent }}
                  style={styles.option}
                >
                  {option.icon ? (
                    <Ionicons name={option.icon} size={22} color={tint} />
                  ) : null}
                  <AppText variant="body" style={{ color: tint }}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </SafeAreaView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl + 14,
    borderTopRightRadius: radius.xl + 14,
    paddingBottom: spacing.sm,
    overflow: 'hidden',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  title: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
  },
});
