import Ionicons from '@expo/vector-icons/Ionicons';
import { matrixApi, memberApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  TextField,
} from '../../../components/ui';
import { openDirectRoom } from '../../../lib/direct-rooms';
import { directRoomsKey, useDirectRooms } from '../../../lib/use-direct-rooms';
import { useMatrixClient } from '../../../lib/use-matrix';
import { useSession } from '../../../lib/session';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { maxContentWidth, spacing } from '../../../theme/tokens';

/**
 * Start a DM (one person) or a group DM (two or more). An existing
 * conversation with exactly those people is reopened rather than duplicated.
 * `?user=<id>` (a web `dms?user=` deep link) opens that person's DM directly.
 */
export default function NewMessageScreen() {
  const { user: linkedUser } = useLocalSearchParams<{ user?: string }>();
  const { workspaceId } = useWorkspace();
  const { user: me } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const matrix = useMatrixClient();
  const rooms = useDirectRooms(matrix.client);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const members = useQuery({
    queryKey: queryKeys.members.list(workspaceId),
    queryFn: () => memberApi.list(workspaceId),
  });

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (members.data ?? []).filter(
      (m) =>
        m.status === 'ACTIVE' &&
        m.user.id !== me?.id &&
        (!needle ||
          m.user.name.toLowerCase().includes(needle) ||
          (m.user.displayName ?? '').toLowerCase().includes(needle)),
    );
  }, [members.data, filter, me?.id]);

  const start = useMutation({
    mutationFn: async (userIds: string[]) => {
      const client = matrix.client;
      if (!client) throw new Error('Chat is not connected.');
      // The id mapping is the server's (and provisions the peer's account).
      const identities = await Promise.all(
        userIds.map((id) => matrixApi.peerIdentity(id)),
      );
      return openDirectRoom(
        client,
        identities.map((i) => i.matrixUserId),
        rooms.data ?? [],
        groupName,
      );
    },
    onSuccess: (roomId) => {
      void queryClient.invalidateQueries({
        queryKey: directRoomsKey(matrix.client?.userId),
      });
      router.replace({ pathname: '/dm/[roomId]', params: { roomId } });
    },
  });

  // A deep link names the person; open their DM once chat is ready.
  const startedLink = useRef(false);
  useEffect(() => {
    if (!linkedUser || startedLink.current) return;
    if (!matrix.client || rooms.isPending) return;
    startedLink.current = true;
    start.mutate([linkedUser]);
  }, [linkedUser, matrix.client, rooms.isPending, start]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  let body;
  if (linkedUser && !start.error) {
    body = <LoadingState label="Opening conversation…" />;
  } else if (members.isPending || matrix.isPending) {
    body = <LoadingState label="Loading people…" />;
  } else if (members.error || matrix.error) {
    body = (
      <ErrorState
        error={members.error ?? matrix.error}
        onRetry={() => {
          void members.refetch();
          void matrix.refetch();
        }}
      />
    );
  } else if (!matrix.client) {
    body = (
      <EmptyState
        icon="chatbubbles-outline"
        title="Chat isn't set up on this server"
        description="Ask your workspace admin to enable messaging."
      />
    );
  } else {
    body = (
      <>
        <FlatList
          data={visible}
          keyExtractor={(m) => m.user.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <TextField
                placeholder="Find people"
                value={filter}
                onChangeText={setFilter}
                accessibilityLabel="Find people"
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {selected.length > 1 ? (
                <TextField
                  label="Group name (optional)"
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={80}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No one found"
              description="Only active members of this workspace are listed."
            />
          }
          renderItem={({ item }) => {
            const on = selected.includes(item.user.id);
            const name = item.user.displayName || item.user.name;
            return (
              <ListRow
                avatar={{ name, uri: item.user.avatarUrl }}
                title={name}
                subtitle={item.user.jobTitle ?? item.user.title ?? null}
                chevron={false}
                onPress={() => toggle(item.user.id)}
                right={
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={on ? colors.primaryText : colors.subtle}
                    accessibilityLabel={on ? 'Selected' : 'Not selected'}
                  />
                }
              />
            );
          }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.footer,
            { borderTopColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {start.error ? (
            <AppText
              variant="caption"
              style={{ color: colors.destructiveText }}
            >
              {start.error.message || 'This conversation could not be opened.'}
            </AppText>
          ) : null}
          <Button
            label={
              selected.length > 1
                ? `Start group (${selected.length + 1} people)`
                : 'Start conversation'
            }
            onPress={() => start.mutate(selected)}
            loading={start.isPending}
            disabled={!selected.length || start.isPending}
          />
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New message' }} />
      {body}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: { paddingVertical: spacing.md, gap: spacing.sm },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
