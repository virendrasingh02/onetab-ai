import { EmptyState, Button, ErrorState, LoadingState } from '@org/ui';
import { useWorkspaces } from '../use-workspaces.js';
import { Building2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

/**
 * Resolves the bare "/" route.
 *
 * A signed-in user lands on their first workspace; a brand-new account with
 * none is sent to onboarding rather than an empty shell.
 */
export function WorkspaceRedirect() {
  const workspaces = useWorkspaces();
  const navigate = useNavigate();

  // Same label the shell uses on the other side of the redirect, so the two
  // loads read as one wait rather than two spinners in a row.
  if (workspaces.isLoading) {
    return <LoadingState fullPage label="Loading your workspace…" />;
  }

  // "We could not load your workspaces" and "you have none yet" look identical
  // from `data`, and telling a member their workspaces are gone is the worse
  // of the two mistakes — so a failed load must not fall through to onboarding.
  if (workspaces.isError) {
    return (
      <ErrorState
        fullPage
        title="Could not load your workspaces"
        description="Something went wrong reaching the server. Your workspaces are safe."
        onRetry={() => workspaces.refetch()}
      />
    );
  }

  const first = workspaces.data?.[0];
  if (first) return <Navigate to={`/w/${first.slug}`} replace />;

  return (
    <div className="p-6 grid min-h-full place-items-center">
      <EmptyState
        size="lg"
        icon={<Building2 />}
        title="Create your first workspace"
        description="Workspaces hold your channels, members and files. You can create more at any time."
        action={
          <Button onClick={() => navigate('/workspaces/new')}>
            Create a workspace
          </Button>
        }
      />
    </div>
  );
}
