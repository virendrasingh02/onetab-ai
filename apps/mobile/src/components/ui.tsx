import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { initials, type StatusTone } from '../lib/format';
import { useAuthedImageSource } from '../lib/use-authed-uri';
import { toneColors, useTheme } from '../theme/theme';
import { fontSize, maxContentWidth, radius, spacing } from '../theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// --- layout -----------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['bottom'],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const inner = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={colors.primaryText}
              />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

// --- text -------------------------------------------------------------------

type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'muted' | 'caption';

export function AppText({
  children,
  variant = 'body',
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { colors } = useTheme();
  const variants: Record<TextVariant, TextStyle> = {
    title: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: colors.foreground,
    },
    heading: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.foreground,
    },
    body: { fontSize: fontSize.md, color: colors.foreground },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.foreground,
    },
    muted: { fontSize: fontSize.sm, color: colors.mutedForeground },
    caption: { fontSize: fontSize.xs, color: colors.mutedForeground },
  };
  return (
    <Text
      style={[variants[variant], style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessibilityRole={
        variant === 'title' || variant === 'heading' ? 'header' : undefined
      }
    >
      {children}
    </Text>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.row, styles.sectionHeader]}>
      <AppText variant="label" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      {action}
    </View>
  );
}

// --- controls ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border: string }
  > = {
    primary: {
      bg: colors.primary,
      fg: colors.primaryForeground,
      border: colors.primary,
    },
    secondary: {
      bg: colors.card,
      fg: colors.foreground,
      border: colors.borderStrong,
    },
    ghost: { bg: 'transparent', fg: colors.primaryText, border: 'transparent' },
    destructive: {
      bg: colors.destructive,
      fg: colors.destructiveForeground,
      border: colors.destructive,
    },
  };
  const tone = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: Boolean(inactive),
        busy: Boolean(loading),
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: inactive ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tone.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: tone.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.foreground} />
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.subtle}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.input,
          },
          props.multiline ? styles.inputMultiline : null,
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={{ color: colors.destructiveText }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, styles.listRow]}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        {description ? <AppText variant="muted">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.input }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

// --- display ----------------------------------------------------------------

export function ListRow({
  title,
  subtitle,
  icon,
  avatar,
  right,
  onPress,
  chevron = Boolean(onPress),
  destructive,
}: {
  title: string;
  subtitle?: string | null;
  icon?: IconName;
  avatar?: {
    name: string;
    uri?: string | null;
    headers?: Record<string, string>;
  };
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, styles.listRow]}>
      {avatar ? (
        <Avatar name={avatar.name} uri={avatar.uri} headers={avatar.headers} />
      ) : null}
      {icon ? (
        <View style={[styles.iconWell, { backgroundColor: colors.selected }]}>
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.destructiveText : colors.primaryText}
          />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText
          variant="body"
          numberOfLines={1}
          style={destructive ? { color: colors.destructiveText } : undefined}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.accent : 'transparent',
      })}
    >
      {content}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
      }}
    />
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusTone;
}) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View
      style={[styles.badge, { backgroundColor: bg }]}
      accessibilityLabel={label}
    >
      <Text style={[styles.badgeLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  uri,
  headers,
  size = 36,
}: {
  name: string;
  uri?: string | null;
  headers?: Record<string, string>;
  size?: number;
}) {
  const { colors } = useTheme();
  const source = useAuthedImageSource(uri, headers);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (source) {
    return (
      <Image
        source={source}
        style={[box, { backgroundColor: colors.muted }]}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View
      style={[box, styles.center, { backgroundColor: colors.selected }]}
      accessible={false}
    >
      <Text
        style={{
          color: colors.primaryText,
          fontWeight: '700',
          fontSize: size * 0.38,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatusTone;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.statTile}>
      <AppText variant="muted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="title" style={{ fontSize: fontSize.xl }}>
        {value}
      </AppText>
      {hint ? (
        <AppText
          variant="caption"
          style={tone ? { color: toneColors(colors, tone).fg } : undefined}
          numberOfLines={1}
        >
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

export function ProgressBar({
  value,
  tone = 'success',
}: {
  value: number;
  tone?: StatusTone;
}) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);
  const fill =
    tone === 'danger'
      ? colors.destructive
      : tone === 'warning'
        ? colors.warning
        : colors.primary;
  return (
    <View
      style={[styles.progressTrack, { backgroundColor: colors.muted }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${clamped * 100}%`, backgroundColor: fill },
        ]}
      />
    </View>
  );
}

// --- states -----------------------------------------------------------------

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.state, styles.center]}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color={colors.primaryText} />
      <AppText variant="muted">{label}</AppText>
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.state, styles.center]}>
      <Ionicons name={icon} size={36} color={colors.subtle} />
      <AppText variant="heading" style={styles.textCenter}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="muted" style={styles.textCenter}>
          {description}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Couldn't load this"
      description={message}
      action={
        onRetry ? (
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        ) : undefined
      }
    />
  );
}

/**
 * Renders the loading / error / content branches of a react-query result the
 * same way on every screen.
 */
export function QueryBoundary<T>({
  query,
  children,
  loadingLabel,
}: {
  query: {
    data: T | undefined;
    isPending: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.error || query.data === undefined) {
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' },
  scrollContent: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionHeader: { justifyContent: 'space-between', marginTop: spacing.md },
  sectionTitle: { letterSpacing: 0.6, opacity: 0.7 },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonLabel: { fontSize: fontSize.md, fontWeight: '600' },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: spacing.xs },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  listRow: {
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: fontSize.xs, fontWeight: '600' },
  statTile: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: spacing.xs },
  progressTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  state: {
    paddingVertical: spacing.xxl,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
