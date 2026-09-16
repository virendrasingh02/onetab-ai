import { authApi, getAccessToken, setAccessToken } from '@org/api-client';
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
 * 1. URL search params for handoff tokens (?token= or ?accessToken=)
 * 2. Active access token from storage / memory
 * 3. httpOnly refresh cookie
 *
 * If unauthenticated, allows direct operator login on the console's origin or
 * one-click session handoff from the main web application.
 */
export function RequirePlatformOperator({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  const checkSession = useCallback(async (isManualRetry = false) => {
    if (isManualRetry) {
      setIsCheckingSession(true);
      setLoginError(null);
    }

    try {
      // 1. Ingest access token if passed in query string (e.g. from web app returnTo handoff)
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const queryToken = params.get('token') || params.get('accessToken');
          if (queryToken) {
            setAccessToken(queryToken);
            params.delete('token');
            params.delete('accessToken');
            const cleanSearch = params.toString();
            const cleanUrl = `${window.location.pathname}${
              cleanSearch ? `?${cleanSearch}` : ''
            }${window.location.hash}`;
            window.history.replaceState({}, document.title, cleanUrl);
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
      setAccessToken(res.accessToken);

      // Verify platform operator role
      const user = await authApi.me();
      if (user.systemRole === SystemRole.USER) {
        setState({ status: 'forbidden', user });
      } else {
        setState({ status: 'ready' });
      }
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

  if (state.status === 'loading') {
    return <LoadingState fullPage label="Checking your session…" />;
  }

  const webAppLoginUrl = `${WEB_APP_URL}/login?returnTo=${encodeURIComponent(
    typeof window !== 'undefined' ? window.location.href : 'http://localhost:4201',
  )}`;

  if (state.status === 'unauthenticated') {
    return (
      <div className="dark min-h-screen flex flex-col justify-between items-center bg-background text-foreground px-4 py-8 sm:py-10 selection:bg-primary/25">
        {/* Top Header Bar */}
        <header className="pt-2 sm:pt-4 w-full max-w-4xl px-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg">
            <div className="size-7 rounded-md bg-surface-raised border border-border flex items-center justify-center font-bold text-xs text-foreground shadow-xs">
              O
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab AI
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              Admin
            </span>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={WEB_APP_URL}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <span>Go to workspace</span>
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </header>

        {/* Main Content Area */}
        <main className="w-full max-w-[380px] my-auto py-8 flex flex-col items-center">
          <div className="w-full">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground text-center leading-tight">
              Sign in to Admin
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center text-balance leading-relaxed">
              Enter your operator credentials to access the console.
            </p>

            <div className="mt-6 w-full">
              {loginError && (
                <div className="mb-4 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleDirectLogin} className="space-y-3" noValidate>
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
                    leadingIcon={<Mail className="size-4 text-muted-foreground" />}
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
                    leadingIcon={<Lock className="size-4 text-muted-foreground" />}
                    trailingSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="flex items-center text-muted-foreground hover:text-foreground transition-colors pr-1"
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

                <div className="space-x-2 space-y-0 flex flex-row items-center pt-0.5">
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
                  className="w-full mt-1"
                  loading={isSubmitting}
                  disabled={!email || !password}
                  trailingIcon={<ArrowRight className="size-3.5" />}
                >
                  Sign in
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-background px-2 text-muted-foreground">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Secondary actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full text-xs"
                  asChild
                >
                  <a href={webAppLoginUrl}>
                    <ExternalLink className="size-3.5 text-muted-foreground mr-1.5" />
                    Main App
                  </a>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full text-xs"
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

              <div className="mt-5 text-xs text-center text-muted-foreground leading-normal">
                Requires an account with{' '}
                <span className="font-medium text-foreground">SUPERADMIN</span> or{' '}
                <span className="font-medium text-foreground">SUPPORT</span> role.
              </div>
            </div>
          </div>
        </main>

        {/* Bottom Legal Notice & Footer Links */}
        <footer className="pt-6 pb-2 text-center max-w-md w-full px-2 space-y-2.5">
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            Admin console is restricted to authorized platform personnel only. All administrative actions are logged and audited.
          </p>

          <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <span>© {new Date().getFullYear()} OneTab AI</span>
            <a
              href={`${WEB_APP_URL}/privacy`}
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href={`${WEB_APP_URL}/docs`}
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href={`${WEB_APP_URL}/support`}
              className="hover:text-foreground transition-colors"
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
      <div className="dark min-h-screen flex flex-col justify-between items-center bg-background text-foreground px-4 py-8 sm:py-10 selection:bg-primary/25">
        {/* Top Header Bar */}
        <header className="pt-2 sm:pt-4 w-full max-w-4xl px-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg">
            <div className="size-7 rounded-md bg-surface-raised border border-border flex items-center justify-center font-bold text-xs text-foreground shadow-xs">
              O
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              OneTab AI
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              Access Denied
            </span>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a
              href={WEB_APP_URL}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <span>Back to app</span>
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </header>

        {/* Main Content Area */}
        <main className="w-full max-w-[380px] my-auto py-8 flex flex-col items-center">
          <div className="w-full text-center">
            <div className="size-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4 text-destructive">
              <ShieldAlert className="size-6" />
            </div>

            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground text-center leading-tight">
              Access Denied
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-muted-foreground text-center text-balance leading-relaxed">
              Signed in as{' '}
              <span className="font-medium text-foreground">
                {state.user.email}
              </span>{' '}
              ({state.user.systemRole}), which is not a platform-operator account.
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

            <div className="mt-5 text-xs text-center text-muted-foreground leading-normal">
              Ask an existing administrator to assign you the{' '}
              <span className="font-medium text-foreground">SUPERADMIN</span> or{' '}
              <span className="font-medium text-foreground">SUPPORT</span> role.
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="pt-6 pb-2 text-center max-w-md w-full px-2 space-y-2.5">
          <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <span>© {new Date().getFullYear()} OneTab AI</span>
            <a
              href={`${WEB_APP_URL}/privacy`}
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href={`${WEB_APP_URL}/docs`}
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href={`${WEB_APP_URL}/support`}
              className="hover:text-foreground transition-colors"
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
