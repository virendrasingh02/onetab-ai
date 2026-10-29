import { queryKeys, workToolsApi } from '@org/api-client';
import type { DocumentKind } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../components/ui';
import { relativeTime } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const KIND_FILTERS: Array<{ id: string; label: string; kind?: DocumentKind }> = [
  { id: 'ALL', label: 'All' },
  { id: 'DOC', label: 'Docs', kind: 'DOC' },
  { id: 'NOTE', label: 'Notes', kind: 'NOTE' },
  { id: 'WIKI', label: 'Wikis', kind: 'WIKI' },
];

export default function DocumentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [activeFilter, setActiveFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New document form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newKind, setNewKind] = useState<DocumentKind>('DOC');

  const selectedKind = KIND_FILTERS.find((f) => f.id === activeFilter)?.kind;

  const docsQuery = useQuery({
    queryKey: queryKeys.workTools.documents(workspaceId, selectedKind),
    queryFn: () => workToolsApi.documents(workspaceId, selectedKind),
    enabled: Boolean(workspaceId),
  });

  const createDocMutation = useMutation({
    mutationFn: (input: { title: string; content: string; kind: DocumentKind }) =>
      workToolsApi.createDocument(workspaceId, input),
    onSuccess: (newDoc) => {
      haptics.success();
      setCreateModalOpen(false);
      setNewTitle('');
      setNewContent('');
      queryClient.setQueryData(
        queryKeys.workTools.document(workspaceId, newDoc.id),
        newDoc,
      );
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.workTools.all(workspaceId), 'documents'],
      });
      router.push({
        pathname: '/documents/[docId]',
        params: { docId: newDoc.id },
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not create document', err.message);
    },
  });

  const filteredDocs = useMemo(() => {
    let list = docsQuery.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.content && d.content.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [docsQuery.data, search]);

  return (
    <Screen
      scroll
      refreshing={docsQuery.isRefetching}
      onRefresh={() => void docsQuery.refetch()}
    >
      {/* Top Header & Search */}
      <View style={styles.topBar}>
        <View style={styles.chipsRow}>
          {KIND_FILTERS.map((f) => (
            <Pressable
              key={f.id}
              style={[
                styles.chip,
                activeFilter === f.id && {
                  backgroundColor: colors.selected,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => {
                haptics.selection();
                setActiveFilter(f.id);
              }}
            >
              <AppText
                style={[
                  styles.chipText,
                  { color: activeFilter === f.id ? colors.primaryText : colors.subtle },
                ]}
              >
                {f.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <Button
          label="New doc"
          icon="add"
          onPress={() => {
            haptics.selection();
            setCreateModalOpen(true);
          }}
        />
      </View>

      <View style={styles.searchContainer}>
        <TextField
          placeholder="Search documents…"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Document List */}
      {docsQuery.error ? (
        <ErrorState
          error={docsQuery.error}
          onRetry={() => void docsQuery.refetch()}
        />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No documents found"
          description="Create your first document or change the filter."
        />
      ) : (
        <Card>
          {filteredDocs.map((doc, idx) => {
            const previewSnippet =
              doc.content
                ? doc.content.replace(/[#*`_[\]()]/g, '').slice(0, 90).trim()
                : 'Empty document';
            return (
              <View key={doc.id}>
                {idx > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon={
                    doc.kind === 'WIKI'
                      ? 'book-outline'
                      : doc.kind === 'NOTE'
                        ? 'journal-outline'
                        : 'document-text-outline'
                  }
                  title={doc.title || 'Untitled Document'}
                  subtitle={
                    [
                      doc.kind,
                      `Updated ${relativeTime(doc.updatedAt)}`,
                      previewSnippet,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  right={
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
                  }
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/documents/[docId]',
                      params: { docId: doc.id },
                    });
                  }}
                />
              </View>
            );
          })}
        </Card>
      )}

      {/* Create Document Modal */}
      <Modal
        visible={createModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <Screen edges={['top', 'bottom']} scroll>
          <View style={styles.modalHeader}>
            <AppText style={[styles.modalTitle, { color: colors.foreground }]}>
              Create Document
            </AppText>
            <IconButton
              icon="close"
              label="Close"
              onPress={() => setCreateModalOpen(false)}
            />
          </View>

          <View style={styles.formContainer}>
            <TextField
              label="Document Title"
              placeholder="e.g. Product Requirements Document"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <AppText style={[styles.fieldLabel, { color: colors.subtle }]}>Kind</AppText>
            <View style={styles.chipsRow}>
              {(['DOC', 'NOTE', 'WIKI'] as DocumentKind[]).map((k) => (
                <Pressable
                  key={k}
                  style={[
                    styles.chip,
                    newKind === k && {
                      backgroundColor: colors.selected,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setNewKind(k)}
                >
                  <AppText
                    style={[
                      styles.chipText,
                      { color: newKind === k ? colors.primaryText : colors.subtle },
                    ]}
                  >
                    {k}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <TextField
              label="Initial Content (optional)"
              placeholder="Start drafting your document…"
              value={newContent}
              onChangeText={setNewContent}
              multiline
              numberOfLines={6}
            />

            <Button
              label={createDocMutation.isPending ? 'Creating…' : 'Create Document'}
              disabled={!newTitle.trim() || createDocMutation.isPending}
              onPress={() =>
                createDocMutation.mutate({
                  title: newTitle.trim(),
                  content: newContent.trim(),
                  kind: newKind,
                })
              }
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#00000020',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
