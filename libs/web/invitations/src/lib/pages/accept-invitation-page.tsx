import { AuthLayout, useAuthStore } from '@org/auth';
import { Button, LoadingState } from '@org/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAcceptInvitation } from '../use-invitations.js';

/**
 * Landing page for an emailed invitation link (`/invite/:token`).
 *
 * Redemption requires a signed-in account, so an anonymous visitor is sent to
 * sign in with the token preserved in the return path.
 */
export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const status = useAuthStore((state) => state.status);
  const accept = useAcceptInvitation();
  const navigate = useNavigate();
  // React 18 StrictMode double-invokes effects; the token is single-use.
  const attempted = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !token || attempted.current) return;
    attempted.current = true;
    accept.mutate(token);
  }, [status, token, accept]);

  if (status === 'idle' || status === 'authenticating') {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: `/invite/${token}` } }}
      />
    );
  }

  if (accept.isPending) {
    return <LoadingState fullPage label="Accepting your invitation…" />;
  }

  if (accept.isSuccess) {
    return (
      <AuthLayout title="You're in" subtitle="Invitation accepted.">
        <div className="gap-4 py-4 flex flex-col items-center text-center">
          <div className="size-11 flex items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-5" />
          </div>
          <Button
            className="w-full"
            onClick={() => navigate(`/w/${accept.data.workspaceSlug}`)}
          >
            Go to workspace
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Invitation unavailable"
      subtitle="This link cannot be used."
    >
      <div className="gap-4 py-4 flex flex-col items-center text-center">
        <div className="size-11 flex items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <XCircle className="size-5" />
        </div>
        <p className="text-sm text-balance text-muted-foreground">
          The invitation may have expired, been revoked, or been sent to a
          different email address than the one you are signed in with.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/')}
        >
          Go to your workspaces
        </Button>
      </div>
    </AuthLayout>
  );
}
