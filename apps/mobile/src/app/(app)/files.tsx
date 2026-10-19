import { queryKeys, uploadApi } from '@org/api-client';
import type { Upload } from '@org/types';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppRefreshControl,
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  ProgressBar,
  type IconName,
} from '../../components/ui';
import {
  downloadWorkspaceUpload,
  pickFile,
  uploadToWorkspace,
  type PickSource,
} from '../../lib/files';
import { formatBytes, relativeTime } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { maxContentWidth, spacing } from '../../theme/tokens';

function iconFor(mime: string): IconName {
  if (mime.startsWith('image/')) return 'image-outline';
  if (mime.startsWith('video/')) return 'videocam-outline';
  if (mime.startsWith('audio/')) return 'musical-notes-outline';
  if (mime.includes('pdf')) return 'document-text-outline';
  if (mime.includes('sheet') || mime.includes('csv')) return 'grid-outline';
  return 'document-outline';
}

export default function FilesScreen() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const list = useInfiniteQuery({
    queryKey: queryKeys.uploads.infinite(workspaceId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      uploadApi.list(workspaceId, undefined, { cursor: pageParam, limit: 40 }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const upload = async (source: PickSource) => {
    try {
      const file = await pickFile(source);
      if (!file) return;
      setProgress(0);
      await uploadToWorkspace(workspaceId, file, { onProgress: setProgress });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.uploads.all(workspaceId),
      });
    } catch (error) {
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setProgress(null);
    }
  };

  const download = async (file: Upload) => {
    setDownloading(file.id);
    try {
      await downloadWorkspaceUpload(workspaceId, file);
    } catch (error) {
      Alert.alert(
        'Download failed',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setDownloading(null);
    }
  };

  if (list.isPending) return <LoadingState label="Loading files…" />;
  if (list.error)
    return (
      <ErrorState error={list.error} onRetry={() => void list.refetch()} />
    );

  const items = list.data.pages.flatMap((p) => p.items);

  return (
    <FlatList
      data={items}
      keyExtractor={(f) => f.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={Divider}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage)
          void list.fetchNextPage();
      }}
      refreshControl={
        <AppRefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          />
      }
      ListHeaderComponent={
        <Card style={styles.header}>
          <AppText variant="label">Upload to this workspace</AppText>
          <View style={styles.actions}>
            <Button
              label="Camera"
              icon="camera-outline"
              variant="secondary"
              onPress={() => void upload('camera')}
              disabled={progress !== null}
              style={styles.flex}
            />
            <Button
              label="Photos"
              icon="images-outline"
              variant="secondary"
              onPress={() => void upload('library')}
              disabled={progress !== null}
              style={styles.flex}
            />
            <Button
              label="File"
              icon="document-outline"
              variant="secondary"
              onPress={() => void upload('document')}
              disabled={progress !== null}
              style={styles.flex}
            />
          </View>
          {progress !== null ? (
            <View style={styles.progress}>
              <AppText variant="caption">Uploading… {progress}%</AppText>
              <ProgressBar value={progress / 100} />
            </View>
          ) : null}
        </Card>
      }
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} />
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon="folder-open-outline"
          title="No files yet"
          description="Files shared in chat, docs and projects appear here."
        />
      }
      renderItem={({ item }) => (
        <ListRow
          icon={iconFor(item.mimeType)}
          title={item.filename}
          subtitle={`${formatBytes(item.size)} · ${item.uploader.displayName || item.uploader.name} · ${relativeTime(item.createdAt)}`}
          chevron={false}
          right={downloading === item.id ? <ActivityIndicator /> : null}
          onPress={() => void download(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
  },
  header: { marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  progress: { gap: spacing.xs },
  footer: { marginVertical: spacing.lg },
});
