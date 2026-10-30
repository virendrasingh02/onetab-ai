import { knowledgeApi } from '@org/api-client';
import type { KnowledgeBase } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
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
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../components/ui';
import { haptics } from '../../../lib/haptics';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { radius, spacing } from '../../../theme/tokens';

const EMBEDDING_MODELS = [
  'text-embedding-3-small',
  'text-embedding-3-large',
  'nomic-embed-text',
  'bge-large-en',
];

export default function KnowledgeBasesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { colors } = useTheme();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState(EMBEDDING_MODELS[0]);
  const [search, setSearch] = useState('');

  const kbQuery = useQuery({
    queryKey: ['mobile', 'knowledge-bases', workspaceId],
    queryFn: () => knowledgeApi.list(workspaceId).catch(() => [] as KnowledgeBase[]),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeApi.create(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        embeddingModel: selectedModel,
      }),
    onSuccess: (newKb) => {
      haptics.success();
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      void queryClient.invalidateQueries({
        queryKey: ['mobile', 'knowledge-bases', workspaceId],
      });
      router.push({
        pathname: '/knowledge/[kbId]',
        params: { kbId: newKb.id },
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Could not create knowledge base', err.message);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = kbQuery.data ?? [];
    if (!q) return list;
    return list.filter(
      (kb) =>
        kb.name.toLowerCase().includes(q) ||
        (kb.description && kb.description.toLowerCase().includes(q)),
    );
  }, [kbQuery.data, search]);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Knowledge Base',
          headerRight: () => (
            <IconButton
              icon="add"
              label="New Knowledge Base"
              onPress={() => setCreateModalOpen(true)}
            />
          ),
        }}
      />

      <View style={styles.searchBar}>
        <TextField
          placeholder="Filter knowledge collections…"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {kbQuery.isPending ? (
        <View style={styles.centered}>
          <AppText variant="muted">Loading knowledge bases…</AppText>
        </View>
      ) : kbQuery.error ? (
        <ErrorState error={kbQuery.error} onRetry={() => void kbQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="library-outline"
          title="No knowledge collections"
          description="Create a knowledge base to index workspace documents, PDFs, policies, and enable semantic retrieval for AI agents."
          action={
            <Button
              label="Create Knowledge Base"
              icon="add"
              onPress={() => setCreateModalOpen(true)}
            />
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(kb) => kb.id}
          ItemSeparatorComponent={() => <Divider inset={rowDividerInset} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRow
              icon="book-outline"
              title={item.name}
              subtitle={
                item.description ||
                `${item._count?.documents ?? 0} docs · Model: ${item.embeddingModel}`
              }
              right={
                <Badge
                  label={`${item._count?.documents ?? 0} docs`}
                  tone="neutral"
                />
              }
              onPress={() => {
                haptics.selection();
                router.push({
                  pathname: '/knowledge/[kbId]',
                  params: { kbId: item.id },
                });
              }}
            />
          )}
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCreateModalOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHeader}>
              <AppText variant="heading">New Knowledge Base</AppText>
              <IconButton
                icon="close"
                label="Close"
                onPress={() => setCreateModalOpen(false)}
              />
            </View>
            <View style={styles.sheetContent}>
              <TextField
                label="Collection Name"
                placeholder="e.g. Engineering Handbook, Product FAQs"
                value={name}
                onChangeText={setName}
              />
              <TextField
                label="Description"
                placeholder="What kind of documents does this base hold?"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <AppText variant="label">Embedding Model</AppText>
              <View style={styles.modelRow}>
                {EMBEDDING_MODELS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setSelectedModel(m)}
                    style={[
                      styles.modelPill,
                      {
                        backgroundColor:
                          selectedModel === m ? colors.selected : colors.background,
                        borderColor: selectedModel === m ? colors.ring : colors.border,
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{
                        color: selectedModel === m ? colors.primaryText : colors.foreground,
                        fontWeight: selectedModel === m ? '600' : '400',
                      }}
                    >
                      {m}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Button
                label={createMutation.isPending ? 'Creating…' : 'Create Collection'}
                icon="checkmark"
                disabled={!name.trim() || createMutation.isPending}
                onPress={() => createMutation.mutate()}
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
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: spacing.xl,
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
  sheetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  modelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
