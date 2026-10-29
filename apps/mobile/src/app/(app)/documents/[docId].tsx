import { queryKeys, workToolsApi } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { useKeyboardAvoidingProps } from '../../../components/navigation';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  keyboardDismissMode,
  LoadingState,
  TextField,
} from '../../../components/ui';
import { relativeTime } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

export default function DocumentDetailScreen() {
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const docQuery = useQuery({
    queryKey: queryKeys.workTools.document(workspaceId, docId),
    queryFn: () => workToolsApi.document(workspaceId, docId),
    enabled: Boolean(workspaceId && docId),
  });

  // Mirror the server copy into the editor only while not editing, so a
  // background refetch (app focus, reconnect) never wipes unsaved changes.
  useEffect(() => {
    if (docQuery.data && !isEditing) {
      setTitle(docQuery.data.title);
      setContent(docQuery.data.content ?? '');
    }
  }, [docQuery.data, isEditing]);

  const updateDocMutation = useMutation({
    mutationFn: () =>
      workToolsApi.updateDocument(workspaceId, docId, {
        title: title.trim(),
        content,
      }),
    onSuccess: (saved) => {
      haptics.success();
      queryClient.setQueryData(
        queryKeys.workTools.document(workspaceId, docId),
        saved,
      );
      setIsEditing(false);
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.workTools.all(workspaceId), 'documents'],
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not save document', err.message);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: () => workToolsApi.deleteDocument(workspaceId, docId),
    onSuccess: () => {
      haptics.warning();
      queryClient.removeQueries({
        queryKey: queryKeys.workTools.document(workspaceId, docId),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.workTools.all(workspaceId), 'documents'],
      });
      router.back();
    },
    onError: (err) => Alert.alert('Could not delete document', err.message),
  });

  if (docQuery.isPending) {
    return <LoadingState label="Loading document…" />;
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <ErrorState
        error={docQuery.error ?? new Error('Document not found')}
        onRetry={() => void docQuery.refetch()}
      />
    );
  }

  const doc = docQuery.data;

  const insertMarkdown = (prefix: string, suffix = '') => {
    haptics.selection();
    setContent((prev) => `${prev}\n${prefix}${suffix}`);
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      'Delete Document',
      'Are you sure you want to permanently delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDocMutation.mutate(),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView {...keyboardAvoiding} style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Document' : doc.title || 'Document',
          headerRight: () => (
            <View style={styles.headerActions}>
              {isEditing ? (
                <Button
                  label={updateDocMutation.isPending ? 'Saving…' : 'Save'}
                  onPress={() => updateDocMutation.mutate()}
                  disabled={updateDocMutation.isPending}
                  style={styles.saveBtn}
                />
              ) : (
                <>
                  <IconButton
                    icon="create-outline"
                    label="Edit"
                    onPress={() => {
                      haptics.selection();
                      setIsEditing(true);
                    }}
                  />
                  <IconButton
                    icon="trash-outline"
                    label="Delete"
                    onPress={confirmDelete}
                  />
                </>
              )}
            </View>
          ),
        }}
      />

      {isEditing ? (
        <View style={styles.editorContainer}>
          {/* Format Toolbar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.toolbar,
              { backgroundColor: colors.card, borderBottomColor: colors.border },
            ]}
          >
            <IconButton
              icon="text"
              label="H1"
              onPress={() => insertMarkdown('# ')}
            />
            <IconButton
              icon="text-outline"
              label="H2"
              onPress={() => insertMarkdown('## ')}
            />
            <IconButton
              icon="list-outline"
              label="Bullet"
              onPress={() => insertMarkdown('- ')}
            />
            <IconButton
              icon="checkbox-outline"
              label="Task"
              onPress={() => insertMarkdown('- [ ] ')}
            />
            <IconButton
              icon="code-slash-outline"
              label="Code"
              onPress={() => insertMarkdown('```\n', '\n```')}
            />
            <IconButton
              icon="chatbubble-outline"
              label="Quote"
              onPress={() => insertMarkdown('> ')}
            />
          </ScrollView>

          <ScrollView
            keyboardDismissMode={keyboardDismissMode}
            contentContainerStyle={styles.editorScroll}
          >
            <TextField
              label="Document Title"
              value={title}
              onChangeText={setTitle}
              style={styles.titleInput}
            />

            <AppText style={[styles.contentLabel, { color: colors.subtle }]}>
              Body (Markdown)
            </AppText>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write your document in Markdown…"
              placeholderTextColor={colors.subtle}
              multiline
              textAlignVertical="top"
              style={[
                styles.contentInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          keyboardDismissMode={keyboardDismissMode}
          contentContainerStyle={styles.readerScroll}
        >
          {/* Document Header Info */}
          <Card style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Badge
                label={doc.kind}
                tone={
                  doc.kind === 'WIKI'
                    ? 'info'
                    : doc.kind === 'NOTE'
                      ? 'warning'
                      : 'neutral'
                }
              />
              <AppText style={[styles.updatedText, { color: colors.subtle }]}>
                Updated {relativeTime(doc.updatedAt)}
              </AppText>
            </View>

            <AppText style={[styles.docTitle, { color: colors.foreground }]}>
              {doc.title || 'Untitled Document'}
            </AppText>

            {doc.author ? (
              <View style={styles.authorRow}>
                <Avatar
                  name={doc.author.displayName ?? 'Author'}
                  uri={doc.author.avatarUrl}
                  size={24}
                />
                <AppText style={[styles.authorName, { color: colors.subtle }]}>
                  {doc.author.displayName}
                </AppText>
              </View>
            ) : null}
          </Card>

          {/* Document Body Reader */}
          <Card style={styles.bodyCard}>
            {content.trim() ? (
              <AppText style={[styles.docBody, { color: colors.foreground }]}>
                {content}
              </AppText>
            ) : (
              <AppText style={[styles.emptyContentText, { color: colors.subtle }]}>
                This document is empty. Tap Edit to add content.
              </AppText>
            )}
          </Card>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  editorContainer: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editorScroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '700',
  },
  contentLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  contentInput: {
    minHeight: 280,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
  },
  readerScroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  metaCard: {
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  updatedText: {
    fontSize: 12,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorName: {
    fontSize: 13,
  },
  bodyCard: {
    padding: spacing.lg,
  },
  docBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  emptyContentText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
