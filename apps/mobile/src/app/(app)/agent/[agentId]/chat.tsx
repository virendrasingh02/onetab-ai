import Ionicons from '@expo/vector-icons/Ionicons';
import { agentsApi, queryKeys } from '@org/api-client';
import type { AgentChatMessage } from '@org/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardAvoidingProps } from '../../../../components/navigation';
import {
  AppText,
  Avatar,
  Badge,
  IconButton,
  keyboardDismissMode,
  LoadingState,
} from '../../../../components/ui';
import { formatChatTime } from '../../../../lib/format';
import { haptics } from '../../../../lib/haptics';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { maxContentWidth, radius, spacing } from '../../../../theme/tokens';

const SUGGESTIONS = [
  'What can you help me with?',
  'Summarize recent activity',
  'Draft a project update',
  'Check system status',
];

export default function AgentChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { workspaceId } = useWorkspace();
  const { colors, dark } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const agent = useQuery({
    queryKey: queryKeys.agents.detail(workspaceId, agentId),
    queryFn: () => agentsApi.get(workspaceId, agentId),
  });

  const history = useQuery({
    queryKey: ['mobile', 'agent-latest-conversation', workspaceId, agentId],
    queryFn: async () => {
      const list = await agentsApi.listConversations(workspaceId, agentId);
      const latest = [...list].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )[0];
      return latest
        ? agentsApi.getConversation(workspaceId, agentId, latest.id)
        : null;
    },
  });

  useEffect(() => {
    if (history.data && !conversationId) {
      setConversationId(history.data.id);
      setMessages(history.data.messages);
    }
  }, [history.data, conversationId]);

  const send = useMutation({
    mutationFn: (message: string) =>
      agentsApi.chat(workspaceId, agentId, { message, conversationId }),
    onMutate: (message) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          role: 'user',
          content: message,
          at: new Date().toISOString(),
        },
      ]);
    },
    onSuccess: (res) => {
      haptics.light();
      setConversationId(res.conversationId);
      setMessages((prev) => [...prev, res.message]);
    },
    onError: (error) => {
      haptics.warning();
      Alert.alert('The agent could not answer', error.message);
    },
  });

  const submit = (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    if (!text || send.isPending) return;
    setDraft('');
    send.mutate(text);
  };

  const startNew = () => {
    haptics.selection();
    setConversationId(undefined);
    setMessages([]);
  };

  if (history.isPending) return <LoadingState label="Loading conversation…" />;

  const agentName = agent.data?.name ?? 'Agent';
  const welcome = agent.data?.welcomeMessage;
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView style={styles.flex} {...keyboardAvoiding}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitleWrap}>
              <AppText variant="label" numberOfLines={1}>
                {agentName}
              </AppText>
              <AppText
                variant="caption"
                style={{ color: colors.primaryText, fontSize: 11 }}
              >
                {send.isPending ? 'typing…' : 'Online'}
              </AppText>
            </View>
          ),
          headerRight: () => (
            <IconButton
              icon="create-outline"
              label="New conversation"
              onPress={startNew}
            />
          ),
        }}
      />

      <FlatList
        inverted
        keyboardDismissMode={keyboardDismissMode}
        data={reversed}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          send.isPending ? (
            <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
              <Avatar
                name={agentName}
                uri={agent.data?.avatarUrl}
                size={28}
              />
              <View
                style={[
                  styles.bubble,
                  styles.bubbleOther,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.typingRow}>
                  <View
                    style={[styles.typingDot, { backgroundColor: colors.primary }]}
                  />
                  <View
                    style={[styles.typingDot, { backgroundColor: colors.primary, opacity: 0.7 }]}
                  />
                  <View
                    style={[styles.typingDot, { backgroundColor: colors.primary, opacity: 0.4 }]}
                  />
                  <AppText variant="caption" style={{ marginLeft: 6 }}>
                    {agentName} is thinking…
                  </AppText>
                </View>
              </View>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.invert}>
            <View style={styles.welcomeBox}>
              <Avatar
                name={agentName}
                uri={agent.data?.avatarUrl}
                size={48}
              />
              <AppText variant="heading" style={styles.welcomeTitle}>
                {agentName}
              </AppText>
              <AppText variant="muted" style={styles.center}>
                {welcome ||
                  `Ask ${agentName} anything it is configured to help with.`}
              </AppText>

              {/* Suggestion Chips */}
              <View style={styles.suggestionsWrap}>
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => submit(suggestion)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={14}
                      color={colors.primaryText}
                    />
                    <AppText
                      variant="caption"
                      style={{ color: colors.foreground, fontSize: 13 }}
                    >
                      {suggestion}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          const time = formatChatTime(item.at);

          // Check if message is a tool execution or JSON output
          const isTool =
            item.content.startsWith('[Tool') ||
            item.content.startsWith('{"tool":');

          return (
            <View
              style={[
                styles.bubbleRow,
                mine ? styles.bubbleRowMine : styles.bubbleRowOther,
              ]}
            >
              {!mine ? (
                <Avatar
                  name={agentName}
                  uri={agent.data?.avatarUrl}
                  size={28}
                />
              ) : null}

              <View
                style={[
                  styles.bubble,
                  mine
                    ? [
                        styles.bubbleMine,
                        {
                          backgroundColor: dark ? '#054638' : '#dcf8c6',
                        },
                      ]
                    : [
                        styles.bubbleOther,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ],
                ]}
              >
                {!mine ? (
                  <AppText
                    variant="label"
                    style={[styles.agentHeader, { color: colors.primaryText }]}
                  >
                    {agentName}
                  </AppText>
                ) : null}

                {isTool ? (
                  <View
                    style={[
                      styles.toolBlock,
                      {
                        backgroundColor: dark ? '#13211c' : '#f0fbf4',
                        borderColor: 'rgba(96, 198, 134, 0.4)',
                      },
                    ]}
                  >
                    <View style={styles.toolHeader}>
                      <Ionicons
                        name="construct-outline"
                        size={15}
                        color={colors.primaryText}
                      />
                      <AppText
                        variant="label"
                        style={{ fontSize: 12, color: colors.primaryText, flex: 1 }}
                      >
                        Action Executed
                      </AppText>
                      <Badge label="Tool" tone="info" />
                    </View>
                    <AppText
                      variant="caption"
                      style={styles.toolPayload}
                      selectable
                    >
                      {item.content}
                    </AppText>
                  </View>
                ) : (
                  <AppText
                    variant="body"
                    selectable
                    style={styles.bubbleText}
                  >
                    {item.content}
                  </AppText>
                )}

                {/* Bubble Footer */}
                <View style={styles.bubbleFooter}>
                  <AppText variant="caption" style={styles.footerTime}>
                    {time}
                  </AppText>
                  {mine ? (
                    <Ionicons
                      name="checkmark-done"
                      size={14}
                      color={colors.primaryText}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Suggested Follow-Ups row if messages exist */}
      {messages.length > 0 && !send.isPending ? (
        <View style={styles.followUpWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.followUpScroll}
          >
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <Pressable
                key={s}
                onPress={() => submit(s)}
                style={[
                  styles.followUpChip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppText variant="caption" style={{ fontSize: 12 }}>
                  {s}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* WhatsApp Multiline Composer */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.composerWrap,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${agentName}…`}
            placeholderTextColor={colors.subtle}
            selectionColor={colors.ring}
            cursorColor={colors.primary}
            underlineColorAndroid="transparent"
            multiline
            accessibilityLabel={`Message ${agentName}`}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: dark ? '#1c2421' : '#f0f2f1',
                borderColor: 'transparent',
              },
            ]}
          />
          <Pressable
            onPress={() => submit()}
            disabled={!draft.trim() || send.isPending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: draft.trim()
                  ? colors.primary
                  : colors.disabled,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name="send"
              size={18}
              color={
                draft.trim()
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerTitleWrap: {
    alignItems: 'center',
  },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  invert: { transform: [{ scaleY: -1 }], padding: spacing.lg },
  center: { textAlign: 'center', marginTop: spacing.xs },
  welcomeBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  welcomeTitle: {
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  suggestionsWrap: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 3,
    gap: 6,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
  },
  bubbleMine: {
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    borderBottomLeftRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  agentHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  footerTime: {
    fontSize: 11,
    opacity: 0.7,
  },

  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  toolBlock: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginVertical: 4,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolPayload: {
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
  },

  followUpWrap: {
    paddingVertical: 4,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  followUpScroll: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  followUpChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
});
