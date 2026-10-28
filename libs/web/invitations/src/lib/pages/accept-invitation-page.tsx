import { ApiError, resolveMediaUrl, toApiError } from '@org/api-client';
import {
  AuthLayout,
  useAccounts,
  useAuthStore,
  useCurrentUser,
  useLogout,
  useSwitchAccount,
} from '@org/auth';
import type { InvitationPublicPreview } from '@org/types';
import {
  Badge,
  Button,
  FormError,
  LoadingState,
  UserAvatar,
  WorkspaceAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FolderKanban,
  Hash,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  UserPlus,
  Users,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInvitationPreview,
  useIsWorkspaceMember,
} from '../use-invitations.js';

function errorText(error: unknown): string | null {
  return error ? toApiError(error).message : null;
}

function inviterName(preview: InvitationPublicPreview): string {
  return preview.inviter.displayName ?? preview.inviter.name;
}

/** Round status glyph above a terminal state's actions. */
function StatusIcon({
  tone,
  children,
}: {
  tone: 'success' | 'primary' | 'destructive' | 'muted';
  children: ReactNode;
}) {
  const toneClass = {
    success: 'bg-success/15 text-success',
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <div
      className={`size-12 flex items-center justify-center rounded-full ${toneClass}`}
    >
      {children}
    </div>
  );
}

