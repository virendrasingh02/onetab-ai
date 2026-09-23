import { ApiError, getAccessToken } from '@org/api-client';
import { Button } from '@org/ui';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccountStore } from '../account-store.js';
import { trackAuthEvent } from '../auth-analytics.js';
import { AuthLayout } from '../auth-layout.js';
import { useAuthStore } from '../auth.store.js';
import { resolveSafeHandoff, withHandoffToken } from '../safe-handoff-redirect.js';
import { redirectPathFromAuthState, useVerifyMagicLink } from '../use-auth.js';

type VerificationState =
  | 'idle'
  | 'verifying'
  | 'success'
  | 'already_authenticated'
  | 'account_mismatch'
  | 'error';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const returnTo = searchParams.get('returnTo');

  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const clearSession = useAuthStore((s) => s.clear);

  const verifyMutation = useVerifyMagicLink();

  const [state, setState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorKind, setErrorKind] = useState<
    'expired' | 'used' | 'invalid' | 'rate_limited' | 'network' | 'server'
  >('invalid');

  const hasAttemptedRef = useRef(false);

  const completeNavigation = useCallback(() => {
    if (returnTo) {
      const handoff = resolveSafeHandoff(
        returnTo,
        window.location.origin,
        window.location.hostname,
      );
      if (handoff) {
        const currentToken = getAccessToken();
        window.location.href =
          handoff.crossOrigin && currentToken
            ? withHandoffToken(handoff.url, currentToken)
            : handoff.url.toString();
        return;
      }
    }
    navigate(redirectPathFromAuthState(null, '/'), { replace: true });
  }, [navigate, returnTo]);

  const runVerification = useCallback(
    async (tokenToVerify: string) => {
      setState('verifying');
      setErrorMessage('');
      trackAuthEvent('auth_magic_link_clicked');

      try {
        await verifyMutation.mutateAsync({ token: tokenToVerify });
        trackAuthEvent('auth_magic_link_verified');
        setState('success');

        // Short timeout so user sees positive confirmation, then redirect
        setTimeout(() => {
          completeNavigation();
        }, 1200);
      } catch (err: unknown) {
        let msg = 'Something went wrong. Please try again or use your password to sign in.';
        let kind: typeof errorKind = 'server';

        if (err instanceof ApiError) {
          if (err.status === 429) {
            kind = 'rate_limited';
            msg = 'Too many requests. Please wait before trying again.';
          } else if (err.status === 401 || err.status === 400) {
            const rawMsg = err.message.toLowerCase();
            if (rawMsg.includes('expired')) {
              kind = 'expired';
              msg = 'This sign-in link has expired. Request a new Magic Link.';
              trackAuthEvent('auth_magic_link_expired');
            } else if (rawMsg.includes('already been used') || rawMsg.includes('used')) {
              kind = 'used';
              msg = 'This sign-in link has already been used. Request a new Magic Link.';
            } else {
              kind = 'invalid';
              msg = 'This sign-in link is invalid. Request a new Magic Link.';
            }
          } else if (err.status === 0 || err.status >= 500) {
            kind = 'server';
            msg = 'Something went wrong on our servers. Please try again or use your password.';
          }
        } else if (err instanceof Error && err.name === 'TypeError') {
          kind = 'network';
          msg = "We couldn't verify the link. Please check your internet connection.";
        }

        trackAuthEvent('auth_magic_link_failed', { errorCode: kind });
        setErrorKind(kind);
        setErrorMessage(msg);
        setState('error');
      }
    },
    [completeNavigation, verifyMutation],
  );

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorKind('invalid');
      setErrorMessage('No verification token found in URL. Please request a new Magic Link.');
      return;
    }

    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    // Check if user is already authenticated
    if (authStatus === 'authenticated' && authUser) {
      // The user is already logged in. Rather than silently replace their session,
      // offer confirmation.
      setState('already_authenticated');
      return;
    }

    void runVerification(token);
  }, [token, authStatus, authUser, runVerification]);

  const handleContinueAsExisting = () => {
    completeNavigation();
  };

  const handleSwitchAccount = async () => {
    if (!token) return;
    clearSession();
    useAccountStore.getState().clearAll();
    void runVerification(token);
  };

  return (
    <AuthLayout
      title="Magic Link Verification"
      subtitle="Verifying your passwordless sign-in link."
      footer={
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link
            to="/login"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <KeyRound className="size-3.5" />
            <span>Sign in with password</span>
          </Link>
          <span>•</span>
          <Link
            to="/login"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Mail className="size-3.5" />
            <span>Request new link</span>
          </Link>
        </div>
      }
    >
      <div className="py-2" aria-live="polite">
        {/* STATE: VERIFYING */}
        {state === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-surface-raised flex items-center justify-center border border-border">
              <Loader2 className="size-6 animate-spin text-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Verifying your sign-in link…
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Authenticating your credentials and establishing your session.
              </p>
            </div>
          </div>
        )}

        {/* STATE: SUCCESS */}
        {state === 'success' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Authentication successful!
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Welcome back. Redirecting you to your workspace…
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Opening workspace…</span>
            </div>
          </div>
        )}

        {/* STATE: ALREADY AUTHENTICATED */}
        {state === 'already_authenticated' && authUser && (
          <div className="py-4 space-y-4 text-center">
            <div className="size-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <UserCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Already signed in
              </h3>
              <p className="text-xs text-muted-foreground">
                You are currently signed in as{' '}
                <span className="font-semibold text-foreground">
                  {authUser.email}
                </span>
                .
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                size="md"
                className="w-full"
                onClick={handleContinueAsExisting}
                trailingIcon={<ArrowRight className="size-3.5" />}
              >
                Continue to workspace
              </Button>

              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full"
                onClick={handleSwitchAccount}
              >
                Sign in with this link instead
              </Button>
            </div>
          </div>
        )}

        {/* STATE: ERROR */}
        {state === 'error' && (
          <div className="py-4 space-y-4 text-center">
            <div className="size-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">
                {errorKind === 'expired'
                  ? 'Sign-in link expired'
                  : errorKind === 'used'
                  ? 'Link already used'
                  : errorKind === 'rate_limited'
                  ? 'Too many attempts'
                  : 'Verification failed'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {errorMessage}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                size="md"
                className="w-full"
                onClick={() => navigate('/login')}
                leadingIcon={<Sparkles className="size-3.5" />}
              >
                Request a new Magic Link
              </Button>

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
        )}
      </div>
    </AuthLayout>
  );
}
