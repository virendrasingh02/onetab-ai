import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, queryKeys } from '@org/api-client';
import type {
  MarketplaceBrowseParams,
  MarketplaceCategoryCount,
  MarketplaceInstallation,
  MarketplaceKind,
  MarketplaceListingDetail,
  MarketplacePage,
  MarketplaceStorefrontStat,
} from '@org/types';
import { toast } from '@org/ui';

export function useMarketplaceBrowse(
  params: MarketplaceBrowseParams,
  workspaceId?: string,
) {
  const queryKey = queryKeys.marketplace.browse(
    workspaceId ?? 'global',
    JSON.stringify(params),
  );

  return useQuery<MarketplacePage>({
    queryKey,
    queryFn: () => marketplaceApi.browse(params, workspaceId),
    staleTime: 30_000,
  });
}

export function useMarketplaceListing(slug: string, workspaceId?: string) {
  return useQuery<MarketplaceListingDetail>({
    queryKey: queryKeys.marketplace.listing(slug, workspaceId ?? 'global'),
    queryFn: () => marketplaceApi.listing(slug, workspaceId),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
}

export function useMarketplaceCategories(kind: MarketplaceKind) {
  return useQuery<MarketplaceCategoryCount[]>({
    queryKey: queryKeys.marketplace.categories(kind),
    queryFn: () => marketplaceApi.categories(kind),
    staleTime: 60_000,
  });
}

export function useMarketplaceStats(workspaceId: string) {
  return useQuery<MarketplaceStorefrontStat[]>({
    queryKey: queryKeys.marketplace.stats(workspaceId),
    queryFn: () => marketplaceApi.stats(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useMarketplaceInstallations(
  workspaceId: string,
  kind?: MarketplaceKind,
) {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: queryKeys.marketplace.installations(workspaceId, kind ?? 'ALL'),
    queryFn: () => marketplaceApi.installations(workspaceId, kind),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
  });
}

export function useMarketplaceApprovals(workspaceId: string) {
  return useQuery<MarketplaceInstallation[]>({
    queryKey: queryKeys.marketplace.approvals(workspaceId),
    queryFn: () => marketplaceApi.approvals(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
  });
}

export function useMarketplaceMutations(workspaceId: string) {
  const queryClient = useQueryClient();

  const invalidateMarketplace = () => {
    queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    queryClient.invalidateQueries({
      queryKey: queryKeys.marketplace.installations(workspaceId, 'ALL'),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.marketplace.approvals(workspaceId),
    });
  };

  const install = useMutation({
    mutationFn: (input: {
      listingSlug: string;
      grantedScopes?: string[];
      settings?: Record<string, unknown>;
    }) => marketplaceApi.install(workspaceId, input),
    onSuccess: () => {
      invalidateMarketplace();
      toast.success('Successfully installed!');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || 'Failed to install application or agent',
      );
    },
  });

  const uninstall = useMutation({
    mutationFn: (slug: string) => marketplaceApi.uninstall(workspaceId, slug),
    onSuccess: () => {
      invalidateMarketplace();
      toast.success('Uninstalled successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to uninstall');
    },
  });

  const setEnabled = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      marketplaceApi.setEnabled(workspaceId, slug, enabled),
    onSuccess: (_, variables) => {
      invalidateMarketplace();
      toast.success(variables.enabled ? 'Enabled' : 'Disabled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const updateSettings = useMutation({
    mutationFn: ({
      slug,
      settings,
    }: {
      slug: string;
      settings: Record<string, unknown>;
    }) => marketplaceApi.updateSettings(workspaceId, slug, settings),
    onSuccess: () => {
      invalidateMarketplace();
      toast.success('Configuration saved');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || 'Failed to save configuration',
      );
    },
  });

  const requestAccess = useMutation({
    mutationFn: ({ slug, reason }: { slug: string; reason: string }) =>
      marketplaceApi.requestAccess(workspaceId, slug, { reason }),
    onSuccess: () => {
      invalidateMarketplace();
      toast.success('Access request submitted to workspace admins');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to request access');
    },
  });

  const resolveApproval = useMutation({
    mutationFn: ({
      slug,
      action,
      rejectionReason,
    }: {
      slug: string;
      action: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
    }) =>
      marketplaceApi.resolveApproval(workspaceId, slug, {
        action,
        rejectionReason,
      }),
    onSuccess: (_, variables) => {
      invalidateMarketplace();
      toast.success(
        variables.action === 'APPROVE'
          ? 'Access request approved'
          : 'Access request rejected',
      );
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to resolve request');
    },
  });

  const publishCustom = useMutation({
    mutationFn: (input: {
      kind: MarketplaceKind;
      name: string;
      slug: string;
      tagline?: string;
      description?: string;
      category?: string;
      version?: string;
      iconUrl?: string;
      capabilities?: string[];
      permissions?: Array<{ scope: string; name: string; level: string; description: string }>;
      commands?: Array<{ command: string; description: string; args?: string }>;
      examplePrompts?: string[];
      manifest?: Record<string, unknown>;
    }) =>
      marketplaceApi.publishCustom({
        kind: input.kind,
        name: input.name,
        slug: input.slug,
        tagline: input.tagline,
        description: input.description,
        category: input.category || 'Developer Tools',
        version: input.version,
        iconUrl: input.iconUrl,
        capabilities: input.capabilities || (input.manifest as any)?.capabilities,
        permissions: input.permissions || (input.manifest as any)?.permissions,
        commands: input.commands || (input.manifest as any)?.commands,
        examplePrompts: input.examplePrompts || (input.manifest as any)?.examplePrompts,
      }),
    onSuccess: () => {
      invalidateMarketplace();
      toast.success('Custom listing published to marketplace');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to publish listing');
    },
  });

  return {
    install,
    uninstall,
    setEnabled,
    updateSettings,
    requestAccess,
    resolveApproval,
    publishCustom,
  };
}
