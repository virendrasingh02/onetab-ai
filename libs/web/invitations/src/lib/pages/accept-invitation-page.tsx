import {
  AuthLayout,
  useAccounts,
  useAuthStore,
  useCurrentUser,
  useSwitchAccount,
} from '@org/auth';
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
  LogIn,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitationPreview,
  useIsWorkspaceMember,
} from '../use-invitations.js';

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useCurrentUser();
  const { accounts } = useAccounts();
  const switchAccount = useSwitchAccount();

  const previewQuery = useInvitationPreview(token);
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const [declined, setDeclined] = useState(false);

  const preview = previewQuery.data;
  const isAuthenticated = authStatus === 'authenticated';

  /** Router state that carries the invitation through login / sign-up and back. */
  const authState = useMemo(
    () => ({
      from: { pathname: `/invite/${token ?? ''}` },
      email: preview?.email ?? undefined,
    }),
    [token, preview?.email],
  );

  const membership = useIsWorkspaceMember(
    preview?.workspace.id,
    isAuthenticated,
  );

  const emailMismatch =
    isAuthenticated &&
    !!preview?.email &&
    !!currentUser?.email &&
    preview.email.toLowerCase() !== currentUser.email.toLowerCase();

  const acceptDestination = acceptMutation.data
    ? acceptMutation.data.channelSlug
      ? `/w/${acceptMutation.data.workspaceSlug}/c/${acceptMutation.data.channelSlug}`
      : `/w/${acceptMutation.data.workspaceSlug}`
    : null;

  // Redirect once acceptance (or an idempotent "already a member" result) lands.
  useEffect(() => {
    if (!acceptDestination) return undefined;
    const timer = setTimeout(() => navigate(acceptDestination), 1200);
    return () => clearTimeout(timer);
  }, [acceptDestination, navigate]);

  const handleAccept = () => {
    if (token) acceptMutation.mutate(token);
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      await declineMutation.mutateAsync(token);
      setDeclined(true);
    } catch {
      // Rendered below.
    }
  };

  // 1. Still resolving the session or the invitation.
  if (
    authStatus === 'idle' ||
    authStatus === 'authenticating' ||
    previewQuery.isLoading
  ) {
    return <LoadingState fullPage label="Validating your invitation…" />;
  }

  // 2. Accepted (or was already a member) — confirmation, then redirect.
  if (acceptMutation.isSuccess && acceptDestination) {
    return (
      <AuthLayout
        title={
          acceptMutation.data?.alreadyMember
            ? "You're already in"
            : "You're in!"
        }
        subtitle={
          preview
            ? `Opening ${preview.workspace.name}…`
            : 'Opening your workspace…'
        }
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <div className="size-14 flex items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-8" />
          </div>
          <Button
            className="w-full font-semibold"
            onClick={() => navigate(acceptDestination)}
          >
            Open workspace <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 3. Declined.
  if (declined) {
    return (
      <AuthLayout
        title="Invitation declined"
        subtitle="You have declined this workspace invitation."
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => navigate('/')}
          >
            Go to your workspaces
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 4. Already a member — nothing to accept, just open it.
  if (
    isAuthenticated &&
    !emailMismatch &&
    membership.isResolved &&
    membership.isMember &&
    preview
  ) {
    return (
      <AuthLayout
        title="You're already a member"
        subtitle={`You already have access to ${preview.workspace.name}.`}
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <div className="size-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </div>
          <Button
            className="w-full font-semibold"
            onClick={() => navigate(`/w/${preview.workspace.slug}`)}
          >
            Open workspace <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 5. Invitation not usable: invalid / expired / revoked.
  if (previewQuery.isError || !preview || !preview.valid) {
    const status = preview?.status;
    const title =
      status === 'EXPIRED'
        ? 'This invitation has expired'
        : status === 'REVOKED'
        ? 'This invitation is no longer available'
        : 'This invitation link is invalid';
    const body =
      status === 'EXPIRED'
        ? 'Ask the workspace administrator to send a new invitation.'
        : status === 'REVOKED'
        ? 'The person who invited you withdrew this invitation.'
        : 'This invitation link is invalid or no longer exists.';

    return (
      <AuthLayout title={title} subtitle={body}>
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <div className="size-12 flex items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-6" />
          </div>
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => navigate('/')}
          >
            Go to your workspaces
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const invitationCard = (
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
              <Badge
                variant="neutral"
                className="text-[10px] px-1.5 py-0 capitalize"
              >
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

        <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          <UserAvatar
            name={preview.inviter.displayName ?? preview.inviter.name}
            src={preview.inviter.avatarUrl}
            seed={preview.inviter.id}
            className="size-5"
          />
          <span>
            Invited by{' '}
            <strong className="text-foreground">
              {preview.inviter.displayName ?? preview.inviter.name}
            </strong>
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
  );

  // 6. Signed in with the wrong account.
  if (emailMismatch) {
    const matchingAccounts = accounts.filter(
      (a) =>
        a.user.email.toLowerCase() === preview.email?.toLowerCase() &&
        a.id !== currentUser?.id,
    );

    return (
      <AuthLayout
        title={`Join ${preview.workspace.name}`}
        subtitle="This invitation was sent to a different account."
      >
        <div className="space-y-4 py-2">
          {invitationCard}

          <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3 space-y-1.5 text-xs">
            <div className="flex items-start gap-2 text-accent-amber font-semibold">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>Wrong account</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              This invitation was sent to{' '}
              <strong className="text-foreground">{preview.email}</strong>. You
              are signed in as{' '}
              <strong className="text-foreground">{currentUser?.email}</strong>.
            </p>
          </div>

          <div className="space-y-2">
            {matchingAccounts.map((account) => (
              <Button
                key={account.id}
                variant="outline"
                className="w-full justify-start gap-2 text-xs"
                loading={
                  switchAccount.isPending &&
                  (switchAccount.variables as { accountId?: string })
                    ?.accountId === account.id
                }
                onClick={() =>
                  switchAccount.mutate({
                    accountId: account.id,
                    to: `/invite/${token}`,
                  })
                }
              >
                <UserAvatar
                  name={account.user.displayName ?? account.user.name}
                  src={account.user.avatarUrl}
                  seed={account.id}
                  indicator={false}
                  className="size-4"
                />
                Switch to {account.user.email}
              </Button>
            ))}

            <Button
              className="w-full gap-2 font-semibold"
              onClick={() => navigate('/login', { state: authState })}
            >
              <LogIn className="size-4" />
              Sign in as {preview.email}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 text-xs"
              onClick={() => navigate('/login', { state: authState })}
            >
              <UserPlus className="size-3.5" />
              Add another account
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate('/')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 7. Valid — ready to accept (authenticated) or authenticate first.
  return (
    <AuthLayout
      title={`Join ${preview.workspace.name}`}
      subtitle={`${
        preview.inviter.displayName ?? preview.inviter.name
      } has invited you to collaborate.`}
    >
      <div className="space-y-4 py-2">
        {invitationCard}

        {isAuthenticated ? (
          <div className="space-y-2 pt-2">
            <Button
              className="w-full font-semibold"
              onClick={handleAccept}
              loading={acceptMutation.isPending}
              leadingIcon={<CheckCircle2 className="size-4" />}
            >
              Accept invitation
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
              Log in or sign up to accept this invitation.
            </p>
            <Button
              className="w-full font-semibold gap-2"
              onClick={() => navigate('/login', { state: authState })}
            >
              <LogIn className="size-4" />
              Log in
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs gap-2"
              onClick={() => navigate('/register', { state: authState })}
            >
              <UserPlus className="size-3.5" />
              Sign up
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
