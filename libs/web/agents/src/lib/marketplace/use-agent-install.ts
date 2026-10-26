import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentInstallApi, queryKeys } from '@org/api-client';
import type {
  AgentAuditEntry,
  AgentInstallPreview,
  AgentInstallRequest,
  AgentInstallResult,
  MarketplaceInstallation,
} from '@org/types';
import { toast } from '@org/ui';

/** Structured failure the install API returns (`code` is what the UI branches on). */
export interface AgentInstallError {
  code: string;
  message: string;
  /** Per-field problems for `INVALID_CONFIG`. */
  fields?: Record<string, string>;
  /** Permissions that still need approval for `PERMISSION_APPROVAL_REQUIRED`. */
  permissions?: Array<{ id: string; label: string; description: string; sensitive: boolean }>;
  retryable?: boolean;
  rolledBack?: boolean;
}

export function toAgentInstallError(err: unknown): AgentInstallError {
  const data = (err as { response?: { data?: Partial<AgentInstallError> } })?.response?.data;
  return {
    code: data?.code ?? 'UNKNOWN',
    message: data?.message ?? (err instanceof Error ? err.message : 'Something went wrong.'),
    fields: data?.fields,
    permissions: data?.permissions,
    retryable: data?.retryable,
    rolledBack: data?.rolledBack,
  };
}

/** Fields the shared installed/approval views read, derived from the API shape. */
export function normalizeInstallation(row: MarketplaceInstallation): MarketplaceInstallation {
  const request = row.approvalRequest;
  return {
    ...row,
    listingSlug: row.listingSlug ?? row.listing?.slug,
    name: row.name ?? row.listing?.name,
    kind: row.kind ?? row.listing?.kind,
    iconUrl: row.iconUrl ?? row.listing?.iconUrl,
    enabled: row.enabled ?? row.status === 'ACTIVE',
    approvalStatus: row.approvalStatus ?? request?.status,
    requestReason: row.requestReason ?? request?.reason,
    requestedBy: row.requestedBy ?? request?.requestedBy,
    requesterName: row.requesterName ?? request?.requestedByName,
  };
}

export function useAgentInstallPreview(workspaceId: string, slug: string | undefined, enabled = true) {
  return useQuery<AgentInstallPreview>({
    queryKey: queryKeys.marketplace.agentPreview(workspaceId, slug ?? ''),
    queryFn: () => agentInstallApi.preview(workspaceId, slug as string),
    enabled: enabled && Boolean(workspaceId && slug),
    staleTime: 0,
  });
}

export function useAgentInstalls(workspaceId: string) {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: queryKeys.marketplace.agentInstalls(workspaceId),
    queryFn: () => agentInstallApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    // An install or update in flight changes state on the server; follow it.
    refetchInterval: (query) =>
      query.state.data?.some((i) => i.status === 'INSTALLING' || i.status === 'UPDATING') ? 2_000 : false,
    select: (rows) => rows.map(normalizeInstallation),
  });
}

export function useAgentApprovals(workspaceId: string, enabled: boolean) {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: queryKeys.marketplace.agentApprovals(workspaceId),
    queryFn: () => agentInstallApi.approvals(workspaceId),
    enabled: enabled && Boolean(workspaceId),
    staleTime: 10_000,
    select: (rows) => rows.map(normalizeInstallation),
  });
}

export function useAgentAudit(workspaceId: string, enabled: boolean) {
  return useQuery<AgentAuditEntry[]>({
    queryKey: queryKeys.marketplace.agentAudit(workspaceId),
    queryFn: () => agentInstallApi.audit(workspaceId),
    enabled: enabled && Boolean(workspaceId),
    staleTime: 15_000,
  });
}

/**
 * Lifecycle mutations. None are optimistic: every cache refresh happens after
 * the server answered, so the UI never shows an install that is not complete.
 * Errors are rethrown to the caller (the dialog renders them inline).
 */
export function useAgentInstallMutations(workspaceId: string) {
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    // The sidebar's agent list and chat pickers read this.
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.all(workspaceId) });
  };

  const failToast = (err: unknown) => toast.error(toAgentInstallError(err).message);

  const install = useMutation<AgentInstallResult, unknown, { slug: string; input: AgentInstallRequest }>({
    mutationFn: ({ slug, input }) => agentInstallApi.install(workspaceId, slug, input),
    onSettled: refresh,
  });

  const requestApproval = useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: AgentInstallRequest }) =>
      agentInstallApi.requestApproval(workspaceId, slug, input),
    onSuccess: () => toast.success('Request sent to workspace admins'),
    onSettled: refresh,
  });

  const resolve = useMutation({
    mutationFn: ({
      slug,
      input,
    }: {
      slug: string;
      input: AgentInstallRequest & { action: 'APPROVE' | 'REJECT'; rejectionReason?: string };
    }) => agentInstallApi.resolve(workspaceId, slug, input),
    onSuccess: (_r, v) => toast.success(v.input.action === 'APPROVE' ? 'Agent approved and installed' : 'Request rejected'),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: Pick<AgentInstallRequest, 'settings' | 'approvedPermissions'> }) =>
      agentInstallApi.update(workspaceId, slug, input),
    onSuccess: () => toast.success('Agent updated'),
    onError: failToast,
    onSettled: refresh,
  });

  const setEnabled = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      agentInstallApi.setEnabled(workspaceId, slug, enabled),
    onSuccess: (_r, v) => toast.success(v.enabled ? 'Agent enabled' : 'Agent disabled'),
    onError: failToast,
    onSettled: refresh,
  });

  const updateAccess = useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: Pick<AgentInstallRequest, 'scope' | 'access'> }) =>
      agentInstallApi.updateAccess(workspaceId, slug, input),
    onSuccess: () => toast.success('Access updated'),
    onError: failToast,
    onSettled: refresh,
  });

  const checkHealth = useMutation({
    mutationFn: (slug: string) => agentInstallApi.health(workspaceId, slug),
    onError: failToast,
    onSettled: refresh,
  });

  const uninstall = useMutation({
    mutationFn: ({ slug, purge }: { slug: string; purge?: boolean }) =>
      agentInstallApi.uninstall(workspaceId, slug, { purge }),
    onSuccess: (r) => toast.success(r.purged ? 'Agent and its data removed' : 'Agent uninstalled'),
    onError: failToast,
    onSettled: refresh,
  });

  return { install, requestApproval, resolve, update, setEnabled, updateAccess, checkHealth, uninstall };
}
