import Ionicons from '@expo/vector-icons/Ionicons';
import {
  agentInstallApi,
  agentsApi,
  coworkersApi,
  marketplaceApi,
  queryKeys,
} from '@org/api-client';
import type { CoworkerRoster, MarketplaceListing } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ListRow,
  rowDividerInset,
  Screen,
  TextField,
} from '../../../../components/ui';
import { humanize, relativeTime } from '../../../../lib/format';
import { haptics } from '../../../../lib/haptics';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { radius, spacing } from '../../../../theme/tokens';

type AgentSegment = 'coworkers' | 'agents' | 'marketplace';

export default function AgentsTab() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [segment, setSegment] = useState<AgentSegment>('coworkers');
  const [search, setSearch] = useState('');

  // 1. AI Coworkers Roster
  const rosterQuery = useQuery({
    queryKey: ['mobile', 'coworkers-roster', workspaceId],
    queryFn: () =>
      coworkersApi
        .roster(workspaceId)
        .catch(() => ({
          coworkers: [],
          connectableApps: [],
          plan: {
            name: 'Free',
            requestsPerMonth: 0,
            aiRunsThisMonth: 0,
            concurrentExecutions: 1,
            runningNow: 0,
            cpu: 1,
            ramGb: 2,
            maxExecutionTimeMs: 60000,
          },
          generatedAt: new Date().toISOString(),
        } as CoworkerRoster)),
    enabled: Boolean(workspaceId && segment === 'coworkers'),
  });

  // 2. Custom Agents
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(workspaceId),
    queryFn: () => agentsApi.list(workspaceId),
    enabled: Boolean(workspaceId && segment === 'agents'),
  });

  // 3. Marketplace Listings
  const marketplaceQuery = useQuery({
    queryKey: ['mobile', 'marketplace-listings', workspaceId],
    queryFn: () =>
      marketplaceApi
        .browse({ pageSize: 20 }, workspaceId)
        .then((res) => res.items)
        .catch(() => [] as MarketplaceListing[]),
    enabled: Boolean(workspaceId && segment === 'marketplace'),
  });

  // Install Agent Mutation
  const installMutation = useMutation({
    mutationFn: (listing: MarketplaceListing) =>
      agentInstallApi.install(workspaceId, listing.slug, { approvedPermissions: [] }),
    onSuccess: () => {
      haptics.success();
      Alert.alert('Agent installed', 'The agent has been added to your workspace.');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agents.list(workspaceId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['mobile', 'marketplace-listings', workspaceId],
      });
    },
    onError: (err) => {
      haptics.warning();
      Alert.alert('Installation failed', err.message);
    },
  });

  const isRefreshing =
    segment === 'coworkers'
      ? rosterQuery.isRefetching
      : segment === 'agents'
        ? agentsQuery.isRefetching
        : marketplaceQuery.isRefetching;

  const onRefresh = () => {
    if (segment === 'coworkers') void rosterQuery.refetch();
    else if (segment === 'agents') void agentsQuery.refetch();
    else void marketplaceQuery.refetch();
  };

  const coworkers = useMemo(() => {
    let list = rosterQuery.data?.coworkers ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.role && c.role.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [rosterQuery.data?.coworkers, search]);

  const agents = useMemo(() => {
    let list = agentsQuery.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.role && a.role.toLowerCase().includes(q)) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [agentsQuery.data, search]);

  const marketplace = useMemo(() => {
    let list = marketplaceQuery.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.tagline && m.tagline.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [marketplaceQuery.data, search]);

  return (
    <Screen scroll refreshing={isRefreshing} onRefresh={onRefresh}>
      {/* Top Action Pills: Runs & Approvals */}
      <View style={styles.actions}>
        <Button
          label="Runs"
          icon="pulse-outline"
          variant="secondary"
          onPress={() => router.push('/executions')}
          style={styles.actionBtn}
        />
        <Button
          label="Approvals"
          icon="hand-left-outline"
          variant="secondary"
          onPress={() => router.push('/approvals')}
          style={styles.actionBtn}
        />
        <Button
          label="New agent"
          icon="add"
          onPress={() => router.push('/agent/new')}
          style={styles.actionBtn}
        />
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          style={[
            styles.segmentPill,
            segment === 'coworkers' && { backgroundColor: colors.selected },
          ]}
          onPress={() => {
            haptics.selection();
            setSegment('coworkers');
          }}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={segment === 'coworkers' ? colors.primary : colors.subtle}
          />
          <AppText
            style={[
              styles.segmentText,
              { color: segment === 'coworkers' ? colors.primaryText : colors.subtle },
            ]}
          >
            Coworkers
          </AppText>
        </Pressable>

        <Pressable
          style={[
            styles.segmentPill,
            segment === 'agents' && { backgroundColor: colors.selected },
          ]}
          onPress={() => {
            haptics.selection();
            setSegment('agents');
          }}
        >
          <Ionicons
            name="sparkles-outline"
            size={16}
            color={segment === 'agents' ? colors.primary : colors.subtle}
          />
          <AppText
            style={[
              styles.segmentText,
              { color: segment === 'agents' ? colors.primaryText : colors.subtle },
            ]}
          >
            Custom Agents
          </AppText>
        </Pressable>

        <Pressable
          style={[
            styles.segmentPill,
            segment === 'marketplace' && { backgroundColor: colors.selected },
          ]}
          onPress={() => {
            haptics.selection();
            setSegment('marketplace');
          }}
        >
          <Ionicons
            name="compass-outline"
            size={16}
            color={segment === 'marketplace' ? colors.primary : colors.subtle}
          />
          <AppText
            style={[
              styles.segmentText,
              { color: segment === 'marketplace' ? colors.primaryText : colors.subtle },
            ]}
          >
            Marketplace
          </AppText>
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <TextField
          placeholder={`Search ${segment}…`}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Segment 1: AI Coworkers */}
      {segment === 'coworkers' ? (
        rosterQuery.isPending ? (
          <EmptyState icon="hourglass-outline" title="Loading coworkers…" description="" />
        ) : coworkers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No AI coworkers yet"
            description="Coworkers are persistent AI teammates with assigned channels and specialist agents."
          />
        ) : (
          <Card>
            {coworkers.map((c, index) => (
              <View key={c.id}>
                {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  avatar={{ name: c.name, uri: c.avatarUrl }}
                  title={c.name}
                  subtitle={[
                    c.role,
                    c.specialists?.length ? `${c.specialists.length} specialists` : null,
                    c.activity?.runsThisMonth ? `${c.activity.runsThisMonth} runs this mo` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <Badge
                      label={c.status ? humanize(c.status) : 'Available'}
                      tone={c.status === 'AVAILABLE' || !c.status ? 'success' : 'neutral'}
                    />
                  }
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/coworker/[coworkerId]',
                      params: { coworkerId: c.id },
                    });
                  }}
                />
              </View>
            ))}
          </Card>
        )
      ) : null}

      {/* Segment 2: Custom Agents */}
      {segment === 'agents' ? (
        agentsQuery.isPending ? (
          <EmptyState icon="hourglass-outline" title="Loading agents…" description="" />
        ) : agents.length === 0 ? (
          <EmptyState
            icon="sparkles-outline"
            title="No agents created"
            description="Create custom agents or install specialized agents from the Marketplace."
            action={
              <Button
                label="Create an agent"
                icon="add"
                onPress={() => router.push('/agent/new')}
              />
            }
          />
        ) : (
          <Card>
            {agents.map((agent, index) => (
              <View key={agent.id}>
                {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  avatar={{ name: agent.name, uri: agent.avatarUrl }}
                  title={agent.name}
                  subtitle={[
                    agent.role,
                    `${agent._count?.logs ?? 0} runs`,
                    agent.lastActiveAt ? `active ${relativeTime(agent.lastActiveAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <Badge
                      label={agent.isActive ? 'Active' : 'Paused'}
                      tone={agent.isActive ? 'success' : 'warning'}
                    />
                  }
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: '/agent/[agentId]',
                      params: { agentId: agent.id },
                    });
                  }}
                />
              </View>
            ))}
          </Card>
        )
      ) : null}

      {/* Segment 3: Marketplace Discover */}
      {segment === 'marketplace' ? (
        marketplaceQuery.isPending ? (
          <EmptyState icon="hourglass-outline" title="Loading Marketplace…" description="" />
        ) : marketplace.length === 0 ? (
          <EmptyState
            icon="compass-outline"
            title="No listings found"
            description="Discover agents and AI templates published to the catalog."
          />
        ) : (
          <Card>
            {marketplace.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider inset={rowDividerInset} /> : null}
                <ListRow
                  icon="sparkles"
                  title={item.name}
                  subtitle={item.tagline || undefined}
                  right={
                    <Button
                      label="Install"
                      variant="secondary"
                      onPress={() => installMutation.mutate(item)}
                      disabled={installMutation.isPending}
                    />
                  }
                />
              </View>
            ))}
          </Card>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.sm,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrap: {
    marginBottom: spacing.md,
  },
});
