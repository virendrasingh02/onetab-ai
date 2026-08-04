import { queryKeys, workspaceApi } from '@org/api-client';
import type { WorkspaceSummary } from '@org/types';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '@org/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

/** Every workspace the signed-in user belongs to. Powers the switcher. */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceApi.list(),
    staleTime: 60_000,
  });
}

export function useWorkspace(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(slug ?? ''),
    queryFn: () => workspaceApi.bySlug(slug as string),
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
    mutationFn: (input: CreateWorkspaceInput) => workspaceApi.create(input),
    onSuccess: (workspace) => {
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
