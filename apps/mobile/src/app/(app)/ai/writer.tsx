import Ionicons from '@expo/vector-icons/Ionicons';
import { aiApi, workToolsApi } from '@org/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Button,
  Card,
  IconButton,
  ListRow,
  Screen,
} from '../../../components/ui';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const TEMPLATES = [
  { id: 'email', label: 'Email Draft', prompt: 'Write a professional email regarding: ' },
  { id: 'summary', label: 'Executive Summary', prompt: 'Summarize the following key points: ' },
  { id: 'proposal', label: 'Project Proposal', prompt: 'Create a structured project proposal for: ' },
  { id: 'blog', label: 'Blog / Article', prompt: 'Write an engaging informative article about: ' },
  { id: 'update', label: 'Status Update', prompt: 'Draft a concise team status update detailing: ' },
  { id: 'spec', label: 'Technical Spec', prompt: 'Outline technical requirements and architecture for: ' },
];

const TONES = ['Professional', 'Casual', 'Direct', 'Persuasive', 'Friendly', 'Technical'];
const FORMATS = ['Standard', 'Bullet Points', 'Executive Brief', 'Social Post'];

const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
];

export default function AIWriterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [activeTemplate, setActiveTemplate] = useState('email');
  const [activeTone, setActiveTone] = useState('Professional');
  const [activeFormat, setActiveFormat] = useState('Standard');
  const [prompt, setPrompt] = useState('');
  const [content, setContent] = useState('');
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  // 1. Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (instructions: string) => {
      const fullPrompt = `Task: ${instructions}
Tone: ${activeTone}
Format: ${activeFormat}

Context / Subject:
${prompt.trim()}`;

      const res = await aiApi.chat(workspaceId, {
        messages: [{ role: 'user', content: fullPrompt }],
      });
      return res.message.content;
    },
    onSuccess: (text) => {
      haptics.success();
      setContent(text);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Generation Failed', err.message);
    },
  });

  // 2. Summarize mutation
  const summarizeMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await aiApi.summarize(workspaceId, text);
      return res.summary;
    },
    onSuccess: (summary) => {
      haptics.success();
      setContent(summary);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Summarize Failed', err.message);
    },
  });

  // 3. Translate mutation
  const translateMutation = useMutation({
    mutationFn: async ({ text, targetLang }: { text: string; targetLang: string }) => {
      const res = await aiApi.translate(workspaceId, text, targetLang);
      return res.translatedText;
    },
    onSuccess: (translated) => {
      haptics.success();
      setContent(translated);
      setLanguageModalOpen(false);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Translation Failed', err.message);
    },
  });

  // 4. Save as Document mutation
  const saveDocMutation = useMutation({
    mutationFn: async () => {
      const title =
        TEMPLATES.find((t) => t.id === activeTemplate)?.label +
        ` (${new Date().toLocaleDateString()})`;
      return workToolsApi.createDocument(workspaceId, {
        title,
        content,
        kind: 'DOC',
      });
    },
    onSuccess: (doc) => {
      haptics.success();
      void queryClient.invalidateQueries({
        queryKey: ['work-tools', workspaceId, 'documents'],
      });
      Alert.alert('Saved to Documents', 'Document created successfully.', [
        {
          text: 'View Document',
          onPress: () =>
            router.push({
              pathname: '/documents/[docId]',
              params: { docId: doc.id },
            }),
        },
        { text: 'Done', style: 'cancel' },
      ]);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not save document', err.message);
    },
  });

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  const handleShare = async () => {
    if (!content.trim()) return;
    haptics.selection();
    if (await Sharing.isAvailableAsync()) {
      try {
        const file = new File(Paths.cache, `writer-${Date.now()}.txt`);
        file.write(content);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Content',
        });
      } catch {
        // fallback
      }
    } else {
      Alert.alert('Content Ready', content.substring(0, 300) + '…');
    }
  };

  const isGenerating =
    generateMutation.isPending ||
    summarizeMutation.isPending ||
    translateMutation.isPending;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'AI Writer' }} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Templates Carousel */}
        <View style={styles.section}>
          <AppText variant="label" style={styles.sectionLabel}>
            Writing Templates
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {TEMPLATES.map((tmpl) => {
              const active = activeTemplate === tmpl.id;
              return (
                <Pressable
                  key={tmpl.id}
                  onPress={() => {
                    haptics.selection();
                    setActiveTemplate(tmpl.id);
                    if (!prompt) setPrompt(tmpl.prompt);
                  }}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? colors.primaryText : colors.card,
                      borderColor: active ? colors.primaryText : colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? colors.background : colors.foreground,
                      fontWeight: active ? '600' : '500',
                    }}
                  >
                    {tmpl.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Tone and Format Controls */}
        <View style={styles.optionsCard}>
          <View style={styles.optionGroup}>
            <AppText variant="caption" style={{ color: colors.subtle, marginBottom: 4 }}>
              Tone
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {TONES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    haptics.selection();
                    setActiveTone(t);
                  }}
                  style={[
                    styles.smallPill,
                    {
                      backgroundColor: activeTone === t ? colors.selected : colors.background,
                      borderColor: activeTone === t ? colors.ring : colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: activeTone === t ? colors.primaryText : colors.foreground,
                      fontWeight: activeTone === t ? '600' : '400',
                    }}
                  >
                    {t}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.optionGroup, { marginTop: spacing.sm }]}>
            <AppText variant="caption" style={{ color: colors.subtle, marginBottom: 4 }}>
              Format
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {FORMATS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    haptics.selection();
                    setActiveFormat(f);
                  }}
                  style={[
                    styles.smallPill,
                    {
                      backgroundColor: activeFormat === f ? colors.selected : colors.background,
                      borderColor: activeFormat === f ? colors.ring : colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: activeFormat === f ? colors.primaryText : colors.foreground,
                      fontWeight: activeFormat === f ? '600' : '400',
                    }}
                  >
                    {f}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Instructions / Prompt Card */}
        <Card style={styles.inputCard}>
          <AppText variant="label">What do you want to write or refine?</AppText>
          <TextInput
            placeholder="Enter instructions, notes, bullet points, or paste draft…"
            placeholderTextColor={colors.subtle}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
            style={[
              styles.textArea,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={styles.generateActionRow}>
            <Button
              label={isGenerating ? 'Writing…' : 'Generate Content'}
              icon="sparkles"
              disabled={!prompt.trim() || isGenerating}
              onPress={() => generateMutation.mutate('Draft the content completely')}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Generated Output Workspace */}
        <Card style={styles.outputCard}>
          <View style={styles.outputHeader}>
            <View>
              <AppText variant="heading">Generated Workspace</AppText>
              <AppText variant="caption" style={{ color: colors.subtle }}>
                {wordCount} words · {content.length} characters
              </AppText>
            </View>
            <View style={styles.outputActions}>
              <IconButton
                icon="share-outline"
                label="Share"
                disabled={!content.trim()}
                onPress={handleShare}
              />
              <IconButton
                icon="save-outline"
                label="Save as Document"
                disabled={!content.trim() || saveDocMutation.isPending}
                onPress={() => saveDocMutation.mutate()}
              />
            </View>
          </View>

          {/* Quick Refine Toolbar */}
          {content.trim() ? (
            <View style={styles.refineRow}>
              <Pressable
                onPress={() => summarizeMutation.mutate(content)}
                disabled={isGenerating}
                style={[styles.refineBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="contract-outline" size={14} color={colors.foreground} />
                <AppText variant="caption">Summarize</AppText>
              </Pressable>
              <Pressable
                onPress={() =>
                  generateMutation.mutate(
                    'Improve clarity, flow, and punchiness of the current content',
                  )
                }
                disabled={isGenerating}
                style={[styles.refineBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="flash-outline" size={14} color={colors.foreground} />
                <AppText variant="caption">Improve</AppText>
              </Pressable>
              <Pressable
                onPress={() =>
                  generateMutation.mutate(
                    'Expand with more practical examples and in-depth details',
                  )
                }
                disabled={isGenerating}
                style={[styles.refineBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="expand-outline" size={14} color={colors.foreground} />
                <AppText variant="caption">Expand</AppText>
              </Pressable>
              <Pressable
                onPress={() => setLanguageModalOpen(true)}
                disabled={isGenerating}
                style={[styles.refineBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="language-outline" size={14} color={colors.foreground} />
                <AppText variant="caption">Translate</AppText>
              </Pressable>
            </View>
          ) : null}

          {/* Editable Content */}
          <TextInput
            placeholder="AI generated content will appear here. You can also edit it directly…"
            placeholderTextColor={colors.subtle}
            value={content}
            onChangeText={setContent}
            multiline
            style={[
              styles.outputArea,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
        </Card>
      </ScrollView>

      {/* Translation Language Modal */}
      <Modal
        visible={languageModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setLanguageModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Select Language</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setLanguageModalOpen(false)}
              />
            </View>
            <ScrollView>
              {LANGUAGES.map((lang) => (
                <ListRow
                  key={lang.code}
                  icon="language-outline"
                  title={lang.name}
                  onPress={() => {
                    translateMutation.mutate({
                      text: content,
                      targetLang: lang.name,
                    });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    marginBottom: 4,
  },
  pillRow: {
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  optionsCard: {
    padding: spacing.sm,
    borderRadius: radius.lg,
  },
  optionGroup: {},
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  inputCard: {
    gap: spacing.sm,
  },
  textArea: {
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  generateActionRow: {
    flexDirection: 'row',
  },
  outputCard: {
    gap: spacing.sm,
  },
  outputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  refineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: 4,
  },
  refineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  outputArea: {
    minHeight: 220,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
