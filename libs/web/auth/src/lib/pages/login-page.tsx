import { zodResolver } from '@hookform/resolvers/zod';
import { authApi, setAccessToken } from '@org/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { getDesktopApi, isDesktop } from '@org/web-desktop';
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
  Globe,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import {
  formErrorMessage,
  redirectPathFromAuthState,
  useLogin,
} from '../use-auth.js';
import { useAuthStore } from '../auth.store.js';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [authMode, setAuthMode] = useState<'magic-link' | 'password'>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [browserLoginStarting, setBrowserLoginStarting] = useState(false);
  const [desktopHandoffRunning, setDesktopHandoffRunning] = useState(false);

  // Mobile QR pairing mode state
  const [isMobileQRMode, setIsMobileQRMode] = useState(false);
  const [deviceAuthData, setDeviceAuthData] =
    useState<CreateDeviceAuthResponse | null>(null);
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(false);
  const [deviceAuthError, setDeviceAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isDesktopHandoff = searchParams.get('desktop') === 'true';
  const stateParam = searchParams.get('state');
  const codeChallengeParam = searchParams.get('code_challenge');

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const authStatus = useAuthStore((s) => s.status);

  // If already authenticated and not in a browser handoff flow, redirect immediately to app root
  useEffect(() => {
    if (authStatus === 'authenticated' && !isDesktopHandoff) {
      navigate(redirectPathFromAuthState(location.state), { replace: true });
    }
  }, [authStatus, isDesktopHandoff, location.state, navigate]);

  // If already logged in and desktop handoff query params are present, authorize immediately
  useEffect(() => {
    async function completeExistingSessionHandoff() {
      if (
        authUser &&
        isDesktopHandoff &&
        stateParam &&
        codeChallengeParam &&
        !desktopHandoffRunning
      ) {
        setDesktopHandoffRunning(true);
        try {
          const authRes = await authApi.authorizeDesktop({
            state: stateParam,
            codeChallenge: codeChallengeParam,
          });
          const callbackUrl = `onetab://auth/callback?code=${encodeURIComponent(authRes.code)}&state=${encodeURIComponent(stateParam)}`;
          window.location.href = callbackUrl;
        } catch {
          setDesktopHandoffRunning(false);
        }
      }
    }
    void completeExistingSessionHandoff();
  }, [
    authUser,
    isDesktopHandoff,
    stateParam,
    codeChallengeParam,
    desktopHandoffRunning,
  ]);

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

          navigate('/', { replace: true });
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
  }, [isMobileQRMode, deviceAuthData, setSession, navigate]);

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Passwordless / magic-link sign-in has no backend endpoint yet
    // (auth exposes only password, refresh, reset and device/QR flows).
    // Rather than fake a "link sent" screen, steer the user to the working
    // password flow. Wire the real request here once POST /auth/magic-link
    // exists.
    form.setError('email', {
      message:
        "Magic-link sign-in isn't available yet — please sign in with your password.",
    });
    setAuthMode('password');
  };

  const handlePasswordLogin = async (values: LoginInput) => {
    try {
      await login.mutateAsync(values);

      if (isDesktopHandoff && stateParam && codeChallengeParam) {
        setDesktopHandoffRunning(true);
        const authRes = await authApi.authorizeDesktop({
          state: stateParam,
          codeChallenge: codeChallengeParam,
        });
        const callbackUrl = `onetab://auth/callback?code=${encodeURIComponent(authRes.code)}&state=${encodeURIComponent(stateParam)}`;
        window.location.href = callbackUrl;
        return;
      }

      navigate(redirectPathFromAuthState(location.state), { replace: true });
    } catch {
      // Rendered by <FormError>
    }
  };

  const onBrowserLoginClick = async () => {
    setBrowserLoginStarting(true);
    try {
      await getDesktopApi()?.auth.startBrowserLogin();
    } finally {
      setTimeout(() => setBrowserLoginStarting(false), 2000);
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
      <div className="dark p-4 flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md w-full bg-surface border-border text-foreground shadow-2xl">
          <CardHeader className="pb-2 text-center">
            <div className="size-12 mb-3 mx-auto flex items-center justify-center rounded-full bg-surface-raised text-foreground">
              <Laptop className="size-6" />
            </div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Connecting to Desktop App
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Handing off authenticated session to OneTab AI Desktop…
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Please check your desktop application. If it didn&apos;t focus
              automatically, click below:
            </p>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => {
                if (stateParam) {
                  window.location.href = `onetab://open`;
                }
              }}
            >
              Open Desktop Client
            </Button>
          </CardContent>
        </Card>
      </div>
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

  return (
    <AuthLayout
      title="Sign in"
      subtitle={
        authMode === 'magic-link'
          ? 'Enter your work email to get a magic link.'
          : 'Enter your credentials to access your account.'
      }
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-foreground hover:underline transition-colors"
          >
            Create one
          </Link>
        </>
      }
    >
      {/* Desktop-only helpers: browser hand-off + mobile QR sign-in. */}
      {isDesktop && (
        <div className="space-y-2.5 mb-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            onClick={onBrowserLoginClick}
            loading={browserLoginStarting}
            leadingIcon={<Globe className="size-3.5" />}
          >
            Continue with Browser (Recommended)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            onClick={startMobileQRLogin}
            leadingIcon={<Smartphone className="size-3.5 text-muted-foreground" />}
          >
            Sign in with Mobile (QR)
          </Button>
        </div>
      )}

      {/* FORM: MAGIC LINK MODE */}
      {authMode === 'magic-link' ? (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="your@company.com"
              value={form.watch('email')}
              onChange={(e) => form.setValue('email', e.target.value)}
              leadingIcon={<Mail />}
              invalid={!!form.formState.errors.email}
            />
            {form.formState.errors.email && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground text-left pt-0.5">
              We&apos;ll email a secure sign-in link.
            </p>
          </div>

          <Button
            type="submit"
            size="md"
            className="w-full"
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Continue with magic link
          </Button>
        </form>
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
          </form>
        </Form>
      )}

      {/* Mode Switcher Link */}

      <div className="mt-4 text-center">
        {authMode === 'magic-link' ? (
          <button
            type="button"
            onClick={() => setAuthMode('password')}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="size-3.5" />
            <span>Sign in with password instead</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthMode('magic-link')}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="size-3.5" />
            <span>Sign in with magic link instead</span>
          </button>
        )}
      </div>
    </AuthLayout>
  );
}


