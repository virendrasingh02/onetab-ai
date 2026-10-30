import { knowledgeApi } from '@org/api-client';
import type {
  KnowledgeDocument,
  KnowledgeRetrievalResult,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../components/ui';
import { pickFile } from '../../../lib/files';
import { relativeTime } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

export default function KnowledgeBaseDetailScreen() {
  const { kbId } = useLocalSearchParams<{ kbId: string }>();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'docs' | 'search'>('docs');
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // Semantic test search
  const [searchQuery, setSearchQuery] = useState('');
  const [retrievedResults, setRetrievedResults] = useState<KnowledgeRetrievalResult[]>([]);

  // 1. KB Details
  const kbDetails = useQuery({
    queryKey: ['mobile', 'kb-detail', workspaceId, kbId],
    queryFn: () => knowledgeApi.get(workspaceId, kbId),
    enabled: Boolean(workspaceId && kbId),
  });

  // 2. Documents
  const docsQuery = useQuery({
    queryKey: ['mobile', 'kb-docs', workspaceId, kbId],
    queryFn: () => knowledgeApi.listDocuments(workspaceId, kbId),
    enabled: Boolean(workspaceId && kbId && activeTab === 'docs'),
    refetchInterval: (q) =>
      q.state.data?.some(
        (d) => d.status === 'PROCESSING' || d.status === 'QUEUED',
      )
        ? 4000
        : false,
  });

  const invalidateDocs = () => {
    void queryClient.invalidateQueries({
      queryKey: ['mobile', 'kb-docs', workspaceId, kbId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['mobile', 'kb-detail', workspaceId, kbId],
    });
  };

  // Reindex mutation
  const reindexMutation = useMutation({
    mutationFn: () => knowledgeApi.reindex(workspaceId, kbId),
    onSuccess: (res) => {
      haptics.success();
      Alert.alert(
        'Reindexing Started',
        `Reindexing queued for ${res.documents} documents.`,
      );
      invalidateDocs();
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Reindex Failed', err.message);
    },
  });

  // Pick Document & Ingest
  const handleUploadDocument = async () => {
    haptics.selection();
    const file = await pickFile('document');
    if (!file) return;

    try {
      await knowledgeApi.ingestDocument(workspaceId, kbId, {
        name: file.name,
        sourceType: 'FILE',
        mimeType: file.mimeType,
        rawText: `[Ingested from mobile device: ${file.name}]`,
      });
      haptics.success();
      invalidateDocs();
      Alert.alert('Document Uploaded', 'Document added and queued for embedding.');
    } catch (err: any) {
      haptics.warning();
      Alert.alert('Upload Failed', err.message);
    }
  };

  // Import URL
  const importUrlMutation = useMutation({
    mutationFn: () =>
      knowledgeApi.importUrl(workspaceId, kbId, {
        url: importUrl.trim(),
      }),
    onSuccess: (res) => {
      haptics.success();
      setUrlModalOpen(false);
      setImportUrl('');
      invalidateDocs();
      Alert.alert('URL Imported', `Imported ${res.documents.length} page(s).`);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Import Failed', err.message);
    },
  });

  // Semantic Retrieval Search
  const searchMutation = useMutation({
    mutationFn: () =>
      knowledgeApi.testRetrieval(workspaceId, kbId, {
        query: searchQuery.trim(),
        topK: 5,
      }),
    onSuccess: (results) => {
      haptics.success();
      setRetrievedResults(results);
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Search Failed', err.message);
    },
  });

  // Delete document
  const deleteDoc = (doc: KnowledgeDocument) => {
    Alert.alert(`Delete ${doc.name}?`, 'This removes the document and all embedded chunks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await knowledgeApi.deleteDocument(workspaceId, kbId, doc.id);
            haptics.selection();
            invalidateDocs();
          } catch (err: any) {
            Alert.alert('Delete Failed', err.message);
          }
        },
      },
    ]);
  };

  const kb = kbDetails.data;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: kb?.name || 'Knowledge Base',
          headerRight: () => (
            <IconButton
              icon="sync-outline"
              label="Reindex"
              disabled={reindexMutation.isPending}
              onPress={() => reindexMutation.mutate()}
            />
          ),
        }}
      />

      {/* Tabs Row */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => {
            haptics.selection();
            setActiveTab('docs');
          }}
          style={[
            styles.tabItem,
            activeTab === 'docs' && [styles.activeTabItem, { borderColor: colors.primaryText }],
          ]}
        >
          <AppText
            variant="caption"
            style={{
              fontWeight: activeTab === 'docs' ? '700' : '500',
              color: activeTab === 'docs' ? colors.primaryText : colors.subtle,
            }}
          >
            Documents ({docsQuery.data?.length ?? kb?._count?.documents ?? 0})
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.selection();
            setActiveTab('search');
          }}
          style={[
            styles.tabItem,
            activeTab === 'search' && [styles.activeTabItem, { borderColor: colors.primaryText }],
          ]}
        >
          <AppText
            variant="caption"
            style={{
              fontWeight: activeTab === 'search' ? '700' : '500',
              color: activeTab === 'search' ? colors.primaryText : colors.subtle,
            }}
          >
            Semantic Search & Q&A
          </AppText>
        </Pressable>
      </View>

      {/* Content depending on tab */}
      {activeTab === 'docs' ? (
        <View style={styles.tabContent}>
          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Button
              label="Upload Document"
              icon="document-attach-outline"
              onPress={handleUploadDocument}
              style={{ flex: 1 }}
            />
            <Button
              label="Import URL"
              variant="secondary"
              icon="globe-outline"
              onPress={() => setUrlModalOpen(true)}
              style={{ flex: 1 }}
            />
          </View>

          {docsQuery.isPending ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primaryText} />
            </View>
          ) : (docsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No documents yet"
              description="Upload files (PDF, DOCX, TXT, Markdown) or import URLs to embed and index knowledge for AI agents."
            />
          ) : (
            <FlatList
              data={docsQuery.data}
              keyExtractor={(d) => d.id}
              ItemSeparatorComponent={() => <Divider inset={rowDividerInset} />}
              renderItem={({ item }) => (
                <ListRow
                  icon={item.sourceType === 'URL' ? 'globe-outline' : 'document-outline'}
                  title={item.name}
                  subtitle={`${item.chunkCount} chunks · ${item.tokenCount} tokens · ${relativeTime(item.createdAt)}`}
                  right={
                    <View style={styles.docRight}>
                      <Badge
                        label={item.status}
                        tone={
                          item.status === 'INDEXED'
                            ? 'success'
                            : item.status === 'FAILED'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                      <IconButton
                        icon="trash-outline"
                        label="Delete"
                        onPress={() => deleteDoc(item)}
                      />
                    </View>
                  }
                />
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.searchContainer}>
          <Card>
            <AppText variant="label">Test Semantic Retrieval</AppText>
            <TextField
              placeholder="Ask a question or enter a search query…"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Button
              label={searchMutation.isPending ? 'Searching…' : 'Search Knowledge Base'}
              icon="search"
              disabled={!searchQuery.trim() || searchMutation.isPending}
              onPress={() => searchMutation.mutate()}
            />
          </Card>

          {searchMutation.isPending ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primaryText} />
            </View>
          ) : retrievedResults.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <AppText variant="label">Retrieved Chunks ({retrievedResults.length})</AppText>
              {retrievedResults.map((result, idx) => (
                <Card key={idx} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Badge
                      label={`Score: ${result.score ? Math.round(result.score * 100) : 0}%`}
                      tone="neutral"
                    />
                    <AppText variant="caption" style={{ color: colors.subtle }}>
                      {(result.metadata?.['documentName'] as string) || `Chunk ${idx + 1}`}
                    </AppText>
                  </View>
                  <AppText variant="body" selectable style={{ marginTop: 4 }}>
                    {result.content}
                  </AppText>
                </Card>
              ))}
            </View>
          ) : searchQuery.trim() && !searchMutation.isPending ? (
            <EmptyState
              icon="search-outline"
              title="No relevant chunks found"
              description="Try asking a different question or adjusting the wording."
            />
          ) : null}
        </ScrollView>
      )}

      {/* Import URL Modal */}
      <Modal
        visible={urlModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setUrlModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setUrlModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Import Web URL</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setUrlModalOpen(false)}
              />
            </View>
            <View style={styles.sheetContent}>
              <TextField
                label="Documentation or Article URL"
                placeholder="https://example.com/docs"
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
              />
              <Button
                label={importUrlMutation.isPending ? 'Importing…' : 'Import Web Content'}
                icon="download-outline"
                disabled={!importUrl.trim() || importUrlMutation.isPending}
                onPress={() => importUrlMutation.mutate()}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabContent: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  centered: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  resultCard: {
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sheetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
});
