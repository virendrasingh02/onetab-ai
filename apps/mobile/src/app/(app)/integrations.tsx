import { connectorsApi, integrationsApi, queryKeys } from '@org/api-client';
import type { ConnectorConnection, ConnectorSummary } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  QueryBoundary,
  Screen,
  SectionHeader,
  TextField,
} from '../../components/ui';
import { webLink } from '../../lib/config';
import { humanize, relativeTime } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { spacing } from '../../theme/tokens';

const STATUS_TONE = {
  connected: 'success',
  needs_attention: 'warning',
  not_connected: 'neutral',
  unavailable: 'neutral',
} as const;

/**
 * Every connector the API knows about (Slack, WhatsApp, Shopify, WordPress,
 * Google, GitHub, …) with its live connection state. Syncing and disconnecting
 * happen here; connecting needs the provider's OAuth consent or credential
 * form, which runs in the web app.
 */
export default function IntegrationsScreen() {
  const { workspaceId, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const connectors = useQuery({
    queryKey: [...queryKeys.integrations.all(workspaceId), 'connectors'],
    queryFn: () => connectorsApi.list(workspaceId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.all(workspaceId),
    });

  const sync = useMutation({
    mutationFn: (id: string) => integrationsApi.sync(workspaceId, id),
    onSuccess: (res) => {
      void invalidate();
      Alert.alert('Sync started', res.message);
    },
    onError: (error) => Alert.alert('Sync failed', error.message),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => integrationsApi.disconnect(workspaceId, id),
    onSuccess: () => void invalidate(),
    onError: (error) => Alert.alert('Could not disconnect', error.message),
  });

  const confirmDisconnect = (
    connector: ConnectorSummary,
    connection: ConnectorConnection,
  ) =>
    Alert.alert(
      `Disconnect ${connector.name}?`,
      'Agents and automations using this connection stop working until it is reconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect.mutate(connection.id),
        },
      ],
    );

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = (connectors.data ?? []).filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.category.toLowerCase().includes(needle),
    );
    return {
      connected: list.filter(
        (c) => c.status === 'connected' || c.status === 'needs_attention',
      ),
      available: list.filter((c) => c.status === 'not_connected'),
      unavailable: list.filter((c) => c.status === 'unavailable'),
    };
  }, [connectors.data, filter]);

  const openWeb = () =>
    void WebBrowser.openBrowserAsync(webLink(workspace?.slug, 'integrations'));

  return (
    <Screen
      refreshing={connectors.isRefetching}
      onRefresh={() => void connectors.refetch()}
    >
      <TextField
        placeholder="Search integrations"
        value={filter}
        onChangeText={setFilter}
        autoCapitalize="none"
        accessibilityLabel="Search integrations"
      />
      <QueryBoundary query={connectors} loadingLabel="Loading integrations…">
        {() => (
          <>
            <SectionHeader title={`Connected · ${groups.connected.length}`} />
            {groups.connected.length === 0 ? (
              <EmptyState
                icon="extension-puzzle-outline"
                title="Nothing connected yet"
              />
            ) : (
              groups.connected.map((connector) => (
                <Card key={connector.provider}>
                  <View style={styles.header}>
                    <AppText variant="heading">{connector.name}</AppText>
                    <Badge
                      label={humanize(connector.status)}
                      tone={STATUS_TONE[connector.status]}
                    />
                  </View>
                  <AppText variant="caption">
                    {humanize(connector.category)} · {connector.counts.actions}{' '}
                    actions · {connector.counts.triggers} triggers
                  </AppText>
                  {connector.connections.map((connection) => (
                    <View key={connection.id} style={styles.connection}>
                      <AppText variant="body">
                        {connection.accountName ||
                          connection.accountEmail ||
                          connection.displayName ||
                          'Connected account'}
                      </AppText>
                      <AppText variant="caption">
                        {humanize(connection.scopeType)} · last sync{' '}
                        {relativeTime(connection.lastSyncAt)}
                      </AppText>
                      {connection.lastErrorMessage ? (
                        <AppText variant="caption" style={styles.error}>
                          {connection.lastErrorMessage}
                        </AppText>
                      ) : null}
                      {connection.mine ? (
                        <View style={styles.actions}>
                          {connector.supports.sync ? (
                            <Button
                              label="Sync now"
                              variant="secondary"
                              icon="sync-outline"
                              onPress={() => sync.mutate(connection.id)}
                              loading={
                                sync.isPending &&
                                sync.variables === connection.id
                              }
                              style={styles.flex}
                            />
                          ) : null}
                          <Button
                            label="Disconnect"
                            variant="ghost"
                            onPress={() =>
                              confirmDisconnect(connector, connection)
                            }
                            loading={
                              disconnect.isPending &&
                              disconnect.variables === connection.id
                            }
                            style={styles.flex}
                          />
                        </View>
                      ) : null}
                    </View>
                  ))}
                </Card>
              ))
            )}

            <SectionHeader title={`Available · ${groups.available.length}`} />
            <Card>
              <AppText variant="muted">
                Connecting an app opens its sign-in or credential form, which
                runs in the Onetab AI web app.
              </AppText>
              <AppText variant="body">
                {groups.available.map((c) => c.name).join(', ') || 'None'}
              </AppText>
              <Button
                label="Connect on the web"
                icon="open-outline"
                variant="secondary"
                onPress={openWeb}
              />
            </Card>

            {groups.unavailable.length ? (
              <>
                <SectionHeader title="Not configured on this server" />
                <AppText variant="caption">
                  {groups.unavailable.map((c) => c.name).join(', ')}
                </AppText>
              </>
            ) : null}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  connection: { gap: 2, paddingTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  error: { color: '#c40011' },
});
