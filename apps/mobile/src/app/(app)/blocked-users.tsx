import { queryKeys, safetyApi } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ListRow,
  QueryBoundary,
  Screen,
} from '../../components/ui';
import { Alert } from '../../lib/alert';

export default function BlockedUsersScreen() {
  const queryClient = useQueryClient();
  const blocks = useQuery({
    queryKey: queryKeys.safety.blocks(),
    queryFn: () => safetyApi.blocks(),
  });
  const unblock = useMutation({
    mutationFn: (userId: string) => safetyApi.unblock(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.safety.blocks() }),
    onError: (error) => Alert.alert('Could not unblock', error.message),
  });

  return (
    <Screen
      refreshing={blocks.isRefetching}
      onRefresh={() => void blocks.refetch()}
    >
      <QueryBoundary query={blocks} loadingLabel="Loading…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title="Nobody blocked"
              description="Press and hold a message to report or block its sender."
            />
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {list.map((block, index) => (
                <View key={block.userId}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    title={block.name}
                    chevron={false}
                    right={
                      <Button
                        label="Unblock"
                        variant="ghost"
                        onPress={() => unblock.mutate(block.userId)}
                      />
                    }
                  />
                </View>
              ))}
            </Card>
          )
        }
      </QueryBoundary>
    </Screen>
  );
}
