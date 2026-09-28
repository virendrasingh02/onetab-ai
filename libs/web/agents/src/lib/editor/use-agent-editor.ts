import { agentsApi, aiExecutionsApi, queryKeys } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The server's message for a failed request, or a generic fallback. */
export function errorText(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; fieldErrors?: unknown };
    // Publish validation sends its reasons as a list in `errors`.
    const details = Array.isArray(e.fieldErrors)
      ? (e.fieldErrors as unknown[]).map(String)
      : e.fieldErrors && typeof e.fieldErrors === 'object'
        ? Object.values(e.fieldErrors as Record<string, string[]>).flat()
        : [];
    if (details.length) return details.join(' ');
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return 'Something went wrong. Try again.';
}

export function useAgentDetail(workspaceId: string | undefined, agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.detail(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.get(workspaceId as string, agentId as string),
    enabled: Boolean(workspaceId && agentId),
  });
}

export function useAgentVersions(workspaceId: string | undefined, agentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agents.versions(workspaceId ?? '', agentId ?? ''),
    queryFn: () => agentsApi.getVersions(workspaceId as string, agentId as string),
    enabled: Boolean(workspaceId && agentId && enabled),
  });
}

/** This agent's runs from the unified run history. */
export function useAgentRuns(workspaceId: string | undefined, agentId: string | undefined, enabled = true) {
  const filters = { entityId: agentId, limit: 50 };
  return useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId ?? '', filters),
    queryFn: () => aiExecutionsApi.list(workspaceId as string, filters),
    enabled: Boolean(workspaceId && agentId && enabled),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'RUNNING') ? 4_000 : false),
  });
}

/**
 * Every write the agent editor makes. Each one refreshes the agent itself, the
 * agent lists (sidebar, directory) and the AI Workspace overview, so the rest
 * of the app never shows a stale name or status.
 */
export function useAgentEditorMutations(workspaceId: string | undefined, agentId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = workspaceId ?? '';
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all(ws) }),
      queryClient.invalidateQueries({ queryKey: ['ai-entities', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.aiStudio.overview(ws) }),
    ]);

  const save = useMutation({
    mutationFn: (input: { name: string; role?: string; graphJson: string }) =>
      agentId ? agentsApi.update(ws, agentId, input) : agentsApi.create(ws, input),
    onSuccess: (agent) => {
      for (const warning of agent.warnings ?? []) toast.warning(warning);
      void refresh();
    },
  });

  const publish = useMutation({
    mutationFn: (summary?: string) => agentsApi.publish(ws, agentId as string, summary),
    onSuccess: () => {
      toast.success('Published', { description: 'A new version was recorded.' });
      void refresh();
    },
  });

  const unpublish = useMutation({
    mutationFn: () => agentsApi.unpublish(ws, agentId as string),
    onSuccess: () => {
      toast.success('Moved back to draft');
      void refresh();
    },
    onError: (err) => toast.error('Could not unpublish', { description: errorText(err) }),
  });

  const snapshot = useMutation({
    mutationFn: (summary?: string) => agentsApi.createVersion(ws, agentId as string, summary),
    onSuccess: () => {
      toast.success('Version saved');
      void refresh();
    },
    onError: (err) => toast.error('Could not save a version', { description: errorText(err) }),
  });

  const restore = useMutation({
    mutationFn: (version: number) => agentsApi.restoreVersion(ws, agentId as string, version),
    onSuccess: (_res, version) => {
      toast.success(`Restored version ${version}`);
      void refresh();
    },
    onError: (err) => toast.error('Could not restore that version', { description: errorText(err) }),
  });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => agentsApi.update(ws, agentId as string, { isActive }),
    onSuccess: (_agent, isActive) => {
      toast.success(isActive ? 'Agent turned on' : 'Agent paused', {
        description: isActive ? undefined : 'It won’t answer, run on schedules or be callable until turned back on.',
      });
      void refresh();
    },
    onError: (err) => toast.error('Could not change that', { description: errorText(err) }),
  });

  const updateSettings = useMutation({
    mutationFn: (input: { welcomeMessage?: string; description?: string }) =>
      agentsApi.update(ws, agentId as string, input),
    onSuccess: () => {
      toast.success('Settings saved');
      void refresh();
    },
    onError: (err) => toast.error('Could not save settings', { description: errorText(err) }),
  });

  const remove = useMutation({
    mutationFn: () => agentsApi.remove(ws, agentId as string),
    onSuccess: () => {
      toast.success('Agent deleted');
      void refresh();
    },
    onError: (err) => toast.error('Could not delete the agent', { description: errorText(err) }),
  });

  const testRun = useMutation({
    mutationFn: (message: string) => agentsApi.testRun(ws, agentId as string, { message }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiExecutions.all(ws) });
    },
    onError: (err) => toast.error('The test run could not start', { description: errorText(err) }),
  });

  return { save, publish, unpublish, snapshot, restore, setActive, updateSettings, remove, testRun };
}
