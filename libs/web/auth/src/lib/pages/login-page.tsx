import { zodResolver } from '@hookform/resolvers/zod';
import {
  authApi,
  getAccessToken,
  isTwoFactorChallenge,
  setAccessToken,
  toApiError,
} from '@org/api-client';
import type { TwoFactorChallengeResponse } from '@org/types';
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  QRCode,
} from '@org/ui';
import { isDesktop } from '@org/web-desktop';
import {
  loginSchema,
  type CreateDeviceAuthResponse,
  type LoginInput,
} from '@org/validation';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Laptop,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { trackAuthEvent } from '../auth-analytics.js';
import { AuthLayout } from '../auth-layout.js';
import { DesktopBrowserSignIn } from '../components/desktop-browser-sign-in.js';
import { DesktopHandoffPanel } from '../components/desktop-handoff-panel.js';
import { MagicLinkPanel } from '../components/magic-link-panel.js';
import { TwoFactorChallengePanel } from '../components/two-factor-challenge-panel.js';
import {
  formErrorMessage,
  redirectPathFromAuthState,
  useLogin,
} from '../use-auth.js';
import { useAuthStore } from '../auth.store.js';
import {
  authorizeDesktopHandoff,
  desktopCancelUrl,
  withDesktopHandoff,
} from '../desktop-handoff.js';
import { resolveSafeHandoff, withHandoffToken } from '../safe-handoff-redirect.js';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  // This browser tab is signing in on behalf of the desktop app.
  const isDesktopHandoff = searchParams.get('desktop') === 'true';
  const handoffState = searchParams.get('state');
  const handoffChallenge = searchParams.get('code_challenge');

  /*
   * An emailed link opens in the system browser, so it can only ever sign in
   * *that* browser — never the desktop app, nor a browser tab that is handing a
   * session back to the desktop app. Both already have their own flows.
   */
  const magicLinkAvailable = !isDesktop && !isDesktopHandoff;

  const [authMode, setAuthMode] = useState<'magic-link' | 'password'>(() =>
    magicLinkAvailable && searchParams.get('method') === 'magic-link'
      ? 'magic-link'
      : 'password',
  );
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  // Set when the password was right but the account also wants a code.
  const [twoFactor, setTwoFactor] =
    useState<TwoFactorChallengeResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [desktopHandoffRunning, setDesktopHandoffRunning] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  // Mobile QR pairing mode state
  const [isMobileQRMode, setIsMobileQRMode] = useState(false);
  const [deviceAuthData, setDeviceAuthData] =
    useState<CreateDeviceAuthResponse | null>(null);
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(false);
  const [deviceAuthError, setDeviceAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const authStatus = useAuthStore((s) => s.status);

  const completeNavigation = useCallback(() => {
    const returnTo = searchParams.get('returnTo');
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
    navigate(redirectPathFromAuthState(location.state), { replace: true });
  }, [location.state, navigate, searchParams]);

  // If already authenticated and not in a browser handoff flow, redirect immediately to app root or returnTo destination
  useEffect(() => {
    if (authStatus === 'authenticated' && !isDesktopHandoff) {
      completeNavigation();
    }
  }, [authStatus, completeNavigation, isDesktopHandoff]);

  /**
   * Mints the one-time desktop code for this browser session and hands it to
   * the app. A failure used to silently drop back to the sign-in form; it now
   * says what went wrong and offers a retry.
   */
  // Single-flight: both the "already signed in" effect and `finishSignIn`
  // reach for this right after a password sign-in, and every call mints a
  // separate one-time code — the app would consume one and report the other
  // as expired.
  const handoffInFlight = useRef(false);
  const runDesktopHandoff = useCallback(async () => {
    if (handoffInFlight.current) return;
    handoffInFlight.current = true;
    const handoff =
      handoffState && handoffChallenge
        ? { state: handoffState, codeChallenge: handoffChallenge }
        : null;
    setDesktopHandoffRunning(true);
    setHandoffError(null);
    if (!handoff) {
      setHandoffError('This sign-in link is incomplete. Start again from the desktop app.');
      return;
    }
    try {
      setHandoffUrl(await authorizeDesktopHandoff(handoff));
    } catch (error) {
      handoffInFlight.current = false; // allow "Try again"
      setHandoffError(
        toApiError(error).message ||
          'Could not hand your session to the desktop app. Try again.',
      );
    }
  }, [handoffState, handoffChallenge]);

  // Already signed in in this browser: hand the session straight to the app.
  useEffect(() => {
    if (authUser && isDesktopHandoff && !desktopHandoffRunning) {
      void runDesktopHandoff();
    }
  }, [authUser, isDesktopHandoff, desktopHandoffRunning, runDesktopHandoff]);

  // Start mobile device auth request
  const startMobileQRLogin = async () => {
    setIsMobileQRMode(true);
    setDeviceAuthLoading(true);
    setDeviceAuthError(null);

    try {
      const res = await authApi.createDeviceAuth({
        clientName: 'OneTab AI Desktop',
        platform:
          typeof navigator !== 'undefined'
            ? navigator.platform || 'Desktop PC'
            : 'Desktop PC',
      });
      setDeviceAuthData(res);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to initialize mobile sign-in.';
      setDeviceAuthError(msg);
    } finally {
      setDeviceAuthLoading(false);
    }
  };

  const cancelMobileQRLogin = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsMobileQRMode(false);
    setDeviceAuthData(null);
    setDeviceAuthError(null);
  };

  // Poll device auth status while in Mobile QR mode
  useEffect(() => {
    if (!isMobileQRMode || !deviceAuthData) return;

    let isSubscribed = true;

    pollTimerRef.current = setInterval(async () => {
      try {
        const statusRes = await authApi.pollDeviceAuthStatus({
          requestId: deviceAuthData.requestId,
          secretToken: deviceAuthData.secretToken,
        });

        if (!isSubscribed) return;

        if (statusRes.status === 'approved') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);

          const exchangeRes = await authApi.exchangeDeviceAuth({
            requestId: deviceAuthData.requestId,
            secretToken: deviceAuthData.secretToken,
          });

          setAccessToken(exchangeRes.accessToken);
          setSession(exchangeRes.user, exchangeRes.accessToken);

          completeNavigation();
        } else if (statusRes.status === 'rejected') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeviceAuthError(
            'Mobile sign-in request was rejected on your device.',
          );
        } else if (statusRes.status === 'expired') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeviceAuthError(
            'This sign-in request has expired. Please try again.',
          );
        }
      } catch {
        // Continue polling or ignore network hiccups
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isMobileQRMode, deviceAuthData, setSession, completeNavigation]);

  useEffect(() => {
    trackAuthEvent('auth_login_view');
  }, []);

  const switchToPassword = useCallback(() => {
    setAuthMode('password');
    setMagicLinkSent(false);
  }, []);

  /** After the session exists: hand it to the desktop app, or go on in. */
  const finishSignIn = async () => {
    if (isDesktopHandoff) {
      await runDesktopHandoff();
      return;
    }
    completeNavigation();
  };

  const handlePasswordLogin = async (values: LoginInput) => {
    try {
      trackAuthEvent('auth_password_login_started', {
        emailDomain: values.email.includes('@') ? values.email.split('@')[1] : undefined,
      });
      const result = await login.mutateAsync(values);
      if (isTwoFactorChallenge(result)) {
        setTwoFactor(result);
        return;
      }
      trackAuthEvent('auth_password_login_success');
      await finishSignIn();
    } catch {
      // Rendered by <FormError>
    }
  };

  const handleCopyCode = () => {
    if (deviceAuthData?.userCode) {
      navigator.clipboard.writeText(deviceAuthData.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (desktopHandoffRunning) {
    return (
      <DesktopHandoffPanel
        callbackUrl={handoffUrl}
        error={handoffError}
        onRetry={() => void runDesktopHandoff()}
      />
    );
  }

  // MOBILE QR VIEW
  if (isMobileQRMode) {
    return (
      <AuthLayout
        title="Sign in with Mobile"
        subtitle="Scan this code or enter the pairing code on your mobile device."
        footer={
          <button
            type="button"
            onClick={cancelMobileQRLogin}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to standard sign in
          </button>
        }
      >
        <div className="space-y-4 text-center">
          {deviceAuthLoading ? (
            <div className="py-12 gap-3 flex flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-foreground" />
              <p className="text-xs text-muted-foreground">
                Generating secure pairing code…
              </p>
            </div>
          ) : deviceAuthError ? (
            <div className="py-6 space-y-4">
              <p className="text-xs text-destructive">{deviceAuthError}</p>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={startMobileQRLogin}
              >
                Try Again
              </Button>
            </div>
          ) : deviceAuthData ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-white shadow-inner mx-auto flex w-fit justify-center rounded-xl border border-border">
                <QRCode value={deviceAuthData.verificationUrl} size={180} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Or enter this code on mobile:
                </p>
                <div className="gap-2 flex items-center justify-center">
                  <span className="text-xl font-bold tracking-wider px-3 py-1 rounded-lg border border-border bg-surface font-mono text-foreground">
                    {deviceAuthData.userCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label="Copy code"
                    className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedCode ? (
                      <CheckCircle2 className="size-4 text-success-text" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="gap-2 pt-1 text-xs flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Waiting for mobile confirmation…</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={cancelMobileQRLogin}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      </AuthLayout>
    );
  }

  /*
   * Inside the desktop app there is no sign-in form: authentication happens in
   * the system browser (every method, one implementation) and comes back over
   * `onetab://`. Phone pairing (above) stays available as the second path.
   */
  if (isDesktop) {
    return <DesktopBrowserSignIn onUseMobile={() => void startMobileQRLogin()} />;
  }

  if (twoFactor) {
    return (
      <AuthLayout
        title="Verify it's you"
        subtitle="Your account has two-factor authentication turned on."
      >
        <TwoFactorChallengePanel
          challenge={twoFactor}
          onSignedIn={() => {
            trackAuthEvent('auth_password_login_success');
            void finishSignIn();
          }}
          onCancel={() => {
            setTwoFactor(null);
            login.reset();
            form.setValue('password', '');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={
        authMode === 'magic-link'
          ? magicLinkSent
            ? 'Check your email'
            : 'Sign in with a magic link'
          : 'Welcome back'
      }
      subtitle={
        authMode === 'magic-link'
          ? magicLinkSent
            ? 'Open the link on this device to finish signing in.'
            : "Enter your work email and we'll send you a secure sign-in link."
          : 'Enter your credentials to access your account.'
      }
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to={withDesktopHandoff('/register', searchParams)}
            className="font-medium text-foreground hover:underline transition-colors"
          >
            Create one
          </Link>
        </>
      }
    >
      {isDesktopHandoff && handoffState ? (
        <div
          role="note"
          className="mb-4 gap-2.5 p-3 text-xs flex items-start rounded-lg border border-info/25 bg-info/10 text-info-text"
        >
          <Laptop aria-hidden className="size-4 mt-px shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Signing in to OneTab AI Desktop</p>
            <p className="mt-0.5">After you sign in, you’ll be sent back to the app.</p>
          </div>
          <button
            type="button"
            className="shrink-0 font-medium underline-offset-2 hover:underline"
            onClick={() => {
              window.location.href = desktopCancelUrl(handoffState);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* VIEW: MAGIC LINK MODE */}
      {authMode === 'magic-link' ? (
        <MagicLinkPanel
          initialEmail={form.getValues('email')}
          onUsePassword={switchToPassword}
          onSentChange={setMagicLinkSent}
        />
      ) : (
        /* FORM: PASSWORD SIGN-IN MODE */
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handlePasswordLogin)}
            className="space-y-3"
            noValidate
          >
            <FormError error={formErrorMessage(login.error)} />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1 text-left">
                  <FormLabel className="text-xs">Work Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      autoComplete="username"
                      placeholder="your@company.com"
                      leadingIcon={<Mail />}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs">Password</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      trailingSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          className="flex items-center text-subtle hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      }
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="space-x-2 space-y-0 flex flex-row items-center pt-0.5">
                  <FormControl>
                    <Checkbox
                      id="rememberMe"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="rememberMe"
                    className="text-xs font-normal cursor-pointer text-muted-foreground select-none"
                  >
                    Remember me for 30 days
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="md"
              className="w-full mt-1"
              loading={form.formState.isSubmitting || login.isPending}
              trailingIcon={<ArrowRight className="size-3.5" />}
            >
              Sign in
            </Button>

            {magicLinkAvailable ? (
              <>
                {/* The label sits on the page background, not a card. */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="border-t border-border w-full absolute" />
                  <span className="bg-background px-2.5 text-[11px] text-muted-foreground relative uppercase tracking-wider">
                    or
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setAuthMode('magic-link');
                    setMagicLinkSent(false);
                    trackAuthEvent('auth_magic_link_started', {
                      method: 'magic_link',
                    });
                  }}
                  leadingIcon={<Sparkles className="size-3.5" />}
                >
                  Email me a sign-in link
                </Button>
              </>
            ) : null}
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}


