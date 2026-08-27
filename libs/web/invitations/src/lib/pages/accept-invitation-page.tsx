import { AuthLayout, useAuthStore, useCurrentUser } from '@org/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LoadingState,
  UserAvatar,
} from '@org/ui';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Hash,
  LogOut,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitationPreview,
} from '../use-invitations.js';

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((s) => s.status);
  const clearSession = useAuthStore((s) => s.clear);
  const currentUser = useCurrentUser();

  const previewQuery = useInvitationPreview(token);
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const [declined, setDeclined] = useState(false);

  const preview = previewQuery.data;

  // Auto-redirect if user already accepted in this session
  useEffect(() => {
    if (acceptMutation.isSuccess && acceptMutation.data) {
      const destination = acceptMutation.data.channelSlug
        ? `/w/${acceptMutation.data.workspaceSlug}/c/${acceptMutation.data.channelSlug}`
        : `/w/${acceptMutation.data.workspaceSlug}`;
      const timer = setTimeout(() => navigate(destination), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [acceptMutation.isSuccess, acceptMutation.data, navigate]);

  const handleAccept = () => {
    if (!token) return;
    acceptMutation.mutate(token);
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      await declineMutation.mutateAsync(token);
      setDeclined(true);
    } catch {
      // Handled
    }
  };

  const handleSwitchAccount = () => {
    clearSession();
    navigate('/login', {
      state: {
        from: { pathname: `/invite/${token}` },
        email: preview?.email ?? undefined,
      },
    });
  };

  // 1. Loading state
  if (
    authStatus === 'idle' ||
    authStatus === 'authenticating' ||
    previewQuery.isLoading
  ) {
    return <LoadingState fullPage label="Validating your invitation…" />;
  }

  // 2. Invitation not found, expired, or invalid
  if (previewQuery.isError || !preview || !preview.valid) {
    const isExpired = preview?.status === 'EXPIRED';
    const isRevoked = preview?.status === 'REVOKED';

    return (
      <AuthLayout
        title={isExpired ? 'Invitation Expired' : isRevoked ? 'Invitation Revoked' : 'Invalid Invitation'}
        subtitle={
          isExpired
            ? 'This invitation link has expired.'
            : isRevoked
            ? 'This invitation was revoked by the sender.'
            : 'This invitation link is no longer valid or has already been used.'
        }
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <div className="size-12 flex items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-6" />
          </div>
          <p className="text-xs text-muted-foreground text-balance">
            Please reach out to the workspace administrator or the person who sent this invite to request a new one.
          </p>
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => navigate('/')}
          >
            Go to workspaces
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 3. User declined
  if (declined) {
    return (
      <AuthLayout
        title="Invitation Declined"
        subtitle="You have declined this workspace invitation."
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <p className="text-xs text-muted-foreground">
            You will not receive further notifications regarding this invitation.
          </p>
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => navigate('/')}
          >
            Go to home
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 4. Accepted successfully
  if (acceptMutation.isSuccess && acceptMutation.data) {
    const destination = acceptMutation.data.channelSlug
      ? `/w/${acceptMutation.data.workspaceSlug}/c/${acceptMutation.data.channelSlug}`
      : `/w/${acceptMutation.data.workspaceSlug}`;

    return (
      <AuthLayout
        title="You're in!"
        subtitle={`Welcome to ${preview.workspace.name}.`}
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <div className="size-14 flex items-center justify-center rounded-full bg-success/15 text-success animate-bounce">
            <CheckCircle2 className="size-8" />
          </div>
          <p className="text-xs text-muted-foreground">
            Redirecting you to your workspace…
          </p>
          <Button
            className="w-full font-semibold"
            onClick={() => navigate(destination)}
          >
            Enter Workspace <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Email mismatch check
  const isAuthenticated = authStatus === 'authenticated';
  const hasEmailMismatch =
    isAuthenticated &&
    preview.email &&
    currentUser?.email &&
    preview.email.toLowerCase() !== currentUser.email.toLowerCase();

  return (
    <AuthLayout
      title={`Join ${preview.workspace.name}`}
      subtitle={`${preview.inviter.displayName ?? preview.inviter.name} has invited you to collaborate.`}
    >
      <div className="space-y-4 py-2">
        {/* Invitation Preview Card */}
        <Card className="border-border bg-surface shadow-xs">
          <CardHeader className="p-4 pb-3 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl border border-border bg-surface-raised flex items-center justify-center text-primary font-bold text-base shadow-2xs">
                {preview.workspace.avatarUrl ? (
                  <img
                    src={preview.workspace.avatarUrl}
                    alt={preview.workspace.name}
                    className="size-full rounded-xl object-cover"
                  />
                ) : (
                  <Building2 className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold truncate">
                  {preview.workspace.name}
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span>Role:</span>
                  <Badge variant="neutral" className="text-[10px] px-1.5 py-0 capitalize">
                    {preview.role.toLowerCase()}
                  </Badge>
                  {preview.channel && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <Hash className="size-3 text-muted-foreground" />
                        {preview.channel.name}
                      </span>
                    </>
                  )}
                </CardDescription>
              </div>
            </div>

            {/* Inviter Info */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <UserAvatar
                name={preview.inviter.displayName ?? preview.inviter.name}
                src={preview.inviter.avatarUrl}
                seed={preview.inviter.id}
                className="size-5"
              />
              <span>
                Invited by <strong className="text-foreground">{preview.inviter.displayName ?? preview.inviter.name}</strong>
              </span>
            </div>
          </CardHeader>

          {preview.message && (
            <CardContent className="px-4 pb-3 pt-0">
              <div className="rounded-lg border border-border/80 bg-background/80 p-2.5 text-xs italic text-muted-foreground">
                &ldquo;{preview.message}&rdquo;
              </div>
            </CardContent>
          )}
        </Card>

        {/* Email Mismatch Notice */}
        {hasEmailMismatch && (
          <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-accent-amber font-semibold">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <span>Account Notice</span>
                <p className="font-normal text-[11px] text-muted-foreground mt-0.5">
                  You are signed in as <strong className="text-foreground">{currentUser?.email}</strong>, but this invitation was sent to <strong className="text-foreground">{preview.email}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleSwitchAccount}
                className="text-xs"
              >
                <LogOut className="size-3 mr-1" />
                Switch Account
              </Button>
            </div>
          </div>
        )}

        {/* Actions based on Authentication State */}
        {isAuthenticated ? (
          <div className="space-y-2 pt-2">
            <Button
              className="w-full font-semibold"
              onClick={handleAccept}
              loading={acceptMutation.isPending}
              leadingIcon={<CheckCircle2 className="size-4" />}
            >
              Accept Invitation
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={handleDecline}
              loading={declineMutation.isPending}
            >
              Decline
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-2">
            <p className="text-xs text-center text-muted-foreground">
              Sign in or create an account to accept this invitation.
            </p>
            <Button
              className="w-full font-semibold"
              onClick={() =>
                navigate('/register', {
                  state: {
                    from: { pathname: `/invite/${token}` },
                    email: preview.email ?? undefined,
                  },
                })
              }
            >
              Create Account to Join
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={() =>
                navigate('/login', {
                  state: {
                    from: { pathname: `/invite/${token}` },
                    email: preview.email ?? undefined,
                  },
                })
              }
            >
              Sign In to Existing Account
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
