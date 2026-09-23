import { ApiError } from '@org/api-client';
import { Button } from '@org/ui';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trackAuthEvent } from '../auth-analytics.js';
import { AuthLayout } from '../auth-layout.js';
import { useAuthStore } from '../auth.store.js';
import { useAddAccountWithMagicLink } from '../use-account-switcher.js';
import { useVerifyMagicLink } from '../use-auth.js';

type FailureReason =
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'rate_limited'
  | 'network'
  | 'server';

type VerifyState =
  | { kind: 'waiting' }
  | { kind: 'verifying' }
  | { kind: 'success' }
  | { kind: 'signed-in' }
  | { kind: 'error'; reason: FailureReason };

/** Brief enough to read the confirmation, short enough not to feel stuck. */
const SUCCESS_REDIRECT_MS = 900;

const REQUEST_NEW_LINK = '/login?method=magic-link';

const FAILURE_COPY: Record<FailureReason, { title: string; body: string }> = {
  missing: {
    title: 'Incomplete sign-in link',
    body: 'This link is missing its token. Copy the whole link from the email, or request a new one.',
  },
  invalid: {
    title: 'Invalid sign-in link',
    body: 'This link is not valid. Request a new one to sign in.',
  },
  expired: {
    title: 'Sign-in link expired',
    body: 'For your security, links expire shortly after they are sent, and only the newest one works. Request a new link.',
  },
  used: {
    title: 'Link already used',
    body: 'Each sign-in link works once. Request a new one if you still need to sign in.',
  },
  rate_limited: {
    title: 'Too many attempts',
    body: 'Please wait a minute before trying again.',
  },
  network: {
    title: 'You appear to be offline',
    body: "We couldn't reach the server to verify the link. Check your connection and try again — the link is still valid if it hasn't expired.",
  },
  server: {
    title: 'Something went wrong',
    body: 'We could not verify the link right now. Try again, or sign in with your password.',
  },
};

/** Maps an API failure onto what the reader can do about it — by code, not message text. */
function classifyFailure(error: unknown): FailureReason {
  if (!(error instanceof ApiError)) return 'server';
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    return 'rate_limited';
  }
  if (error.code === 'TOKEN_EXPIRED') return 'expired';
  if (error.code === 'CONFLICT') return 'used';
  if (
    error.code === 'INVALID_CREDENTIALS' ||
    error.code === 'VALIDATION_FAILED'
  ) {
    return 'invalid';
  }
  // `toApiError` reports "no response at all" as status 0.
  if (error.status === 0) return 'network';
  return 'server';
}

function StatusIcon({
  tone,
  children,
}: {
  tone: 'neutral' | 'success' | 'danger' | 'warning';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'text-foreground',
    success: 'text-success-text',
    danger: 'text-destructive-text',
    warning: 'text-warning-text',
  }[tone];
  return (
    <div
      className={`mx-auto size-12 rounded-full bg-surface-raised border border-border flex items-center justify-center ${toneClass}`}
    >
      {children}
    </div>
  );
}

/**
 * Landing page for the emailed sign-in link (`/auth/magic-link/verify?token=`).
 *
 * Waits for the session bootstrap to settle first, so a signed-in reader is
 * asked before anything happens rather than having the link silently spent. The
 * token is only ever sent to the API once per page load.
 */
