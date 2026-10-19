import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, ListRow, Screen } from '../../components/ui';
import { humanize } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { useTheme } from '../../theme/theme';

export default function WorkspacesScreen() {
  const { workspaces, workspace, selectWorkspace } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  return (
    <Screen>
      <Card style={{ paddingVertical: 4 }}>
        {workspaces.map((w, index) => (
          <View key={w.id}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              avatar={{ name: w.name, uri: w.avatarUrl }}
              title={w.name}
              subtitle={`${humanize(w.role)} · ${w.memberCount} members`}
              chevron={false}
              right={
                w.id === workspace?.id ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primaryText}
                  />
                ) : null
              }
              onPress={() => {
                if (w.id !== workspace?.id) {
                  selectWorkspace(w.id);
                  // Drop the previous workspace's cached screens so nothing leaks across.
                  queryClient.removeQueries({
                    predicate: (q) => q.queryKey.includes(workspace?.id ?? ''),
                  });
                }
                router.back();
              }}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
