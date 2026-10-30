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
  ShieldCheck,
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

/** Round status glyph shown above a terminal state's title. */
function StatusIcon({
  tone,
  children,
}: {
  tone: 'success' | 'primary' | 'destructive' | 'muted';
  children: ReactNode;
}) {
  const toneClass = {
    success: 'bg-success/15 text-success ring-success/20',
    primary: 'bg-primary/10 text-primary ring-primary/20',
    destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
    muted: 'bg-muted text-muted-foreground ring-border',
  }[tone];
  return (
    <div
      className={`size-14 flex items-center justify-center rounded-2xl ring-1 ${toneClass}`}
    >
      {children}
    </div>
  );
}

/** Workspace logo with the inviter's face tucked into its corner. */
function InviteHero({ preview }: { preview: InvitationPublicPreview }) {
  return (
    <div className="relative">
      {/* The preview's logo URL is API-relative; resolve it before loading. */}
      <WorkspaceAvatar
        name={preview.workspace.name}
        src={resolveMediaUrl(preview.workspace.avatarUrl)}
        icon={preview.workspace.icon}
        iconColor={preview.workspace.iconColor}
        avatarColor={preview.workspace.avatarColor}
        seed={preview.workspace.id}
        size="xl"
        className="shadow-md"
      />
      <span className="-bottom-1.5 -right-1.5 absolute flex rounded-full ring-[3px] ring-background">
        <UserAvatar
          name={inviterName(preview)}
          src={preview.inviter.avatarUrl}
          seed={preview.inviter.id}
          indicator={false}
          size="md"
        />
      </span>
    </div>
  );
}

const ROLE_HINTS: Record<InvitationPublicPreview['role'], string> = {
  OWNER: 'Full control of the workspace, members and billing',
  ADMIN: 'Manage members, channels and workspace settings',
  MEMBER: 'Chat, share files and collaborate across channels',
  GUEST: "Limited access to the channels you're invited to",
};

