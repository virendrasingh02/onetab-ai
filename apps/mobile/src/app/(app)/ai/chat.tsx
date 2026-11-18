import Ionicons from '@expo/vector-icons/Ionicons';
import { aiApi, aiFeedbackApi, promptTemplateApi } from '@org/api-client';
import type {
  AIChatMessage,
  AIModelMetadata,
  PromptTemplate,
} from '@org/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { copyToClipboard } from '../../../lib/clipboard';
import { AttachmentPreview } from '../../../components/mobile-ui';
import {
  showActionSheet,
  type ActionSheetOption,
} from '../../../components/action-sheet';
import {
  AppText,
  Badge,
  EmptyState,
  IconButton,
  ListRow,
  type IconName,
  Screen,
} from '../../../components/ui';
import { useKeyboardAvoidingProps } from '../../../components/navigation';
import { haptics } from '../../../lib/haptics';
import { secureStore } from '../../../lib/secure-store';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme, type Theme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';
import { withAiConsent } from '../../../components/ai-consent';
import { showReportSheet } from '../../../components/report';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUri?: string;
  timestamp: string;
  tokensUsed?: number;
  sources?: Array<{ title?: string; text: string; score?: number }>;
  feedbackGiven?: 'up' | 'down';
}

interface Persona {
  id: string;
  name: string;
  role: string;
  icon: IconName;
  systemPrompt?: string;
}

const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'general',
    name: 'General Assistant',
    role: 'Helpful AI for everyday workspace queries',
    icon: 'sparkles',
  },
  {
    id: 'architect',
    name: 'Code Architect',
    role: 'Fullstack engineering, system design, and debugging',
    icon: 'code-slash',
    systemPrompt:
      'You are a Senior Software Architect. Provide clean, production-ready code with explanations.',
  },
  {
    id: 'writer',
    name: 'Technical Writer',
    role: 'Documentation, specs, concise executive summaries',
    icon: 'document-text',
    systemPrompt:
      'You are an Expert Technical Writer. Write structured, concise, and clear prose.',
  },
  {
    id: 'analyst',
    name: 'Research Analyst',
    role: 'Data synthesis, competitive analysis, and knowledge search',
    icon: 'analytics',
    systemPrompt:
      'You are a Senior Research Analyst. Synthesize information with clear bullet points and citations.',
  },
];

const DEFAULT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
  { id: 'llama3:latest', name: 'Llama 3 (Ollama)', provider: 'ollama' },
];

/**
 * Parses assistant messages for markdown code fences (```lang ... ```)
 * and renders syntax-highlighted code blocks with 1-tap copy!
 */
