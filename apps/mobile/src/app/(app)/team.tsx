import { coworkersApi, memberApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  AppText,
  Badge,
  Card,
  Divider,
  ListRow,
  QueryBoundary,
  Screen,
  SectionHeader,
  TextField,
} from '../../components/ui';
import { humanize, relativeTime } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';

/**
 * People and AI coworkers in the workspace. Role changes and removals stay on
 * the web, where the admin confirmations and audit trail live.
 */
export default function TeamScreen() {
  const { workspaceId } = useWorkspace();
  const [filter, setFilter] = useState('');

  const members = useQuery({
    queryKey: queryKeys.members.list(workspaceId),
    queryFn: () => memberApi.list(workspaceId),
  });
  const coworkers = useQuery({
    queryKey: queryKeys.coworkers.list(workspaceId),
    queryFn: () => coworkersApi.list(workspaceId),
  });

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (members.data ?? []).filter(
      (m) =>
        !needle ||
        m.user.name.toLowerCase().includes(needle) ||
        (m.user.displayName ?? '').toLowerCase().includes(needle) ||
        (m.email ?? '').toLowerCase().includes(needle),
    );
  }, [members.data, filter]);

  return (
    <Screen
      refreshing={members.isRefetching}
      onRefresh={() =>
        void Promise.all([members.refetch(), coworkers.refetch()])
      }
    >
      <SectionHeader title="AI coworkers" />
      <QueryBoundary query={coworkers}>
        {(list) => (
          <Card style={{ paddingVertical: 4 }}>
            {list.length === 0 ? (
              <AppText variant="muted">No AI coworkers yet.</AppText>
            ) : (
              list.map((c, index) => (
                <View key={c.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    avatar={{ name: c.name, uri: c.avatarUrl }}
                    title={c.name}
                    subtitle={`${c.role} · ${c._count.channelLinks} channels · ${c._count.executionLogs} runs`}
                    right={
                      <Badge
                        label={c.isActive ? 'Active' : 'Paused'}
                        tone={c.isActive ? 'success' : 'warning'}
                      />
                    }
                  />
                </View>
              ))
            )}
          </Card>
        )}
      </QueryBoundary>

      <SectionHeader
        title={`Members${members.data ? ` · ${members.data.length}` : ''}`}
      />
      <TextField
        placeholder="Search people"
        value={filter}
        onChangeText={setFilter}
        autoCapitalize="none"
        accessibilityLabel="Search people"
      />
      <QueryBoundary query={members}>
        {() => (
          <Card style={{ paddingVertical: 4 }}>
            {visible.map((m, index) => (
              <View key={m.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  avatar={{ name: m.user.name, uri: m.user.avatarUrl }}
                  title={m.user.displayName || m.user.name}
                  subtitle={[
                    m.user.jobTitle,
                    m.email,
                    m.lastActiveAt
                      ? `active ${relativeTime(m.lastActiveAt)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <Badge
                      label={humanize(m.role)}
                      tone={m.status === 'ACTIVE' ? 'neutral' : 'warning'}
                    />
                  }
                />
              </View>
            ))}
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}