function DetailRow({
  icon,
  label,
  children,
  hint,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="gap-3 px-4 py-3 flex items-start">
      <span
        className="mt-0.5 size-7 flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium truncate text-foreground">
          {children}
        </dd>
        {hint && (
          <p className="mt-0.5 leading-snug text-[11px] text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** What the invitation grants: role, any channel/team/project scope, and who it's for. */
function InvitationCard({ preview }: { preview: InvitationPublicPreview }) {
  const name = inviterName(preview);
  const role = preview.role.toLowerCase();
  const expiresSoon =
    new Date(preview.expiresAt).getTime() - Date.now() < 48 * 60 * 60 * 1000;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      {preview.message && (
        <figure className="gap-2.5 px-4 py-3 flex border-b border-border/60">
          <UserAvatar
            name={name}
            src={preview.inviter.avatarUrl}
            seed={preview.inviter.id}
            indicator={false}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <figcaption className="font-medium text-[11px] text-foreground">
              {name}
            </figcaption>
            <blockquote className="mt-0.5 text-xs leading-relaxed break-words text-muted-foreground">
              {preview.message}
            </blockquote>
          </div>
        </figure>
      )}

      <dl className="divide-y divide-border/60">
        <DetailRow
          icon={<ShieldCheck className="size-3.5" />}
          label="Your role"
          hint={ROLE_HINTS[preview.role]}
        >
          <span className="capitalize">{role}</span>
        </DetailRow>
        {preview.channel && (
          <DetailRow
            icon={<Hash className="size-3.5" />}
            label="You'll start in"
          >
            {preview.channel.name}
          </DetailRow>
        )}
        {preview.team && (
          <DetailRow icon={<Users className="size-3.5" />} label="Team">
            {preview.team.name}
          </DetailRow>
        )}
        {preview.project && (
          <DetailRow
            icon={<FolderKanban className="size-3.5" />}
            label="Project"
          >
            {preview.project.name}
          </DetailRow>
        )}
        {preview.email && (
          <DetailRow
            icon={<Mail className="size-3.5" />}
            label="Invitation for"
          >
            {preview.email}
          </DetailRow>
        )}
      </dl>

      <p
        className={`gap-1.5 px-4 py-2 flex items-center border-t border-border/60 bg-muted/40 text-[11px] ${
          expiresSoon ? 'text-accent-amber' : 'text-muted-foreground'
        }`}
      >
        <Clock className="size-3.5 shrink-0" aria-hidden />
        <span>
          Expires{' '}
          <time dateTime={preview.expiresAt}>
            {formatRelative(preview.expiresAt)}
          </time>
        </span>
      </p>
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
  const [confirmingDecline, setConfirmingDecline] = useState(false);

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
      size="lg"
      className="w-full"
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
          acceptMutation.data?.alreadyMember
            ? "You're already in"
            : "You're in!"
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
        hero={
          <StatusIcon tone="success">
            <CheckCircle2 className="size-7" />
          </StatusIcon>
        }
      >
        <div className="pt-1 space-y-2">
          <Button
            className="font-semibold w-full"
            size="lg"
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
        hero={
          <StatusIcon tone="muted">
            <XCircle className="size-6" />
          </StatusIcon>
        }
      >
        <div className="pt-1 space-y-2">{goHome}</div>
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
        hero={
          <StatusIcon tone="muted">
            <WifiOff className="size-6" />
          </StatusIcon>
        }
      >
        <div className="pt-1 space-y-2">
          <Button
            className="font-semibold w-full"
            size="lg"
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
        hero={
          <StatusIcon tone="primary">
            <Building2 className="size-6" />
          </StatusIcon>
        }
      >
        <div className="pt-1 space-y-2">
          <Button
            className="font-semibold w-full"
            size="lg"
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
      <AuthLayout
        title={title}
        subtitle={body}
        hero={
          <StatusIcon tone="destructive">
            <XCircle className="size-6" />
          </StatusIcon>
        }
      >
        <div className="pt-1 space-y-2">{goHome}</div>
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
        hero={<InviteHero preview={preview} />}
      >
        <div className="space-y-4 py-2">
          <InvitationCard preview={preview} />

          <div
            role="alert"
            className="p-3 space-y-1.5 text-xs rounded-xl border border-accent-amber/40 bg-accent-amber/10"
          >
            <div className="gap-2 font-semibold flex items-start text-accent-amber">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
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
                className="gap-2 font-semibold w-full"
                loading={
                  switchAccount.isPending &&
                  (switchAccount.variables as { accountId?: string })
                    ?.accountId === account.id
                }
                onClick={() =>
                  switchAccount.mutate({
                    accountId: account.id,
                    to: invitePath,
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
                Continue as {account.user.email}
              </Button>
            ))}

            <Button
              variant={matchingAccounts.length > 0 ? 'outline' : 'default'}
              className="gap-2 font-semibold w-full"
              loading={logout.isPending}
              onClick={() => logout.mutate({ returnTo: invitePath })}
            >
              <LogOut className="size-4" />
              Sign out and continue as {preview.email}
            </Button>
            <Button
              variant="ghost"
              className="text-xs w-full text-muted-foreground"
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
  // Two-step decline, inline — declining can't be undone from this link.
  const declineButton =
    canDecline &&
    (confirmingDecline ? (
      <div
        role="group"
        aria-label="Confirm decline"
        className="gap-2 flex flex-col items-center text-center"
      >
        <p className="text-xs text-balance text-muted-foreground">
          Decline this invitation? You'll need a new one to join later.
        </p>
        <div className="gap-2 flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingDecline(false)}
            disabled={declineMutation.isPending}
          >
            Keep invitation
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDecline}
            loading={declineMutation.isPending}
            disabled={acceptMutation.isPending}
          >
            Decline
          </Button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmingDecline(true)}
        disabled={acceptMutation.isPending}
        className="px-1 text-xs mx-auto block rounded-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        Decline invitation
      </button>
    ));

  return (
    <AuthLayout
      title={`Join ${preview.workspace.name}`}
      subtitle={
        <>
          <strong className="font-semibold text-foreground">
            {inviterName(preview)}
          </strong>{' '}
          invited you to collaborate
          {preview.channel ? (
            <>
              {' '}
              in{' '}
              <strong className="font-semibold text-foreground">
                #{preview.channel.name}
              </strong>
            </>
          ) : null}
          .
        </>
      }
      hero={<InviteHero preview={preview} />}
    >
      <div className="space-y-5">
        <InvitationCard preview={preview} />

        <FormError error={actionError} />

        {isAuthenticated ? (
          <div className="space-y-3">
            <Button
              size="lg"
              className="font-semibold w-full"
              onClick={handleAccept}
              loading={acceptMutation.isPending}
              disabled={declineMutation.isPending}
            >
              {acceptLabel}
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
            {/* An emailed invite already names the account in the card. */}
            {currentUser?.email && !preview.email && (
              <p className="text-center text-[11px] text-muted-foreground">
                Joining as{' '}
                <span className="font-medium text-foreground">
                  {currentUser.email}
                </span>
              </p>
            )}
            {declineButton}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Button
                size="lg"
                className="font-semibold gap-2 w-full"
                onClick={() => navigate('/register', { state: authState })}
              >
                <UserPlus className="size-4" />
                Create account and join
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full"
                onClick={() => navigate('/login', { state: authState })}
              >
                <LogIn className="size-4" />
                Sign in to join
              </Button>
            </div>
            <p className="leading-relaxed text-center text-[11px] text-balance text-muted-foreground">
              {preview.email ? (
                <>
                  Use{' '}
                  <span className="font-medium text-foreground">
                    {preview.email}
                  </span>{' '}
                  so your invitation is matched automatically.
                </>
              ) : (
                "Already on Onetab AI? Sign in and you'll join right after."
              )}
            </p>
            {declineButton && (
              <div className="pt-2 border-t border-border/60">
                {declineButton}
              </div>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
