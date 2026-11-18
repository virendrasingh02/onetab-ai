import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { haptics } from '../lib/haptics';
import { useAndroidBackHandler } from '../lib/use-back-handler';
import { useTheme } from '../theme/theme';
import { fontSize, radius, spacing } from '../theme/tokens';
import {
  AppText,
  Button,
  IconButton,
  keyboardDismissMode,
  type IconName,
} from './ui';

// --- Safe Area & Keyboard Containers ----------------------------------------

export function SafeAreaContainer({
  children,
  edges = ['top', 'bottom'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

export function KeyboardAwareContainer({
  children,
  offset = 0,
  style,
}: {
  children: ReactNode;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={offset}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// --- MobileHeader -----------------------------------------------------------

export interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  workspacePill?: {
    name: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

export function MobileHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  right,
  workspacePill,
  style,
}: MobileHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            onPress={() => {
              haptics.selection();
              onBack();
            }}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
        ) : null}

        <View style={styles.headerTitleWrap}>
          {workspacePill ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Current workspace: ${workspacePill.name}`}
              onPress={() => {
                haptics.selection();
                workspacePill.onPress();
              }}
              style={[
                styles.workspacePill,
                {
                  backgroundColor: colors.selected,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppText
                variant="caption"
                style={{ fontWeight: '600', color: colors.primaryText }}
                numberOfLines={1}
              >
                {workspacePill.name}
              </AppText>
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.primaryText}
              />
            </Pressable>
          ) : null}
          <AppText
            variant="heading"
            style={[styles.headerTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              style={{ color: colors.subtle }}
              numberOfLines={1}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {right ? <View style={styles.headerRightWrap}>{right}</View> : null}
      </View>
    </View>
  );
}

// --- BottomSheet ------------------------------------------------------------

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeightRatio?: number;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.85,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  useAndroidBackHandler(() => {
    if (visible) {
      onClose();
      return true;
    }
    return false;
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              maxHeight: windowHeight * maxHeightRatio,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <SafeAreaView edges={['bottom']} style={{ width: '100%' }}>
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: colors.borderStrong },
              ]}
            />
            {title ? (
              <View style={styles.sheetHeader}>
                <AppText variant="heading" style={{ flex: 1 }}>
                  {title}
                </AppText>
                <IconButton
                  icon="close"
                  label="Close sheet"
                  onPress={() => {
                    haptics.selection();
                    onClose();
                  }}
                />
              </View>
            ) : null}
            <ScrollView
              contentContainerStyle={styles.sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={keyboardDismissMode}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- NativeDialog -----------------------------------------------------------

export interface NativeDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function NativeDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isConfirming = false,
  onConfirm,
  onCancel,
  children,
}: NativeDialogProps) {
  const { colors } = useTheme();
  useAndroidBackHandler(() => {
    if (visible) {
      onCancel();
      return true;
    }
    return false;
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.dialogContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText variant="heading" style={{ marginBottom: spacing.xs }}>
            {title}
          </AppText>
          {description ? (
            <AppText
              variant="body"
              style={{ color: colors.subtle, marginBottom: spacing.md }}
            >
              {description}
            </AppText>
          ) : null}

          {children ? (
            <View style={{ marginBottom: spacing.md }}>{children}</View>
          ) : null}

          <View style={styles.dialogActions}>
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={() => {
                haptics.selection();
                onCancel();
              }}
              style={{ flex: 1 }}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              loading={isConfirming}
              onPress={() => {
                if (destructive) haptics.warning();
                else haptics.selection();
                onConfirm();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- MobileSearch -----------------------------------------------------------

export interface MobileSearchProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MobileSearch({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  autoFocus = false,
  style,
}: MobileSearchProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.searchBar,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.subtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={[styles.searchInput, { color: colors.foreground }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
          onPress={() => {
            haptics.selection();
            onChangeText('');
            onClear?.();
          }}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.subtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

// --- MobileToolbar ----------------------------------------------------------

export interface ToolbarAction {
  id: string;
  label: string;
  icon?: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function MobileToolbar({
  actions,
  selectedCount = 0,
  style,
}: {
  actions: ToolbarAction[];
  selectedCount?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.toolbar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        style,
      ]}
    >
      {selectedCount > 0 ? (
        <View style={styles.toolbarBadge}>
          <AppText
            variant="caption"
            style={{ fontWeight: '600', color: colors.primaryText }}
          >
            {selectedCount} selected
          </AppText>
        </View>
      ) : null}
      <View style={styles.toolbarActionsRow}>
        {actions.map((act) => (
          <Pressable
            key={act.id}
            disabled={act.disabled}
            onPress={() => {
              if (act.destructive) haptics.warning();
              else haptics.selection();
              act.onPress();
            }}
            style={[styles.toolbarActionItem, act.disabled && { opacity: 0.4 }]}
          >
            {act.icon ? (
              <Ionicons
                name={act.icon}
                size={20}
                color={act.destructive ? colors.destructive : colors.foreground}
              />
            ) : null}
            <AppText
              variant="caption"
              style={{
                color: act.destructive ? colors.destructive : colors.foreground,
                fontWeight: '500',
              }}
            >
              {act.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// --- ResponsiveCard ---------------------------------------------------------

export interface ResponsiveCardProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
  style?: StyleProp<ViewStyle>;
}

export function ResponsiveCard({
  children,
  onPress,
  variant = 'default',
  style,
}: ResponsiveCardProps) {
  const { colors } = useTheme();

  const containerStyle = [
    styles.responsiveCard,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    variant === 'elevated' && styles.cardElevated,
    variant === 'outlined' && { borderWidth: 1.5 },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={({ pressed }) => [
          containerStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

// --- ResponsiveTable --------------------------------------------------------

export interface TableColumn<T> {
  key: string;
  title: string;
  width?: number;
  render?: (row: T) => ReactNode;
}

export interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowPress?: (row: T) => void;
  emptyLabel?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowPress,
  emptyLabel = 'No data available',
}: ResponsiveTableProps<T>) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isTabletOrDesktop = width >= 600;

  if (data.length === 0) {
    return (
      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
        <AppText variant="muted">{emptyLabel}</AppText>
      </View>
    );
  }

  // Tablet and desktop grid view
  if (isTabletOrDesktop) {
    return (
      <View style={[styles.tableContainer, { borderColor: colors.border }]}>
        {/* Header */}
        <View
          style={[styles.tableHeaderRow, { backgroundColor: colors.selected }]}
        >
          {columns.map((col) => (
            <View
              key={col.key}
              style={[
                styles.tableCell,
                col.width ? { width: col.width } : { flex: 1 },
              ]}
            >
              <AppText variant="label" style={{ fontWeight: '600' }}>
                {col.title}
              </AppText>
            </View>
          ))}
        </View>

        {/* Rows */}
        {data.map((row, idx) => (
          <Pressable
            key={keyExtractor(row, idx)}
            disabled={!onRowPress}
            onPress={() => onRowPress?.(row)}
            style={({ pressed }) => [
              styles.tableRow,
              { borderTopColor: colors.border },
              pressed && { backgroundColor: colors.selected },
            ]}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={[
                  styles.tableCell,
                  col.width ? { width: col.width } : { flex: 1 },
                ]}
              >
                {col.render ? (
                  col.render(row)
                ) : (
                  <AppText variant="body">{String(row[col.key] ?? '')}</AppText>
                )}
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    );
  }

  // Mobile card view
  return (
    <View style={{ gap: spacing.sm }}>
      {data.map((row, idx) => (
        <ResponsiveCard
          key={keyExtractor(row, idx)}
          onPress={onRowPress ? () => onRowPress(row) : undefined}
          style={{ padding: spacing.md }}
        >
          {columns.map((col) => (
            <View key={col.key} style={styles.tableMobileRow}>
              <AppText
                variant="caption"
                style={{ color: colors.subtle, width: '40%' }}
              >
                {col.title}
              </AppText>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                {col.render ? (
                  col.render(row)
                ) : (
                  <AppText variant="body" style={{ fontWeight: '500' }}>
                    {String(row[col.key] ?? '')}
                  </AppText>
                )}
              </View>
            </View>
          ))}
        </ResponsiveCard>
      ))}
    </View>
  );
}

// --- MobileTabs (Segmented Control) -----------------------------------------

export interface MobileTabItem {
  id: string;
  label: string;
  icon?: IconName;
  badge?: number;
}

export function MobileTabs({
  tabs,
  activeTab,
  onChange,
  style,
}: {
  tabs: MobileTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.tabsContainer, style]}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              haptics.selection();
              onChange(tab.id);
            }}
            style={[
              styles.tabItem,
              {
                backgroundColor: isActive ? colors.primaryText : colors.card,
                borderColor: isActive ? colors.primaryText : colors.border,
              },
            ]}
          >
            {tab.icon ? (
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? colors.background : colors.foreground}
              />
            ) : null}
            <AppText
              variant="caption"
              style={{
                color: isActive ? colors.background : colors.foreground,
                fontWeight: isActive ? '600' : '500',
              }}
            >
              {tab.label}
            </AppText>
            {tab.badge ? (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor: isActive
                      ? colors.background
                      : colors.primary,
                  },
                ]}
              >
                <AppText
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: isActive
                      ? colors.primaryText
                      : colors.primaryForeground,
                  }}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// --- AttachmentPreview ------------------------------------------------------

export interface AttachmentPreviewProps {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  onRemove?: () => void;
  onPress?: () => void;
}

export function AttachmentPreview({
  uri,
  name,
  size,
  mimeType,
  onRemove,
  onPress,
}: AttachmentPreviewProps) {
  const { colors } = useTheme();
  const isImage =
    mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(uri);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.attachmentCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {isImage ? (
        <Image
          source={{ uri }}
          style={styles.attachmentThumb}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.attachmentIconThumb,
            { backgroundColor: colors.selected },
          ]}
        >
          <Ionicons name="document-text" size={24} color={colors.primary} />
        </View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="caption"
          numberOfLines={1}
          style={{ fontWeight: '600' }}
        >
          {name}
        </AppText>
        {size ? (
          <AppText
            variant="caption"
            style={{ color: colors.subtle, fontSize: 11 }}
          >
            {size > 1024 * 1024
              ? `${(size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.round(size / 1024)} KB`}
          </AppText>
        ) : null}
      </View>

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove attachment"
          onPress={() => {
            haptics.selection();
            onRemove();
          }}
          hitSlop={8}
          style={styles.attachmentRemoveBtn}
        >
          <Ionicons name="close-circle" size={18} color={colors.subtle} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// --- MobileComposer ---------------------------------------------------------

export interface MobileComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickAttachment?: () => void;
  onVoiceInput?: () => void;
  isSending?: boolean;
  placeholder?: string;
  quoteReply?: {
    sender: string;
    text: string;
    onDismiss: () => void;
  };
  attachment?: AttachmentPreviewProps;
}

export function MobileComposer({
  value,
  onChangeText,
  onSend,
  onPickAttachment,
  onVoiceInput,
  isSending = false,
  placeholder = 'Type a message…',
  quoteReply,
  attachment,
}: MobileComposerProps) {
  const { colors } = useTheme();
  const canSend =
    (value.trim().length > 0 || Boolean(attachment)) && !isSending;

  return (
    <View
      style={[
        styles.composerContainer,
        { backgroundColor: colors.card, borderTopColor: colors.border },
      ]}
    >
      {/* Quote reply banner */}
      {quoteReply ? (
        <View
          style={[
            styles.quoteBanner,
            {
              backgroundColor: colors.selected,
              borderLeftColor: colors.primary,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <AppText
              variant="caption"
              style={{ fontWeight: '600', color: colors.primaryText }}
            >
              Replying to {quoteReply.sender}
            </AppText>
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ color: colors.foreground }}
            >
              {quoteReply.text}
            </AppText>
          </View>
          <Pressable onPress={quoteReply.onDismiss} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.subtle} />
          </Pressable>
        </View>
      ) : null}

      {/* Attachment banner */}
      {attachment ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <AttachmentPreview {...attachment} />
        </View>
      ) : null}

      {/* Input row */}
      <View style={styles.composerRow}>
        {onPickAttachment ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            onPress={() => {
              haptics.selection();
              onPickAttachment();
            }}
            hitSlop={8}
            style={styles.composerIconBtn}
          >
            <Ionicons name="attach" size={22} color={colors.subtle} />
          </Pressable>
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          multiline
          maxLength={4000}
          style={[
            styles.composerInput,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        />

        {onVoiceInput && !value.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voice message"
            onPress={() => {
              haptics.light();
              onVoiceInput();
            }}
            hitSlop={8}
            style={styles.composerIconBtn}
          >
            <Ionicons name="mic-outline" size={22} color={colors.subtle} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={!canSend}
          onPress={() => {
            haptics.light();
            onSend();
          }}
          style={[
            styles.composerSendBtn,
            {
              backgroundColor: canSend ? colors.primaryText : colors.border,
            },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={18}
              color={canSend ? colors.background : colors.subtle}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// --- Styles -----------------------------------------------------------------

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetScrollContent: {
    paddingBottom: spacing.xxl,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dialogActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 42,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 0,
  },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  toolbarBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  toolbarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  toolbarActionItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  responsiveCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    overflow: 'hidden',
  },
  cardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  tableContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  tableMobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attachmentThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  attachmentIconThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentRemoveBtn: {
    padding: 4,
  },
  composerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
  },
  quoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderLeftWidth: 3,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  composerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: fontSize.md,
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