/** What the invitation grants: workspace, role, and any channel/team/project scope. */
function InvitationCard({ preview }: { preview: InvitationPublicPreview }) {
  const name = inviterName(preview);
  const scopes = [
    preview.channel && {
      key: 'channel',
      icon: <Hash className="size-3" />,
      label: preview.channel.name,
    },
    preview.team && {
      key: 'team',
      icon: <Users className="size-3" />,
      label: preview.team.name,
    },
    preview.project && {
      key: 'project',
      icon: <FolderKanban className="size-3" />,
      label: preview.project.name,
    },
  ].filter(Boolean) as { key: string; icon: ReactNode; label: string }[];

  return (
    <div className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="p-4 flex items-center gap-3">
        {/* The preview's logo URL is API-relative; resolve it before loading. */}
        <WorkspaceAvatar
          name={preview.workspace.name}
          src={resolveMediaUrl(preview.workspace.avatarUrl)}
          icon={preview.workspace.icon}
          iconColor={preview.workspace.iconColor}
          avatarColor={preview.workspace.avatarColor}
          seed={preview.workspace.id}
          size="lg"
          className="shrink-0 shadow-2xs"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {preview.workspace.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge
              variant="neutral"
              className="text-[10px] px-1.5 py-0 capitalize"
            >
              {preview.role.toLowerCase()}
            </Badge>
            {scopes.map((scope) => (
              <span
                key={scope.key}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-px text-foreground"
              >
                {scope.icon}
                <span className="truncate max-w-[10rem]">{scope.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {preview.message && (
        <div className="px-4 pb-3">
          <p className="rounded-lg border border-border/80 bg-background/80 p-2.5 text-xs italic text-muted-foreground">
            &ldquo;{preview.message}&rdquo;
          </p>
        </div>
      )}

      <dl className="px-4 py-3 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={name}
            src={preview.inviter.avatarUrl}
            seed={preview.inviter.id}
            indicator={false}
            className="size-4"
          />
          <dt className="sr-only">Invited by</dt>
          <dd>
            Invited by <strong className="text-foreground">{name}</strong>
          </dd>
        </div>
        {preview.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-4 shrink-0" aria-hidden />
            <dt className="sr-only">Sent to</dt>
            <dd className="truncate">
              Sent to{' '}
              <strong className="text-foreground">{preview.email}</strong>
            </dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">Expires</dt>
          <dd>
            Expires{' '}
            <time dateTime={preview.expiresAt}>
              {formatRelative(preview.expiresAt)}
            </time>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useCurrentUser();
  const { accounts } = useAccounts();
  const switchAccount = useSwitchAccount();
  const logout = useLogout();

  const previewQuery = useInvitationPreview(token);
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const [declined, setDeclined] = useState(false);

  const preview = previewQuery.data;
  const isAuthenticated = authStatus === 'authenticated';
  const invitePath = `/invite/${token ?? ''}`;

  /** Router state that carries the invitation through login / sign-up and back. */
  const authState = useMemo(
    () => ({
      from: { pathname: invitePath },
      email: preview?.email ?? undefined,
    }),
    [invitePath, preview?.email],
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
    const timer = setTimeout(
      () => navigate(acceptDestination, { replace: true }),
      1200,
    );
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
      // Rendered through <FormError>.
    }
  };

  const goHome = (
    <Button
      variant="outline"
      className="w-full text-xs"
      onClick={() => navigate('/')}
    >
      {isAuthenticated ? 'Go to your workspaces' : 'Go to sign in'}
    </Button>
  );

  // 1. Still resolving the session or the invitation.
  if (
    authStatus === 'idle' ||
    authStatus === 'authenticating' ||
    previewQuery.isLoading
  ) {
    return <LoadingState fullPage label="Checking your invitation…" />;
  }

  // 2. Accepted (or was already a member) — confirmation, then redirect.
  if (acceptMutation.isSuccess && acceptDestination) {
    return (
      <AuthLayout
        title={
          acceptMutation.data?.alreadyMember ? "You're already in" : "You're in!"
        }
        subtitle={
          preview
            ? `Taking you to ${
                preview.channel
                  ? `#${preview.channel.name} in ${preview.workspace.name}`
                  : preview.workspace.name
              }…`
            : 'Opening your workspace…'
        }
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <StatusIcon tone="success">
            <CheckCircle2 className="size-7" />
          </StatusIcon>
          <Button
            className="w-full font-semibold"
            onClick={() => navigate(acceptDestination, { replace: true })}
          >
            Open now <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 3. Declined just now.
  if (declined) {
    return (
      <AuthLayout
        title="Invitation declined"
        subtitle={
          preview
            ? `You won't be added to ${preview.workspace.name}. Ask ${inviterName(preview)} for a new invite if you change your mind.`
            : 'You have declined this workspace invitation.'
        }
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <StatusIcon tone="muted">
            <XCircle className="size-6" />
          </StatusIcon>
          {goHome}
        </div>
      </AuthLayout>
    );
  }

  // 4. Couldn't reach the server — distinct from a bad link, and retryable.
  const previewError = previewQuery.error;
  const isNotFound =
    previewError instanceof ApiError && previewError.status < 500;
  if (previewQuery.isError && !isNotFound) {
    return (
      <AuthLayout
        title="We couldn't load this invitation"
        subtitle="Check your connection and try again."
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <StatusIcon tone="muted">
            <WifiOff className="size-6" />
          </StatusIcon>
          <Button
            className="w-full font-semibold"
            onClick={() => previewQuery.refetch()}
            loading={previewQuery.isFetching}
            leadingIcon={<RefreshCw className="size-4" />}
          >
            Try again
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 5. Already a member with nothing left to grant — just open it. A
  //    channel-scoped invite still has something to do (join the channel), so
  //    it falls through to the accept step instead.
  if (
    isAuthenticated &&
    !emailMismatch &&
    membership.isResolved &&
    membership.isMember &&
    preview &&
    !(preview.valid && preview.channel)
  ) {
    return (
      <AuthLayout
        title="You're already a member"
        subtitle={`You already have access to ${preview.workspace.name}.`}
      >
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <StatusIcon tone="primary">
            <Building2 className="size-6" />
          </StatusIcon>
          <Button
            className="w-full font-semibold"
            onClick={() => navigate(`/w/${preview.workspace.slug}`)}
          >
            Open {preview.workspace.name}{' '}
            <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // 6. Invitation not usable: unknown / expired / revoked / used / declined.
  if (previewQuery.isError || !preview || !preview.valid) {
    const status = preview?.status;
    const copy: Record<string, { title: string; body: string }> = {
      EXPIRED: {
        title: 'This invitation has expired',
        body: preview
          ? `Ask ${inviterName(preview)} to send you a new invitation to ${preview.workspace.name}.`
          : 'Ask the workspace administrator to send a new invitation.',
      },
      REVOKED: {
        title: 'This invitation is no longer available',
        body: 'The person who invited you withdrew this invitation.',
      },
      ACCEPTED: {
        title: 'This invitation has already been used',
        body: 'Sign in with the account that accepted it, or ask for a new invitation.',
      },
      DECLINED: {
        title: 'This invitation was declined',
        body: 'If that was a mistake, ask for a new invitation.',
      },
    };
    const { title, body } = (status && copy[status]) ?? {
      title: 'This invitation link is invalid',
      body: 'Double-check the link, or ask for a new invitation.',
    };

    return (
      <AuthLayout title={title} subtitle={body}>
        <div className="py-4 flex flex-col items-center text-center space-y-4">
          <StatusIcon tone="destructive">
            <XCircle className="size-6" />
          </StatusIcon>
          {goHome}
        </div>
      </AuthLayout>
    );
  }

  const actionError =
    errorText(acceptMutation.error) ?? errorText(declineMutation.error);
  // A shareable link is used by many people — there's nothing to decline.
  const canDecline = !preview.isLink;
  const acceptLabel = preview.channel
    ? `Join #${preview.channel.name}`
    : `Join ${preview.workspace.name}`;

  // 7. Signed in with the wrong account.
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
          <InvitationCard preview={preview} />

          <div
            role="alert"
            className="rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-3 space-y-1.5 text-xs"
          >
            <div className="flex items-start gap-2 text-accent-amber font-semibold">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>Wrong account</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You're signed in as{' '}
              <strong className="text-foreground">{currentUser?.email}</strong>.
              Switch to{' '}
              <strong className="text-foreground">{preview.email}</strong> to
              accept.
            </p>
          </div>

          <div className="space-y-2">
            {matchingAccounts.map((account) => (
              <Button
                key={account.id}
                className="w-full gap-2 font-semibold"
                loading={
                  switchAccount.isPending &&
                  (switchAccount.variables as { accountId?: string })
                    ?.accountId === account.id
                }
                onClick={() =>
                  switchAccount.mutate({ accountId: account.id, to: invitePath })
                }
              >
                <UserAvatar
                  name={account.user.displayName ?? account.user.name}
                  src={account.user.avatarUrl}
                  seed={account.id}
                  indicator={false}
                  className="size-4"
                />
                Continue as {account.user.email}
              </Button>
            ))}

            <Button
              variant={matchingAccounts.length > 0 ? 'outline' : 'default'}
              className="w-full gap-2 font-semibold"
              loading={logout.isPending}
              onClick={() => logout.mutate({ returnTo: invitePath })}
            >
              <LogOut className="size-4" />
              Sign out and continue as {preview.email}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate('/')}
            >
              Not now
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // 8. Valid — ready to accept (authenticated) or authenticate first.
  return (
    <AuthLayout
      title={`Join ${preview.workspace.name}`}
      subtitle={`${inviterName(preview)} has invited you to collaborate.`}
    >
      <div className="space-y-4 py-2">
        <InvitationCard preview={preview} />

        <FormError error={actionError} />

        {isAuthenticated ? (
          <div className="space-y-2">
            <Button
              className="w-full font-semibold"
              onClick={handleAccept}
              loading={acceptMutation.isPending}
              disabled={declineMutation.isPending}
              leadingIcon={<CheckCircle2 className="size-4" />}
            >
              {acceptLabel}
            </Button>
            {canDecline && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDecline}
                loading={declineMutation.isPending}
                disabled={acceptMutation.isPending}
              >
                Decline invitation
              </Button>
            )}
            {currentUser?.email && (
              <p className="pt-1 text-center text-[11px] text-muted-foreground">
                Signed in as{' '}
                <span className="text-foreground">{currentUser.email}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              {preview.email
                ? `Sign in or create an account with ${preview.email} to join.`
                : 'Sign in or create an account to join.'}
            </p>
            <Button
              className="w-full font-semibold gap-2"
              onClick={() => navigate('/register', { state: authState })}
            >
              <UserPlus className="size-4" />
              Create account and join
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs gap-2"
              onClick={() => navigate('/login', { state: authState })}
            >
              <LogIn className="size-3.5" />
              I already have an account
            </Button>
            {canDecline && (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDecline}
                loading={declineMutation.isPending}
              >
                Decline invitation
              </Button>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
