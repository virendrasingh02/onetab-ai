import {
  agentDeploymentsApi,
  agentsApi,
  ApiError,
  http,
  queryKeys,
} from '@org/api-client';
import type {
  AgentDeploymentAnalyticsSummary,
  AgentDeploymentEnvironment,
  AgentDeploymentView,
  AgentSecurityConfig,
  AgentVersion,
  AgentWidgetConfig,
} from '@org/types';
import { toast } from '@org/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useStudioSession } from '../../../session-guard.js';

/** These mutations report their own errors, so the app-wide error toast stays quiet. */
const QUIET = { disableToast: true } as const;

export const errorMessage = (err: unknown, fallback = 'Something went wrong.'): string =>
  err instanceof ApiError || err instanceof Error ? err.message || fallback : fallback;

/** The API base Studio talks to, including the version prefix: what an embed on another site must call. */
export function apiBase(): string {
  const base = http.defaults.baseURL;
  return (base && /^https?:/i.test(base) ? base : `${window.location.origin}/api/v1`).replace(/\/+$/, '');
}

/** The windows the deployment's run statistics can be read over. */
export const ANALYTICS_PERIODS = ['24h', '7d', '30d', '90d'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

/** Versions of the agent that can actually be put live: published snapshots, not the unsaved draft. */
export function publishableVersions(versions: AgentVersion[] | undefined): AgentVersion[] {
  return (versions ?? []).filter((v) => v.status !== 'DRAFT' && !/draft/i.test(v.versionTag ?? ''));
}

/**
 * Everything the Deploy tab reads and changes, against the platform API. Each
 * mutation reports its own outcome, and a failure shows the server's message
 * rather than a generic one.
 */
export function useDeployment(agentId: string) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();

  const deploymentsKey = queryKeys.agents.deployments(workspaceId, agentId);

  const deploymentsQuery = useQuery({
    queryKey: deploymentsKey,
    queryFn: () => agentDeploymentsApi.list(workspaceId, agentId),
    enabled: !!workspaceId && !!agentId,
  });

  const deployment: AgentDeploymentView | undefined = useMemo(() => {
    const list = deploymentsQuery.data ?? [];
    return list.find((d) => d.status === 'ACTIVE') ?? list[0];
  }, [deploymentsQuery.data]);

  const deploymentId = deployment?.id ?? '';

  const versionsQuery = useQuery({
    queryKey: queryKeys.agents.versions(workspaceId, agentId),
    queryFn: () => agentsApi.getVersions(workspaceId, agentId),
    enabled: !!workspaceId && !!agentId,
  });

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('7d');
  const analyticsQuery = useQuery<AgentDeploymentAnalyticsSummary>({
    queryKey: [...queryKeys.agents.deploymentAnalytics(workspaceId, agentId, deploymentId), analyticsPeriod],
    queryFn: () => agentDeploymentsApi.analytics(workspaceId, agentId, deploymentId, analyticsPeriod),
    enabled: !!deploymentId,
    // Live traffic keeps arriving while the page is open; switching the window keeps the old figures until the new ones land.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  const webhooksKey = queryKeys.agents.deploymentWebhooks(workspaceId, agentId, deploymentId);
  const webhooksQuery = useQuery({
    queryKey: webhooksKey,
    queryFn: () => agentDeploymentsApi.listWebhooks(workspaceId, agentId, deploymentId),
    enabled: !!deploymentId,
  });

  const refreshDeployments = () => queryClient.invalidateQueries({ queryKey: deploymentsKey });
  const requireDeployment = (): string => {
    if (!deploymentId) throw new Error('There is no deployment yet.');
    return deploymentId;
  };

  const create = useMutation({
    meta: QUIET,
    mutationFn: (input: { name: string; widgetConfig?: AgentWidgetConfig; securityConfig?: AgentSecurityConfig }) =>
      agentDeploymentsApi.create(workspaceId, agentId, {
        name: input.name,
        environment: 'PRODUCTION',
        target: 'WIDGET',
        allowedOrigins: [],
        widgetConfig: input.widgetConfig ?? {},
        securityConfig: input.securityConfig ?? {},
      }),
    onSuccess: () => {
      void refreshDeployments();
      toast.success('Deployment created');
    },
    onError: (e) => toast.error('Could not create the deployment', { description: errorMessage(e) }),
  });

  const update = useMutation({
    meta: QUIET,
    mutationFn: (patch: {
      name?: string;
      environment?: AgentDeploymentEnvironment;
      allowedOrigins?: string[];
      widgetConfig?: AgentWidgetConfig;
      securityConfig?: AgentSecurityConfig;
    }) => agentDeploymentsApi.update(workspaceId, agentId, requireDeployment(), patch),
    onSuccess: () => void refreshDeployments(),
    onError: (e) => toast.error('Could not save', { description: errorMessage(e) }),
  });

  const publish = useMutation({
    meta: QUIET,
    mutationFn: async (input: { versionNumber: number; environment?: AgentDeploymentEnvironment }) => {
      const id = requireDeployment();
      if (input.environment && input.environment !== deployment?.environment) {
        await agentDeploymentsApi.update(workspaceId, agentId, id, { environment: input.environment });
      }
      return agentDeploymentsApi.publish(workspaceId, agentId, id, input.versionNumber);
    },
    onSuccess: (view) => {
      void refreshDeployments();
      toast.success(`v${view.versionNumber} is live in ${view.environment.toLowerCase()}`);
    },
    onError: (e) => toast.error('Could not publish', { description: errorMessage(e) }),
  });

  const rollback = useMutation({
    meta: QUIET,
    mutationFn: (input: { versionNumber: number; summary?: string }) =>
      agentDeploymentsApi.rollback(workspaceId, agentId, requireDeployment(), input.versionNumber, input.summary),
    onSuccess: (view) => {
      void refreshDeployments();
      toast.success(`Rolled back to v${view.versionNumber}`);
    },
    onError: (e) => toast.error('Could not roll back', { description: errorMessage(e) }),
  });

  const setStatus = useMutation({
    meta: QUIET,
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED') =>
      agentDeploymentsApi.suspend(workspaceId, agentId, requireDeployment(), status),
    onSuccess: (view) => {
      void refreshDeployments();
      toast.success(view.status === 'SUSPENDED' ? 'Deployment suspended: embeds and API calls are refused' : 'Deployment is live again');
    },
    onError: (e) => toast.error('Could not change the status', { description: errorMessage(e) }),
  });

  const remove = useMutation({
    meta: QUIET,
    mutationFn: () => agentDeploymentsApi.delete(workspaceId, agentId, requireDeployment()),
    onSuccess: () => {
      void refreshDeployments();
      toast.success('Deployment deleted: its embeds and API keys stop working');
    },
    onError: (e) => toast.error('Could not delete the deployment', { description: errorMessage(e) }),
  });

  const createSnapshot = useMutation({
    meta: QUIET,
    mutationFn: (summary?: string) => agentsApi.createVersion(workspaceId, agentId, summary),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.versions(workspaceId, agentId) });
      toast.success('Snapshot saved');
    },
    onError: (e) => toast.error('Could not save a snapshot', { description: errorMessage(e) }),
  });

  const createWebhook = useMutation({
    meta: QUIET,
    mutationFn: (input: { url: string; secret?: string; events?: string[] }) =>
      agentDeploymentsApi.createWebhook(workspaceId, agentId, requireDeployment(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhooksKey });
      toast.success('Webhook added');
    },
    onError: (e) => toast.error('Could not add the webhook', { description: errorMessage(e) }),
  });

  const deleteWebhook = useMutation({
    meta: QUIET,
    mutationFn: (webhookId: string) => agentDeploymentsApi.deleteWebhook(workspaceId, agentId, requireDeployment(), webhookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhooksKey });
      toast.success('Webhook removed');
    },
    onError: (e) => toast.error('Could not remove the webhook', { description: errorMessage(e) }),
  });

  const testWebhook = useMutation({
    meta: QUIET,
    mutationFn: (webhookId: string) => agentDeploymentsApi.testWebhook(workspaceId, agentId, requireDeployment(), webhookId),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: webhooksKey });
      if (delivery.status === 'SUCCESS') toast.success(`Delivered (HTTP ${delivery.statusCode ?? 200}) in ${delivery.latencyMs} ms`);
      else toast.error('Delivery failed', { description: delivery.error ?? `HTTP ${delivery.statusCode ?? 'error'} after ${delivery.attempts} attempts` });
    },
    onError: (e) => toast.error('Could not send the test event', { description: errorMessage(e) }),
  });

  return {
    workspaceId,
    deploymentsQuery,
    deployment,
    versionsQuery,
    analyticsQuery,
    analyticsPeriod,
    setAnalyticsPeriod,
    webhooksQuery,
    create,
    update,
    publish,
    rollback,
    setStatus,
    remove,
    createSnapshot,
    createWebhook,
    deleteWebhook,
    testWebhook,
  };
}

export type DeploymentApi = ReturnType<typeof useDeployment>;
