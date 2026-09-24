import {
  authApi,
  getAccessToken,
  isTwoFactorChallenge,
  setAccessToken,
} from '@org/api-client';
import { SystemRole, type CurrentUser } from '@org/types';
import { Button, Checkbox, Input, LoadingState } from '@org/ui';
import {
  ArrowRight,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

type SessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; user: CurrentUser }
  | { status: 'ready' };

const WEB_APP_URL =
  (import.meta.env?.['VITE_WEB_APP_URL'] as string | undefined) ??
  'http://localhost:4200';

/**
 * Gates the whole console behind a signed-in platform-operator session.
 * Matches the exact minimalist design system and styling of the OneTab AI auth layout.
 *
 * Checks:
 * 1. URL fragment for a handoff token (#token=…) — the fragment never
 *    leaves the browser, so unlike a query string it can't leak into
 *    server/proxy/CDN access logs on the handoff navigation.
 * 2. Active access token from storage / memory
 * 3. httpOnly refresh cookie
 *
 * If unauthenticated, allows direct operator login on the console's origin or
 * one-click session handoff from the main web application.
 */
export function RequirePlatformOperator({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  // Password accepted, but the operator has two-factor on: a code is owed.
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const checkSession = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setIsCheckingSession(true);
      setLoginError(null);
    }

    try {
      // 1. Ingest access token if passed via the URL fragment (e.g. from web
      //    app returnTo handoff). Stripped immediately so it never lingers
      //    in browser history.
      if (typeof window !== 'undefined') {
        try {
          if (window.location.hash) {
            const hashParams = new URLSearchParams(
              window.location.hash.replace(/^#/, ''),
            );
            const hashToken =
              hashParams.get('token') || hashParams.get('accessToken');
            if (hashToken) {
              setAccessToken(hashToken);
              window.history.replaceState(
                {},
                document.title,
                `${window.location.pathname}${window.location.search}`,
              );
            }
          }
        } catch {
          // Ignore URL cleanup error
        }
      }

      // 2. Check if we already have an active access token in memory or localStorage
      const token = getAccessToken();
      if (token) {
        try {
          const user = await authApi.me();
          if (user.systemRole === SystemRole.USER) {
            setState({ status: 'forbidden', user });
          } else {
            setState({ status: 'ready' });
          }
          return;
        } catch {
          // Stored access token may be expired; fall through to refresh attempt
        }
      }

      // 3. Attempt to exchange refresh cookie
      const tokens = await authApi.refresh();
      setAccessToken(tokens.accessToken);
      const user = await authApi.me();
      if (user.systemRole === SystemRole.USER) {
        setState({ status: 'forbidden', user });
      } else {
        setState({ status: 'ready' });
      }
    } catch {
      setState({ status: 'unauthenticated' });
    } finally {
      if (isManualRetry) {
        setIsCheckingSession(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await checkSession();
      if (cancelled) {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkSession]);

  const handleDirectLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const res = await authApi.login({ email, password, rememberMe });
      if (isTwoFactorChallenge(res)) {
        setTwoFactorToken(res.challengeToken);
        setTwoFactorCode('');
        return;
      }
      await finishOperatorSignIn(res.accessToken);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please verify your email and password.';
      setLoginError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishOperatorSignIn = async (accessToken: string) => {
    setAccessToken(accessToken);
    // Verify platform operator role
    const user = await authApi.me();
    if (user.systemRole === SystemRole.USER) {
      setState({ status: 'forbidden', user });
    } else {
      setState({ status: 'ready' });
    }
  };

  const handleTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken || !twoFactorCode.trim()) return;

    setIsSubmitting(true);
    setLoginError(null);
    try {
      const res = await authApi.completeTwoFactorLogin({
        challengeToken: twoFactorToken,
        code: twoFactorCode.trim(),
      });
      setTwoFactorToken(null);
      await finishOperatorSignIn(res.accessToken);
    } catch (err: unknown) {
      setTwoFactorCode('');
      setLoginError(
        err instanceof Error ? err.message : 'That code is not right.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (state.status === 'loading') {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  const webAppLoginUrl = `${WEB_APP_URL}/login?returnTo=${encodeURIComponent(
    typeof window !== 'undefined'
      ? window.location.href
      : 'http://localhost:4201',
  )}`;

  if (state.status === 'unauthenticated') {
    return (
      <div className="dark px-4 py-8 sm:py-10 flex min-h-screen flex-col items-center justify-between bg-background text-foreground selection:bg-primary/25">
        {/* Top Header Bar */}
        <header className="pt-2 sm:pt-4 max-w-4xl px-4 flex w-full items-center justify-between">
          <div className="gap-2.5 px-2.5 py-1.5 inline-flex items-center rounded-lg">
            <div className="size-7 font-bold text-xs flex items-center justify-center rounded-md border border-border bg-surface-raised text-foreground shadow-xs">
              O
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab AI
            </span>
            <span className="font-semibold tracking-wider px-1.5 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-[10px] text-primary uppercase">
              Admin
            </span>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={WEB_APP_URL}
              className="text-xs gap-1.5 inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              <span>Go to workspace</span>
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </header>

        {/* Main Content Area */}
        <main className="py-8 my-auto flex w-full max-w-[380px] flex-col items-center">
          <div className="w-full">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight text-center text-foreground">
              Sign in to Admin
            </h1>

            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-center text-balance text-muted-foreground">
              Enter your operator credentials to access the console.
            </p>

            <div className="mt-6 w-full">
              {loginError && (
                <div className="mb-4 p-2.5 text-xs gap-2 flex items-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {twoFactorToken ? (
                <form
                  onSubmit={handleTwoFactor}
                  className="space-y-3"
                  noValidate
                >
                  <div className="space-y-1 text-left">
                    <label
                      htmlFor="operator-2fa-code"
                      className="text-xs font-medium text-foreground"
                    >
                      Authentication code
                    </label>
                    <Input
                      id="operator-2fa-code"
                      autoComplete="one-time-code"
                      placeholder="6-digit code or recovery code"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      autoFocus
                      leadingIcon={
                        <ShieldCheck className="size-4 text-muted-foreground" />
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Two-factor authentication is on for this account.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    size="md"
                    className="mt-1 w-full"
                    loading={isSubmitting}
                    disabled={twoFactorCode.trim().length < 6}
                    trailingIcon={<ArrowRight className="size-3.5" />}
                  >
                    Verify and sign in
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorToken(null);
                      setLoginError(null);
                      setPassword('');
                    }}
                    className="text-xs w-full text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleDirectLogin}
                  className="space-y-3"
                  noValidate
                >
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-foreground">
                      Work Email
                    </label>
                    <Input
                      type="email"
                      autoComplete="username"
                      placeholder="operator@onetab.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      leadingIcon={
                        <Mail className="size-4 text-muted-foreground" />
                      }
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-foreground">
                      Password
                    </label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      leadingIcon={
                        <Lock className="size-4 text-muted-foreground" />
                      }
                      trailingSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          className="pr-1 flex items-center text-muted-foreground transition-colors hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      }
                    />
                  </div>

                  <div className="space-x-2 space-y-0 pt-0.5 flex flex-row items-center">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(!!checked)}
                    />
                    <label
                      htmlFor="rememberMe"
                      className="text-xs font-normal cursor-pointer text-muted-foreground select-none"
                    >
                      Remember me for 30 days
                    </label>
                  </div>

                  <Button
                    type="submit"
                    size="md"
                    className="mt-1 w-full"
                    loading={isSubmitting}
                    disabled={!email || !password}
                    trailingIcon={<ArrowRight className="size-3.5" />}
                  >
                    Sign in
                  </Button>
                </form>
              )}

              {/* Divider */}
              <div className="my-5 relative">
                <div className="inset-0 absolute flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="px-2 bg-background text-muted-foreground">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Secondary actions */}
              <div className="gap-2 grid grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="text-xs w-full"
                  asChild
                >
                  <a href={webAppLoginUrl}>
                    <ExternalLink className="size-3.5 mr-1.5 text-muted-foreground" />
                    Main App
                  </a>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="text-xs w-full"
                  onClick={() => void checkSession(true)}
                  disabled={isCheckingSession}
                  loading={isCheckingSession}
                  leadingIcon={
                    !isCheckingSession ? (
                      <RefreshCw className="size-3.5 text-muted-foreground" />
                    ) : undefined
                  }
                >
                  Check Session
                </Button>
              </div>

              <div className="mt-5 text-xs leading-normal text-center text-muted-foreground">
                Requires an account with{' '}
                <span className="font-medium text-foreground">SUPERADMIN</span>{' '}
                or <span className="font-medium text-foreground">SUPPORT</span>{' '}
                role.
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Legal Notice & Footer Links */}
        <footer className="pt-6 pb-2 max-w-md px-2 space-y-2.5 w-full text-center">
          <p className="sm:text-xs leading-relaxed text-[11px] text-muted-foreground">
            Admin console is restricted to authorized platform personnel only.
            All administrative actions are logged and audited.
          </p>

          <div className="sm:text-xs gap-3 sm:gap-4 flex flex-wrap items-center justify-center text-[11px] text-muted-foreground">
            <span>© {new Date().getFullYear()} OneTab AI</span>
            <a
              href={`${WEB_APP_URL}/privacy`}
              className="transition-colors hover:text-foreground"
            >
              Privacy Policy
            </a>
            <a
              href={`${WEB_APP_URL}/docs`}
              className="transition-colors hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={`${WEB_APP_URL}/support`}
              className="transition-colors hover:text-foreground"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    );
  }

  if (state.status === 'forbidden') {
    return (
      <div className="dark px-4 py-8 sm:py-10 flex min-h-screen flex-col items-center justify-between bg-background text-foreground selection:bg-primary/25">
        {/* Top Header Bar */}
        <header className="pt-2 sm:pt-4 max-w-4xl px-4 flex w-full items-center justify-between">
          <div className="gap-2.5 px-2.5 py-1.5 inline-flex items-center rounded-lg">
            <div className="size-7 font-bold text-xs flex items-center justify-center rounded-md border border-border bg-surface-raised text-foreground shadow-xs">
              O
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab AI
            </span>
            <span className="font-semibold tracking-wider px-1.5 py-0.5 rounded-md border border-destructive/20 bg-destructive/10 text-[10px] text-destructive uppercase">
              Access Denied
            </span>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={WEB_APP_URL}
              className="text-xs gap-1.5 inline-flex items-center text-muted-foreground hover:text-foreground"
            >
              <span>Back to app</span>
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </header>

        {/* Main Content Area */}
        <main className="py-8 my-auto flex w-full max-w-[380px] flex-col items-center">
          <div className="w-full text-center">
            <div className="size-12 mb-4 mx-auto flex items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
              <ShieldAlert className="size-6" />
            </div>

            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight text-center text-foreground">
              Access Denied
            </h1>

            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-center text-balance text-muted-foreground">
              Signed in as{' '}
              <span className="font-medium text-foreground">
                {state.user.email}
              </span>{' '}
              ({state.user.systemRole}), which is not a platform-operator
              account.
            </p>

            <div className="mt-6 space-y-2.5 w-full">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  setAccessToken(null);
                  setState({ status: 'unauthenticated' });
                }}
              >
                Sign in with another account
              </Button>

              <Button variant="outline" size="md" className="w-full" asChild>
                <a href={WEB_APP_URL}>Back to the main app</a>
              </Button>
            </div>

            <div className="mt-5 text-xs leading-normal text-center text-muted-foreground">
              Ask an existing administrator to assign you the{' '}
              <span className="font-medium text-foreground">SUPERADMIN</span> or{' '}
              <span className="font-medium text-foreground">SUPPORT</span> role.
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 pb-2 max-w-md px-2 space-y-2.5 w-full text-center">
          <div className="sm:text-xs gap-3 sm:gap-4 flex flex-wrap items-center justify-center text-[11px] text-muted-foreground">
            <span>© {new Date().getFullYear()} OneTab AI</span>
            <a
              href={`${WEB_APP_URL}/privacy`}
              className="transition-colors hover:text-foreground"
            >
              Privacy Policy
            </a>
            <a
              href={`${WEB_APP_URL}/docs`}
              className="transition-colors hover:text-foreground"
            >
              Docs
            </a>
            <a
              href={`${WEB_APP_URL}/support`}
              className="transition-colors hover:text-foreground"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    );
  }

  return <>{children}</>;
}
