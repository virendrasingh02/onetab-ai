import { marketplaceApi, queryKeys } from '@org/api-client';
import type {
  MarketplaceBrowseParams,
  MarketplaceKind,
  PluginManifest,
} from '@org/types';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** Catalog content changes rarely; a minute of staleness costs nothing. */
const CATALOG_STALE_MS = 60_000;

export function useMarketplaceWorkspaceId(): string | undefined {
  return useCurrentWorkspace().workspaceId;
}

export function useStorefronts() {
  return useQuery({
    queryKey: queryKeys.marketplace.storefronts(),
    queryFn: () => marketplaceApi.storefronts(),
    staleTime: Infinity,
  });
}

export function useMarketplaceStats() {
  const workspaceId = useMarketplaceWorkspaceId();
  return useQuery({
    queryKey: queryKeys.marketplace.stats(workspaceId ?? ''),
    queryFn: () => marketplaceApi.stats(workspaceId),
    staleTime: CATALOG_STALE_MS,
  });
}

/**
 * The single browse hook behind every storefront. Filters are serialised into
 * the query key so switching a category or a sort is a separate cache entry
 * rather than a refetch that blanks the grid.
 */
export function useListings(params: MarketplaceBrowseParams) {
  const workspaceId = useMarketplaceWorkspaceId();
  return useQuery({
    queryKey: queryKeys.marketplace.browse(
      workspaceId ?? '',
      JSON.stringify(params),
    ),
    queryFn: () => marketplaceApi.browse(params, workspaceId),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useListing(slug: string | null) {
  const workspaceId = useMarketplaceWorkspaceId();
  return useQuery({
    queryKey: queryKeys.marketplace.listing(slug ?? '', workspaceId ?? ''),
    queryFn: () => marketplaceApi.listing(slug as string, workspaceId),
    enabled: !!slug,
  });
}

export function useCategories(kind: MarketplaceKind) {
  return useQuery({
    queryKey: queryKeys.marketplace.categories(kind),
    queryFn: () => marketplaceApi.categories(kind),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useInstallations(kind?: MarketplaceKind) {
  const workspaceId = useMarketplaceWorkspaceId();
  return useQuery({
    queryKey: queryKeys.marketplace.installations(
      workspaceId ?? '',
      kind ?? 'all',
    ),
    queryFn: () => marketplaceApi.installations(workspaceId as string, kind),
    enabled: !!workspaceId,
  });
}

/**
 * Install, uninstall and enable/disable all invalidate the same subtree: an
 * install changes the badge on the browse grid, the storefront counters and
 * the installed list, and they are cheap enough to refetch together.
 */
function useMarketplaceMutation<TArgs, TResult>(
  mutationFn: (workspaceId: string, args: TArgs) => Promise<TResult>,
) {
  const workspaceId = useMarketplaceWorkspaceId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: TArgs) => mutationFn(workspaceId as string, args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all() });
    },
  });
}

export function useInstallListing() {
  return useMarketplaceMutation(
    (
      workspaceId,
      args: {
        listingSlug: string;
        grantedScopes?: string[];
        settings?: Record<string, unknown>;
      },
    ) => marketplaceApi.install(workspaceId, args),
  );
}

export function useUninstallListing() {
  return useMarketplaceMutation((workspaceId, slug: string) =>
    marketplaceApi.uninstall(workspaceId, slug),
  );
}

export function useSetInstallationEnabled() {
  return useMarketplaceMutation(
    (workspaceId, args: { slug: string; enabled: boolean }) =>
      marketplaceApi.setEnabled(workspaceId, args.slug, args.enabled),
  );
}

export function useAddReview() {
  const workspaceId = useMarketplaceWorkspaceId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      slug: string;
      rating: number;
      title?: string;
      body?: string;
    }) =>
      marketplaceApi.addReview(args.slug, {
        rating: args.rating,
        title: args.title,
        body: args.body,
        workspaceId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all() });
    },
  });
}

// --- Plugin SDK ------------------------------------------------------------

export function usePluginSDK() {
  return useQuery({
    queryKey: queryKeys.marketplace.sdk(),
    queryFn: () => marketplaceApi.sdk(),
    staleTime: Infinity,
  });
}

export function useValidateManifest() {
  return useMutation({
    mutationFn: (manifest: PluginManifest) =>
      marketplaceApi.validateManifest(manifest),
  });
}

export function useRegisterPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { slug: string; manifest: PluginManifest }) =>
      marketplaceApi.registerPlugin(args.slug, args.manifest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.all() });
    },
  });
}
