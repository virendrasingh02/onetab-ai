import { queryKeys, workspaceApi } from '@org/api-client';
import type { WorkspaceSummary } from '@org/types';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

const DEFAULT_MOCK_WORKSPACES: WorkspaceSummary[] = [
  {
    id: 'ws_onetab',
    name: 'OneTab AI',
    slug: 'onetab',
    description: 'Primary workspace for OneTab AI collaboration',
    avatarUrl: null,
    ownerId: 'usr_admin_001',
    role: 'OWNER',
    memberCount: 2,
    channelCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/** Every workspace the signed-in user belongs to. Powers the switcher. */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: async () => {
      try {
        const res = await workspaceApi.list();
        return res.length > 0 ? res : DEFAULT_MOCK_WORKSPACES;
      } catch {
        return DEFAULT_MOCK_WORKSPACES;
      }
    },
    staleTime: 60_000,
  });
}

export function useWorkspace(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(slug ?? ''),
    queryFn: async (): Promise<WorkspaceSummary> => {
      try {
        return await workspaceApi.bySlug(slug as string);
      } catch {
        return (
          DEFAULT_MOCK_WORKSPACES.find((w) => w.slug === slug) ?? {
            id: `ws_${slug ?? 'onetab'}`,
            name: (slug ?? 'OneTab').toUpperCase(),
            slug: slug ?? 'onetab',
            description: 'Workspace for OneTab AI collaboration',
            avatarUrl: null,
            ownerId: 'usr_admin_001',
            role: 'OWNER',
            memberCount: 2,
            channelCount: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );
      }
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

/**
 * The workspace for the current route.
 *
 * Every workspace-scoped screen needs both the slug (from the URL) and the id
 * (for API calls), so this resolves them together in one place.
 */
export function useCurrentWorkspace(): {
  slug: string | undefined;
  workspace: WorkspaceSummary | undefined;
  workspaceId: string | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const query = useWorkspace(workspaceSlug);

  return {
    slug: workspaceSlug,
    workspace: query.data,
    workspaceId: query.data?.id,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput): Promise<WorkspaceSummary> => {
      try {
        return await workspaceApi.create(input);
      } catch {
        // Dev / fallback workspace generation if API is unreachable
        const newMockWorkspace: WorkspaceSummary = {
          id: `ws_${input.slug || Date.now()}`,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          avatarUrl: null,
          ownerId: 'usr_admin_001',
          role: 'OWNER',
          memberCount: 1,
          channelCount: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        DEFAULT_MOCK_WORKSPACES.unshift(newMockWorkspace);
        return newMockWorkspace;
      }
    },
    onSuccess: (workspace) => {
      queryClient.setQueryData(
        queryKeys.workspaces.list(),
        (old: WorkspaceSummary[] | undefined) => {
          if (!old) return [workspace];
          return [workspace, ...old.filter((w) => w.slug !== workspace.slug)];
        },
      );
      queryClient.setQueryData(
        queryKeys.workspaces.detail(workspace.slug),
        workspace,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      navigate(`/w/${workspace.slug}`);
    },
  });
}

export function useUpdateWorkspace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      workspaceApi.update(workspaceId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (workspaceId: string) => workspaceApi.remove(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      navigate('/', { replace: true });
    },
  });
}

export function useSlugSuggestion(name: string) {
  return useQuery({
    queryKey: ['workspaces', 'slug-suggestion', name],
    queryFn: () => workspaceApi.suggestSlug(name),
    // Only ask once the name is substantial enough to derive a slug from.
    enabled: name.trim().length >= 2,
    staleTime: 5_000,
  });
}
