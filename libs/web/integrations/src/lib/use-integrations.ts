import { integrationsApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Connected third-party providers.
 *
 * The rows carry status and config only — the API never sends the stored
 * access token to the browser, so the UI can show "connected" but never the
 * credential itself.
 */
export function useIntegrations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useIntegrationMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.integrations.all(workspaceId ?? ''),
    });

  const connect = useMutation({
    mutationFn: ({
      provider,
      accessToken,
      config,
    }: {
      provider: string;
      accessToken?: string;
      config?: Record<string, unknown>;
    }) =>
      integrationsApi.connect(workspaceId as string, provider, {
        accessToken,
        config,
      }),
    onSuccess: invalidate,
  });

  const disconnect = useMutation({
    mutationFn: (provider: string) =>
      integrationsApi.disconnect(workspaceId as string, provider),
    onSuccess: invalidate,
  });

  const importSlack = useMutation({
    mutationFn: (
      channels: Array<{ name: string; topic?: string; messagesCount: number }>,
    ) => integrationsApi.importSlack(workspaceId as string, channels),
    // An import creates channels, so the channel list is stale as well.
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['channels', workspaceId] });
    },
  });

  const importNotion = useMutation({
    mutationFn: (pages: Array<{ title: string; content: string }>) =>
      integrationsApi.importNotion(workspaceId as string, pages),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['work-tools', workspaceId] });
    },
  });

  return { connect, disconnect, importSlack, importNotion };
}