function FormattedMessageContent({
  content,
  isUser,
  colors,
}: {
  content: string;
  isUser: boolean;
  colors: Theme['colors'];
}) {
  const parts = useMemo(() => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const segments: Array<{
      type: 'text' | 'code';
      text: string;
      lang?: string;
    }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          text: content.slice(lastIndex, match.index),
        });
      }
      segments.push({
        type: 'code',
        lang: match[1]?.trim() || 'code',
        text: match[2]?.trimEnd() || '',
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex),
      });
    }

    return segments;
  }, [content]);

  if (isUser || parts.length === 0) {
    return (
      <AppText
        variant="body"
        selectable
        style={{
          color: isUser ? colors.primaryForeground : colors.foreground,
          lineHeight: 22,
        }}
      >
        {content}
      </AppText>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <AppText
              key={index}
              variant="body"
              selectable
              style={{ color: colors.foreground, lineHeight: 22 }}
            >
              {part.text}
            </AppText>
          );
        }

        return (
          <View key={index} style={styles.codeBlockCard}>
            <View style={styles.codeBlockHeader}>
              <Badge
                label={part.lang?.toUpperCase() || 'CODE'}
                tone="neutral"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy code to clipboard"
                onPress={() => {
                  haptics.selection();
                  void copyToClipboard(part.text, { label: 'Code snippet' });
                }}
                hitSlop={8}
                style={styles.copyCodeBtn}
              >
                <Ionicons name="copy-outline" size={14} color="#9ca3af" />
                <AppText style={styles.copyCodeLabel}>Copy</AppText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <AppText selectable style={styles.codeBlockText}>
                {part.text}
              </AppText>
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function AIChatScreen() {
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();
  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [selectedPersona, setSelectedPersona] = useState<Persona>(
    DEFAULT_PERSONAS[0],
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);

  const storageKey = `ai_chat_history:${workspaceId}`;

  // Load chat history from secure storage
  useEffect(() => {
    void secureStore.get(storageKey).then((saved) => {
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list) && list.length > 0) {
            setMessages(list);
          }
        } catch {
          // ignore
        }
      }
    });
  }, [storageKey]);

  const saveHistory = (items: ChatItem[]) => {
    setMessages(items);
    void secureStore.set(storageKey, JSON.stringify(items.slice(-50)));
  };

  // Fetch available AI models
  const modelsQuery = useQuery({
    queryKey: ['mobile', 'ai-models', workspaceId],
    queryFn: () =>
      aiApi.getModels(workspaceId).catch(() => [] as AIModelMetadata[]),
    enabled: Boolean(workspaceId),
  });

  const availableModels = useMemo(() => {
    const list = modelsQuery.data ?? [];
    return list.length > 0 ? list : DEFAULT_MODELS;
  }, [modelsQuery.data]);

  // Fetch prompt library
  const promptsQuery = useQuery({
    queryKey: ['mobile', 'ai-prompts', workspaceId],
    queryFn: () =>
      promptTemplateApi.list(workspaceId).catch(() => [] as PromptTemplate[]),
    enabled: Boolean(workspaceId && promptsOpen),
  });

  // Chat mutation with abort controller support
  const chatMutation = useMutation({
    mutationFn: async ({
      userText,
      imageUri,
    }: {
      userText: string;
      imageUri?: string | null;
    }) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;
      // ragSearch / analyzeVision take no signal, so a Stop pressed while they
      // run is honoured as soon as they return.
      const throwIfAborted = () => {
        if (signal.aborted) {
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          throw err;
        }
      };

      // 1. If web search or RAG is enabled, query sources
      let sources: Array<{ title?: string; text: string; score?: number }> = [];
      if (webSearchEnabled) {
        const ragResults = await aiApi
          .ragSearch(workspaceId, userText, 3)
          .catch(() => []);
        throwIfAborted();
        sources = ragResults.map((r) => ({
          text: r.text,
          score: r.score,
          title: (r.metadata?.['title'] as string) || 'Knowledge Source',
        }));
      }

      // 2. If vision image is attached, analyze vision
      if (imageUri) {
        const visionRes = await aiApi.analyzeVision(
          workspaceId,
          imageUri,
          userText,
        );
        throwIfAborted();
        return {
          reply: visionRes.analysis,
          tokens: 150,
          sources,
        };
      }

      // 3. Otherwise standard chat API with system prompt persona
      const conversationPayload: AIChatMessage[] = [];

      if (selectedPersona.systemPrompt) {
        conversationPayload.push({
          role: 'system',
          content: selectedPersona.systemPrompt,
        });
      }

      messages.slice(-8).forEach((m) => {
        conversationPayload.push({
          role: m.role,
          content: m.content,
        });
      });

      conversationPayload.push({
        role: 'user',
        content: userText,
      });

      const res = await aiApi.chat(
        workspaceId,
        { messages: conversationPayload, model: selectedModel },
        signal,
      );
      throwIfAborted();

      return {
        reply: res.message.content,
        tokens: res.usage?.totalTokens ?? 0,
        sources,
      };
    },
    onSuccess: (data) => {
      haptics.success();
      const assistantItem: ChatItem = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        tokensUsed: data.tokens,
        sources: data.sources.length > 0 ? data.sources : undefined,
      };
      saveHistory([...messages, assistantItem]);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    },
    onError: (err: Error) => {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        haptics.selection();
        return;
      }
      haptics.warning();
      Alert.alert(
        'AI Request Failed',
        err.message || 'Could not complete request.',
      );
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text && !attachedImage) return;

    haptics.selection();
    const userItem: ChatItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text || 'Analyze this image',
      imageUri: attachedImage ?? undefined,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userItem];
    saveHistory(nextMessages);
    setInput('');
    const imgToSend = attachedImage;
    setAttachedImage(null);

    chatMutation.mutate({ userText: text, imageUri: imgToSend });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleStopGeneration = () => {
    haptics.light();
    abortControllerRef.current?.abort();
  };

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      haptics.selection();
      setAttachedImage(res.assets[0].uri);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            haptics.selection();
            setMessages([]);
            void secureStore.remove(storageKey);
          },
        },
      ],
    );
  };

  const handleFeedback = (item: ChatItem, feedback: 'up' | 'down') => {
    haptics.selection();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === item.id ? { ...m, feedbackGiven: feedback } : m,
      ),
    );
    void aiFeedbackApi
      .submit(workspaceId, {
        rating: feedback === 'up' ? 1 : -1,
        comment: item.content.slice(0, 500),
      })
      .catch(() => undefined);
  };

  const handleMessageLongPress = (item: ChatItem) => {
    haptics.medium();
    const options: ActionSheetOption[] = [
      {
        label: 'Copy message',
        icon: 'copy-outline',
        onPress: () => {
          void copyToClipboard(item.content, { label: 'Message' });
        },
      },
    ];

    if (item.role === 'user') {
      options.push({
        label: 'Edit prompt',
        icon: 'pencil-outline',
        onPress: () => {
          setInput(item.content);
        },
      });
    }

    if (item.role === 'assistant') {
      options.push({
        label: 'Regenerate answer',
        icon: 'refresh-outline',
        onPress: () => {
          // Find preceding user prompt
          const idx = messages.findIndex((m) => m.id === item.id);
          const userPrompt = messages
            .slice(0, idx)
            .reverse()
            .find((m) => m.role === 'user');
          if (userPrompt) {
            chatMutation.mutate({ userText: userPrompt.content });
          }
        },
      });
    }

    options.push({
      label: 'Report response',
      icon: 'flag-outline',
      destructive: true,
      onPress: () => {
        showReportSheet({
          targetType: 'AI_OUTPUT',
          targetId: item.id,
          workspaceId,
          excerpt: item.content.slice(0, 4000),
        });
      },
    });

    showActionSheet({
      title: item.role === 'user' ? 'Your message' : 'AI Response',
      options,
    });
  };

  const activeModelObj = availableModels.find((m) => m.id === selectedModel);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: selectedPersona.name,
          headerRight: () => (
            <View style={styles.headerRight}>
              {/* Persona selector */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch AI Persona"
                onPress={() => setPersonaPickerOpen(true)}
                style={[
                  styles.headerPill,
                  {
                    backgroundColor: colors.selected,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={13}
                  color={colors.primaryText}
                />
                <AppText
                  variant="caption"
                  style={{ fontWeight: '600', color: colors.primaryText }}
                  numberOfLines={1}
                >
                  {selectedPersona.name.split(' ')[0]}
                </AppText>
              </Pressable>

              {/* Model selector */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch AI model"
                onPress={() => setModelPickerOpen(true)}
                style={[
                  styles.headerPill,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{ fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {activeModelObj?.name || selectedModel}
                </AppText>
                <Ionicons name="chevron-down" size={12} color={colors.subtle} />
              </Pressable>

              <IconButton
                icon="trash-outline"
                label="Clear chat"
                onPress={handleClearChat}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={keyboardAvoiding.behavior}
        keyboardVerticalOffset={keyboardAvoiding.keyboardVerticalOffset}
      >
        {/* Messages List */}
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="sparkles"
              title={`How can ${selectedPersona.name} help?`}
              description={selectedPersona.role}
            />
            {/* Prompt Starter Chips */}
            <View style={styles.starterWrap}>
              {[
                'Draft a weekly status update',
                'Explain system architecture',
                'Write an announcement email',
                'Summarize recent decisions',
              ].map((starter) => (
                <Pressable
                  key={starter}
                  onPress={() => {
                    haptics.selection();
                    setInput(starter);
                  }}
                  style={[
                    styles.starterChip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={14}
                    color={colors.primaryText}
                  />
                  <AppText
                    variant="caption"
                    style={{ color: colors.foreground }}
                  >
                    {starter}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View
                  style={[
                    styles.bubbleWrap,
                    isUser ? styles.userBubbleWrap : styles.assistantBubbleWrap,
                  ]}
                >
                  <Pressable
                    onLongPress={() => handleMessageLongPress(item)}
                    style={[
                      styles.bubble,
                      isUser
                        ? [
                            styles.userBubble,
                            { backgroundColor: colors.primary },
                          ]
                        : [
                            styles.assistantBubble,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ],
                    ]}
                  >
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.bubbleImage}
                        resizeMode="cover"
                      />
                    ) : null}

                    {/* Formatted Content with Code Block Support */}
                    <FormattedMessageContent
                      content={item.content}
                      isUser={isUser}
                      colors={colors}
                    />

                    {/* Citations if available */}
                    {item.sources && item.sources.length > 0 ? (
                      <View style={styles.sourcesContainer}>
                        <AppText
                          variant="caption"
                          style={{ fontWeight: '600', color: colors.subtle }}
                        >
                          Sources:
                        </AppText>
                        {item.sources.map(
                          (
                            s: { text: string; title?: string; score?: number },
                            idx: number,
                          ) => (
                            <View
                              key={idx}
                              style={[
                                styles.sourceItem,
                                { backgroundColor: colors.background },
                              ]}
                            >
                              <AppText variant="caption" numberOfLines={2}>
                                {s.text}
                              </AppText>
                            </View>
                          ),
                        )}
                      </View>
                    ) : null}

                    {/* Metadata & Actions for Assistant */}
                    {!isUser ? (
                      <View style={styles.bubbleFooter}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {item.tokensUsed ? (
                            <AppText
                              variant="caption"
                              style={{ color: colors.subtle, fontSize: 11 }}
                            >
                              {item.tokensUsed} tokens
                            </AppText>
                          ) : null}
                          <AppText
                            variant="caption"
                            style={{ color: colors.subtle, fontSize: 11 }}
                          >
                            · Hold for actions
                          </AppText>
                        </View>

                        <View style={styles.feedbackRow}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Copy response"
                            onPress={() =>
                              void copyToClipboard(item.content, {
                                label: 'Response',
                              })
                            }
                            hitSlop={8}
                          >
                            <Ionicons
                              name="copy-outline"
                              size={14}
                              color={colors.subtle}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Good response"
                            onPress={() => handleFeedback(item, 'up')}
                            hitSlop={8}
                          >
                            <Ionicons
                              name={
                                item.feedbackGiven === 'up'
                                  ? 'thumbs-up'
                                  : 'thumbs-up-outline'
                              }
                              size={14}
                              color={
                                item.feedbackGiven === 'up'
                                  ? colors.primaryText
                                  : colors.subtle
                              }
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Bad response"
                            onPress={() => handleFeedback(item, 'down')}
                            hitSlop={8}
                          >
                            <Ionicons
                              name={
                                item.feedbackGiven === 'down'
                                  ? 'thumbs-down'
                                  : 'thumbs-down-outline'
                              }
                              size={14}
                              color={
                                item.feedbackGiven === 'down'
                                  ? colors.destructive
                                  : colors.subtle
                              }
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Report this response"
                            onPress={() =>
                              showReportSheet({
                                targetType: 'AI_OUTPUT',
                                targetId: item.id,
                                workspaceId,
                                excerpt: item.content.slice(0, 4000),
                              })
                            }
                            hitSlop={8}
                          >
                            <Ionicons
                              name="flag-outline"
                              size={14}
                              color={colors.subtle}
                            />
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            }}
          />
        )}

        {/* Loading Indicator */}
        {chatMutation.isPending ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={colors.primaryText} />
            <AppText variant="caption" style={{ color: colors.subtle }}>
              {selectedPersona.name} is thinking…
            </AppText>
          </View>
        ) : null}

        {/* Attached image preview banner using AttachmentPreview */}
        {attachedImage ? (
          <View
            style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}
          >
            <AttachmentPreview
              uri={attachedImage}
              name="Image for vision analysis"
              mimeType="image/*"
              onRemove={() => setAttachedImage(null)}
            />
          </View>
        ) : null}

        {/* Composer Toolbar */}
        <View
          style={[styles.composerContainer, { backgroundColor: colors.card }]}
        >
          <View style={styles.optionsToolbar}>
            <Pressable
              onPress={() => {
                haptics.selection();
                setWebSearchEnabled(!webSearchEnabled);
              }}
              style={[
                styles.toolPill,
                {
                  backgroundColor: webSearchEnabled
                    ? colors.selected
                    : colors.background,
                  borderColor: webSearchEnabled ? colors.ring : colors.border,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={14}
                color={webSearchEnabled ? colors.primaryText : colors.subtle}
              />
              <AppText
                variant="caption"
                style={{
                  color: webSearchEnabled
                    ? colors.primaryText
                    : colors.foreground,
                  fontWeight: webSearchEnabled ? '600' : '400',
                }}
              >
                Web Search
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.selection();
                setPromptsOpen(true);
              }}
              style={[
                styles.toolPill,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="bookmarks-outline"
                size={14}
                color={colors.subtle}
              />
              <AppText variant="caption">Prompts</AppText>
            </Pressable>

            <Pressable
              onPress={handlePickImage}
              style={[
                styles.toolPill,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={14} color={colors.subtle} />
              <AppText variant="caption">Vision</AppText>
            </Pressable>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              placeholder="Ask anything…"
              placeholderTextColor={colors.subtle}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />

            {chatMutation.isPending ? (
              <Pressable
                onPress={handleStopGeneration}
                accessibilityRole="button"
                accessibilityLabel="Stop generating"
                style={[
                  styles.stopBtn,
                  { backgroundColor: colors.destructive },
                ]}
              >
                <Ionicons name="square" size={14} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                disabled={!input.trim() && !attachedImage}
                onPress={handleSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      input.trim() || attachedImage
                        ? colors.primaryText
                        : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={
                    input.trim() || attachedImage
                      ? colors.background
                      : colors.subtle
                  }
                />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Model Picker Modal */}
      <Modal
        visible={modelPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModelPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModelPickerOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Select AI Model</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setModelPickerOpen(false)}
              />
            </View>
            <ScrollView style={styles.modelList}>
              {availableModels.map((m) => {
                const isSelected = m.id === selectedModel;
                return (
                  <ListRow
                    key={m.id}
                    icon="sparkles"
                    title={m.name}
                    subtitle={
                      m.provider ? `Provider: ${m.provider}` : undefined
                    }
                    right={
                      isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.primaryText}
                        />
                      ) : null
                    }
                    onPress={() => {
                      haptics.selection();
                      setSelectedModel(m.id);
                      setModelPickerOpen(false);
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Persona Picker Modal */}
      <Modal
        visible={personaPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPersonaPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPersonaPickerOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Select Persona</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setPersonaPickerOpen(false)}
              />
            </View>
            <ScrollView style={styles.modelList}>
              {DEFAULT_PERSONAS.map((p) => {
                const isSelected = p.id === selectedPersona.id;
                return (
                  <ListRow
                    key={p.id}
                    icon={p.icon}
                    title={p.name}
                    subtitle={p.role}
                    right={
                      isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.primaryText}
                        />
                      ) : null
                    }
                    onPress={() => {
                      haptics.selection();
                      setSelectedPersona(p);
                      setPersonaPickerOpen(false);
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Prompt Library Modal */}
      <Modal
        visible={promptsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPromptsOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPromptsOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Prompt Library</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setPromptsOpen(false)}
              />
            </View>
            <ScrollView style={styles.modelList}>
              {(promptsQuery.data ?? []).length === 0 ? (
                <View style={styles.emptyPrompts}>
                  <AppText variant="muted">
                    No custom prompt templates found.
                  </AppText>
                </View>
              ) : (
                promptsQuery.data?.map((p) => (
                  <ListRow
                    key={p.id}
                    icon="document-text-outline"
                    title={p.title}
                    subtitle={p.promptText}
                    onPress={() => {
                      haptics.selection();
                      setInput(p.promptText);
                      setPromptsOpen(false);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 120,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  starterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.md,
    maxWidth: 420,
  },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  messageList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  bubbleWrap: {
    width: '100%',
    flexDirection: 'row',
  },
  userBubbleWrap: {
    justifyContent: 'flex-end',
  },
  assistantBubbleWrap: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  userBubble: {
    borderBottomRightRadius: radius.sm,
  },
  assistantBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleImage: {
    width: 220,
    height: 150,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  sourcesContainer: {
    marginTop: spacing.xs,
    gap: 4,
  },
  sourceItem: {
    padding: 6,
    borderRadius: radius.sm,
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#8882',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  composerContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderColor: '#e5e7eb22',
  },
  optionsToolbar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '75%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modelList: {
    paddingHorizontal: spacing.sm,
  },
  emptyPrompts: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  codeBlockCard: {
    backgroundColor: '#18181b',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 4,
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#27272a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3f3f46',
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyCodeLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#f4f4f5',
    padding: spacing.sm,
    lineHeight: 18,
  },
});

export default withAiConsent(AIChatScreen);