export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const verify = useVerifyMagicLink();
  const addAccount = useAddAccountWithMagicLink();

  const [state, setState] = useState<VerifyState>(() =>
    token ? { kind: 'waiting' } : { kind: 'error', reason: 'missing' },
  );
  const decided = useRef(false);

  const fail = (error: unknown) => {
    const reason = classifyFailure(error);
    trackAuthEvent(
      reason === 'expired' ? 'auth_magic_link_expired' : 'auth_magic_link_failed',
      { method: 'magic_link', errorCode: reason },
    );
    setState({ kind: 'error', reason });
  };

  const runVerification = async (tokenToVerify: string) => {
    setState({ kind: 'verifying' });
    trackAuthEvent('auth_magic_link_clicked', { method: 'magic_link' });
    try {
      await verify.mutateAsync({ token: tokenToVerify });
      trackAuthEvent('auth_magic_link_verified', { method: 'magic_link' });
      setState({ kind: 'success' });
    } catch (error) {
      fail(error);
    }
  };

  useEffect(() => {
    if (!token || decided.current) return;
    // Still restoring a session from the refresh cookie — wait for the answer.
    if (authStatus === 'idle' || authStatus === 'authenticating') return;
    decided.current = true;

    if (authStatus === 'authenticated' && authUser) {
      setState({ kind: 'signed-in' });
      return;
    }
    void runVerification(token);
    // The decision is made exactly once per load; later auth changes (our own
    // sign-in included) must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authStatus, authUser]);

  useEffect(() => {
    if (state.kind !== 'success') return;
    const timer = setTimeout(
      () => navigate('/', { replace: true }),
      SUCCESS_REDIRECT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.kind, navigate]);

  const handleUseLinkAccount = async () => {
    if (!token) return;
    setState({ kind: 'verifying' });
    trackAuthEvent('auth_magic_link_clicked', { method: 'magic_link' });
    try {
      // Adds the link's identity next to the current one and switches to it.
      await addAccount.mutateAsync(token);
      trackAuthEvent('auth_magic_link_verified', { method: 'magic_link' });
    } catch (error) {
      fail(error);
    }
  };

  const failure = state.kind === 'error' ? FAILURE_COPY[state.reason] : null;
  const canRetry =
    state.kind === 'error' &&
    token !== null &&
    (state.reason === 'network' ||
      state.reason === 'server' ||
      state.reason === 'rate_limited');

  const title =
    state.kind === 'success'
      ? 'You are signed in'
      : state.kind === 'signed-in'
        ? 'Already signed in'
        : failure
          ? failure.title
          : 'Signing you in';

  return (
    <AuthLayout
      title={title}
      subtitle={
        state.kind === 'success'
          ? 'Taking you to your workspace…'
          : state.kind === 'signed-in'
            ? 'This browser already has an active session.'
            : failure
              ? undefined
              : 'Verifying your sign-in link.'
      }
      footer={
        <Link
          to="/login"
          className="font-medium text-foreground hover:underline transition-colors"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="text-center" aria-live="polite">
        {state.kind === 'waiting' || state.kind === 'verifying' ? (
          <div className="py-6 space-y-3">
            <StatusIcon tone="neutral">
              <Loader2 className="size-6 animate-spin" />
            </StatusIcon>
            <p className="text-xs text-muted-foreground">
              Checking the link and starting your session…
            </p>
          </div>
        ) : null}

        {state.kind === 'success' ? (
          <div className="py-6 space-y-3">
            <StatusIcon tone="success">
              <CheckCircle2 className="size-6" />
            </StatusIcon>
            <p className="text-xs text-muted-foreground">
              Welcome back{authUser?.displayName || authUser?.name ? `, ${authUser.displayName || authUser.name}` : ''}.
            </p>
          </div>
        ) : null}

        {state.kind === 'signed-in' && authUser ? (
          <div className="space-y-4">
            <StatusIcon tone="neutral">
              <UserCheck className="size-6" />
            </StatusIcon>
            <p className="text-xs text-muted-foreground">
              You are signed in as{' '}
              <span className="font-semibold text-foreground">
                {authUser.email}
              </span>
              . Continue as that account, or use the link to add the account it
              was sent to.
            </p>
            <div className="space-y-2">
              <Button
                type="button"
                size="md"
                className="w-full"
                onClick={() => navigate('/', { replace: true })}
                trailingIcon={<ArrowRight className="size-3.5" />}
              >
                Continue as {authUser.email}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full"
                loading={addAccount.isPending}
                onClick={() => void handleUseLinkAccount()}
              >
                Sign in with this link instead
              </Button>
            </div>
          </div>
        ) : null}

        {failure && state.kind === 'error' ? (
          <div className="space-y-4">
            <StatusIcon
              tone={
                state.reason === 'expired' || state.reason === 'rate_limited'
                  ? 'warning'
                  : 'danger'
              }
            >
              {state.reason === 'expired' ? (
                <Clock className="size-6" />
              ) : (
                <AlertCircle className="size-6" />
              )}
            </StatusIcon>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {failure.body}
            </p>
            <div className="space-y-2">
              {canRetry && token ? (
                <Button
                  type="button"
                  size="md"
                  className="w-full"
                  onClick={() => void runVerification(token)}
                >
                  Try again
                </Button>
              ) : (
                <Button
                  type="button"
                  size="md"
                  className="w-full"
                  onClick={() => navigate(REQUEST_NEW_LINK)}
                  leadingIcon={<Sparkles className="size-3.5" />}
                >
                  Request a new link
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full"
                onClick={() => navigate('/login')}
                leadingIcon={<KeyRound className="size-3.5" />}
              >
                Sign in with password
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
