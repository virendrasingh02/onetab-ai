import { marketplaceApi, queryKeys } from '@org/api-client';
import type {
  MarketplaceBrowseParams,
  MarketplaceKind,
  PluginManifest,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Catalogue administration for the admin console.
 *
 * Every call here is workspace-free. That is the whole difference from the
 * version these hooks grew out of: the console browses and curates the
 * catalogue itself — what exists, who published it, how often it is installed
 * across the platform — while *installing* something is a workspace act that
 * belongs to the web app, where a workspace is in scope.
 *
 * Concretely, the install/uninstall/enable/review hooks are gone rather than
 * ported: they all addressed `/marketplace/workspaces/:id/installations`, and
 * `scope:admin` cannot reach `@org/web-workspace` to resolve that id.
 */

/** Catalog content changes rarely; a minute of staleness costs nothing. */
const CATALOG_STALE_MS = 60_000;

export function useStorefronts() {
  return useQuery({
    queryKey: queryKeys.marketplace.storefronts(),
    queryFn: () => marketplaceApi.storefronts(),
    staleTime: Infinity,
  });
}

/**
 * Platform-wide counts. Without a workspace the API leaves `installedHere` at
 * zero and still reports `installCount` — installs across every workspace —
 * which is the number the console wants anyway.
 */
export function useMarketplaceStats() {
  return useQuery({
    queryKey: queryKeys.marketplace.stats(''),
    queryFn: () => marketplaceApi.stats(),
    staleTime: CATALOG_STALE_MS,
  });
}

/**
 * The single browse hook behind every storefront. Filters are serialised into
 * the query key so switching a category or a sort is a separate cache entry
 * rather than a refetch that blanks the grid.
 */
export function useListings(params: MarketplaceBrowseParams) {
  return useQuery({
    queryKey: queryKeys.marketplace.browse('', JSON.stringify(params)),
    queryFn: () => marketplaceApi.browse(params),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useListing(slug: string | null) {
  return useQuery({
    queryKey: queryKeys.marketplace.listing(slug ?? '', ''),
    queryFn: () => marketplaceApi.listing(slug as string),
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
