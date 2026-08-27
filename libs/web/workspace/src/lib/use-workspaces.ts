import { invitationApi, queryKeys, workspaceApi } from '@org/api-client';
import { WorkspaceRole, type WorkspacePermission, type WorkspaceSummary } from '@org/types';
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '@org/validation';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkspaceStore } from './workspace.store.js';

/**
 * Every workspace the signed-in user belongs to. Powers the switcher.
 *
 * An empty list is a real answer — a brand-new account genuinely has no
 * workspaces, and the UI routes that case to the create-workspace screen.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceApi.list(),
    staleTime: 60_000,
    // Hold the last list through any refetch so `AppShell`'s boot gate never
    // sees `data: undefined` again after the first load.
    placeholderData: keepPreviousData,
  });
}

export function useWorkspace(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(slug ?? ''),
    queryFn: (): Promise<WorkspaceSummary> =>
      workspaceApi.bySlug(slug as string),
    enabled: !!slug,
    staleTime: 30_000,
    // The API returns 404 both for a workspace that does not exist and for one
    // the user cannot see. Neither improves on a retry.
    retry: false,
    // Keep the current workspace on screen across a slug change or a refetch,
    // so switching pages never blanks the shell to "Loading your workspace…".
    placeholderData: keepPreviousData,
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
  activeMembershipEmail: string | undefined;
  role: WorkspaceRole | undefined;
  permissions: readonly WorkspacePermission[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const query = useWorkspace(workspaceSlug);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  useEffect(() => {
    if (query.data) {
      setActiveWorkspace(query.data);
    }
  }, [query.data, setActiveWorkspace]);

  return {
    slug: workspaceSlug,
    workspace: query.data,
    workspaceId: query.data?.id,
    activeMembershipEmail: query.data?.email ?? undefined,
    role: query.data?.role,
    permissions: query.data?.permissions,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: CreateWorkspaceInput): Promise<WorkspaceSummary> =>
      workspaceApi.create(input),
    onSuccess: (workspace) => {
      primeWorkspaceCaches(queryClient, workspace);
      navigate(`/w/${workspace.slug}`);
    },
  });
}

export interface CreateWorkspaceFlowInput extends CreateWorkspaceInput {
  /** Optional logo, uploaded once the workspace exists to own it. */
  logo?: File | null;
  /** Optional invitations, sent as OWNER after creation. Empty means "skip". */
  invites?: string[];
}

export interface CreateWorkspaceFlowResult {
  workspace: WorkspaceSummary;
  /** Non-fatal problems from the steps that follow creation. */
  warnings: string[];
}

/**
 * The whole create-workspace wizard as one call: workspace, then logo, then
 * invitations.
 *
 * They cannot collapse into a single request — the logo and the invitations
 * both need a workspace id to attach to. Only the first step is fatal: once the
 * workspace exists, a failed logo or a failed invite is worth reporting but not
 * worth discarding the workspace over, so those surface as warnings and the
 * user lands in a workspace either way.
 */
export function useCreateWorkspaceFlow() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({
      logo,
      invites,
      ...input
    }: CreateWorkspaceFlowInput): Promise<CreateWorkspaceFlowResult> => {
      let workspace = await workspaceApi.create(input);
      const warnings: string[] = [];

      if (logo) {
        try {
          const updated = await workspaceApi.uploadLogo(workspace.id, logo);
          workspace = { ...workspace, avatarUrl: updated.avatarUrl };
        } catch {
          warnings.push(
            'The logo could not be uploaded. You can add it from workspace settings.',
          );
        }
      }

      const emails = invites?.filter(Boolean) ?? [];
      if (emails.length > 0) {
        try {
          await invitationApi.create(workspace.id, {
            emails,
            role: WorkspaceRole.MEMBER,
          });
        } catch {
          warnings.push(
            'The invitations could not be sent. You can invite people from workspace settings.',
          );
        }
      }

      return { workspace, warnings };
    },
    onSuccess: ({ workspace, warnings }) => {
      primeWorkspaceCaches(queryClient, workspace);
      // With warnings, the page holds the user long enough to read them and
      // offers the same jump behind a button.
      if (warnings.length === 0) navigate(`/w/${workspace.slug}`);
    },
  });
}

/** Makes a freshly created workspace visible before its list refetch lands. */
function primeWorkspaceCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  workspace: WorkspaceSummary,
): void {
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

/**
 * Archives or restores the workspace.
 *
 * Both directions are one hook because they are one control in the UI, and
 * both invalidate the same thing: `status` rides on every workspace payload,
 * and the screens that gate writes on it need the fresh value immediately.
 *
 * Account-scoped caches are dropped too — everything already fetched was
 * fetched under the old status, and a board still offering an "Add task"
 * button after freezing would be lying to the user.
 */
export function useSetWorkspaceArchived(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (archived: boolean) =>
      archived
        ? workspaceApi.archive(workspaceId as string)
        : workspaceApi.restore(workspaceId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.members.all(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.workTools.all(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.channels.all(workspaceId),
        });
      }
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

export function useTransferOwnership(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      workspaceApi.transferOwnership(workspaceId as string, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.members.all(workspaceId ?? ''),
      });
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

