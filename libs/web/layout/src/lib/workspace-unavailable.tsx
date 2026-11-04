import { Button, EmptyState, ErrorState, LoadingState, toast } from '@org/ui';
import {
  isWorkspaceGoneError,
  pickLandingWorkspace,
  useWorkspace,
  useWorkspaces,
  workspaceEntryPath,
} from '@org/web-workspace';
import { Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * What the shell shows when the workspace in the URL did not load.
 *
 * Moving someone to a different workspace is only right when this one is truly
 * gone, so a failed lookup alone never does it: a network blip, a 429 or a 5xx
 * stays on this URL with a retry. A 404 is then checked against a fresh workspace
 * list, because the cached one can predate the removal, and the move is announced
 * rather than silent.
 */
export function WorkspaceUnavailable({ slug }: { slug: string | undefined }) {
  const navigate = useNavigate();
  const workspaceQuery = useWorkspace(slug);
  const workspacesQuery = useWorkspaces();
  const { refetch: refetchWorkspaces } = workspacesQuery;

  const gone = !slug || isWorkspaceGoneError(workspaceQuery.error);

  const [listChecked, setListChecked] = useState(false);
  useEffect(() => {
    if (!gone) return;
    let cancelled = false;
    void refetchWorkspaces().finally(() => {
      if (!cancelled) setListChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [gone, refetchWorkspaces]);

  const workspaces = workspacesQuery.data ?? [];
  // The lookup and the list disagree, or the list could not be trusted: neither
  // proves the workspace is gone, so stay put.
  const inconclusive =
    workspacesQuery.isError || workspaces.some((w) => w.slug === slug);

  const fallback =
    gone && listChecked && !inconclusive
      ? pickLandingWorkspace(workspaces, { excludeSlug: slug })
      : undefined;
  const fallbackName = fallback?.name;
  const fallbackPath = fallback ? workspaceEntryPath(fallback) : undefined;

  useEffect(() => {
    if (!fallbackPath) return;
    toast.info(
      `That workspace is no longer available. Opened ${fallbackName}.`,
      {
        id: 'workspace-unavailable',
      },
    );
    navigate(fallbackPath, { replace: true });
  }, [fallbackPath, fallbackName, navigate]);

  if ((gone && !listChecked) || fallbackPath) {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  if (!gone || inconclusive) {
    return (
      <ErrorState
        fullPage
        title="Could not load this workspace"
        description="Something went wrong reaching the server. Your workspace is safe."
        onRetry={() => workspaceQuery.refetch()}
      />
    );
  }

  return (
    <div className="p-6 grid min-h-full place-items-center">
      <EmptyState
        icon={<Building2 />}
        title="Workspace not found"
        description="It may have been deleted, or you may no longer be a member."
        action={
          <Button asChild variant="outline">
            <Link to="/">Go to your workspaces</Link>
          </Button>
        }
      />
    </div>
  );
}
