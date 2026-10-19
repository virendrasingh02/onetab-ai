import { queryKeys, workspaceApi } from '@org/api-client';
import type { WorkspaceSummary } from '@org/types';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { secureStore } from './secure-store';
import { STORAGE_KEYS } from './session-core';

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary | null;
  /** Non-null whenever `workspace` is — screens read this for API paths. */
  workspaceId: string;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
  selectWorkspace(id: string): void;
  selectWorkspaceBySlug(slug: string): boolean;
  can(permission: string): boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * The active workspace — the mobile equivalent of the web app's `/w/:slug`
 * prefix. Every workspace-scoped call goes through `workspaceId`, and the API
 * enforces membership on each one, so switching here never widens access.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: workspaceApi.list,
  });

  useEffect(() => {
    void secureStore.get(STORAGE_KEYS.workspaceId).then((id) => {
      setSelectedId(id);
      setRestored(true);
    });
  }, []);

  const active = useMemo(
    () =>
      (query.data ?? []).filter(
        (w) => !w.archivedAt && w.membershipStatus !== 'SUSPENDED',
      ),
    [query.data],
  );

  const workspace = useMemo(() => {
    if (!restored || active.length === 0) return null;
    return active.find((w) => w.id === selectedId) ?? active[0] ?? null;
  }, [active, selectedId, restored]);

  const selectWorkspace = useCallback((id: string) => {
    setSelectedId(id);
    void secureStore.set(STORAGE_KEYS.workspaceId, id);
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces: active,
      workspace,
      workspaceId: workspace?.id ?? '',
      isPending: query.isPending || !restored,
      error: query.error,
      refetch: query.refetch,
      selectWorkspace,
      selectWorkspaceBySlug(slug) {
        const match = active.find((w) => w.slug === slug);
        if (match) selectWorkspace(match.id);
        return Boolean(match);
      },
      can(permission) {
        return (workspace?.permissions ?? []).includes(permission as never);
      },
    }),
    [
      active,
      workspace,
      query.isPending,
      query.error,
      query.refetch,
      restored,
      selectWorkspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value)
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>.');
  return value;
}
