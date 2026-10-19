import { agentsApi, queryKeys } from '@org/api-client';
import type { AgentChatMessage } from '@org/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, IconButton, LoadingState } from '../../../../components/ui';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { maxContentWidth, radius, spacing } from '../../../../theme/tokens';

/** A conversation with one agent, through the same `/agents/:id/chat` the web uses. */
export default function AgentChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const agent = useQuery({
    queryKey: queryKeys.agents.detail(workspaceId, agentId),
    queryFn: () => agentsApi.get(workspaceId, agentId),
  });

  // Resume the most recent conversation, as the web chat does.
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
      setConversationId(res.conversationId);
      setMessages((prev) => [...prev, res.message]);
    },
    onError: (error) =>
      Alert.alert('The agent could not answer', error.message),
  });

  const submit = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft('');
    send.mutate(text);
  };

  const startNew = () => {
    setConversationId(undefined);
    setMessages([]);
  };

  if (history.isPending) return <LoadingState label="Loading conversation…" />;

  const welcome = agent.data?.welcomeMessage;
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: agent.data?.name ?? 'Chat',
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
        data={reversed}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          send.isPending ? (
            <AppText variant="muted" style={styles.thinking}>
              {agent.data?.name ?? 'Agent'} is thinking…
            </AppText>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.invert}>
            <AppText variant="muted" style={styles.center}>
              {welcome || 'Ask the agent anything it is set up to help with.'}
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View
              style={[
                styles.bubble,
                mine
                  ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
                  : {
                      alignSelf: 'flex-start',
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
              ]}
            >
              <AppText
                variant="body"
                selectable
                style={mine ? { color: colors.primaryForeground } : undefined}
              >
                {item.content}
              </AppText>
            </View>
          );
        }}
      />
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
            placeholder="Message the agent"
            placeholderTextColor={colors.subtle}
            multiline
            accessibilityLabel="Message the agent"
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.input,
                backgroundColor: colors.background,
              },
            ]}
          />
          <IconButton
            icon="send"
            label="Send"
            onPress={submit}
            disabled={!draft.trim() || send.isPending}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  invert: { transform: [{ scaleY: -1 }], padding: spacing.xl },
  center: { textAlign: 'center' },
  thinking: { paddingVertical: spacing.sm },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
});
