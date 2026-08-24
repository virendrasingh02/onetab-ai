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
  Separator,
} from '@org/ui';
import { getDesktopApi, isDesktop } from '@org/web-desktop';
import { loginSchema, type CreateDeviceAuthResponse, type LoginInput } from '@org/validation';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Laptop,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useLogin } from '../use-auth.js';
import { useAuthStore } from '../auth.store.js';

/**
 * Resolves the post-login destination from router state, preserving the
 * query string. A bare `pathname` would drop e.g. `?request=...` on the
 * mobile device-pairing confirm page, stranding the user with no request id.
 */
function redirectPathFromState(state: unknown): string {
  const from = (
    state as { from?: { pathname?: string; search?: string; hash?: string } } | null
  )?.from;
  if (!from?.pathname) return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [showPassword, setShowPassword] = useState(false);
  const [browserLoginStarting, setBrowserLoginStarting] = useState(false);
  const [desktopHandoffRunning, setDesktopHandoffRunning] = useState(false);
  const [showDirectCredentials] = useState(!isDesktop);

  // Mobile QR pairing mode state
  const [isMobileQRMode, setIsMobileQRMode] = useState(false);
  const [deviceAuthData, setDeviceAuthData] = useState<CreateDeviceAuthResponse | null>(null);
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(false);
  const [deviceAuthError, setDeviceAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isDesktopHandoff = searchParams.get('desktop') === 'true';
  const stateParam = searchParams.get('state');
  const codeChallengeParam = searchParams.get('code_challenge');

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const authStatus = useAuthStore((s) => s.status);

  // If already authenticated and not in a browser handoff flow, redirect immediately to app root
  useEffect(() => {
    if (authStatus === 'authenticated' && !isDesktopHandoff) {
      navigate(redirectPathFromState(location.state), { replace: true });
    }
  }, [authStatus, isDesktopHandoff, location.state, navigate]);

  // If already logged in and desktop handoff query params are present, authorize immediately
  useEffect(() => {
    async function completeExistingSessionHandoff() {
      if (authUser && isDesktopHandoff && stateParam && codeChallengeParam && !desktopHandoffRunning) {
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
  }, [authUser, isDesktopHandoff, stateParam, codeChallengeParam, desktopHandoffRunning]);

  // Start mobile device auth request
  const startMobileQRLogin = async () => {
    setIsMobileQRMode(true);
    setDeviceAuthLoading(true);
    setDeviceAuthError(null);

    try {
      const res = await authApi.createDeviceAuth({
        clientName: 'OneTab AI Desktop',
        platform: typeof navigator !== 'undefined' ? (navigator.platform || 'Desktop PC') : 'Desktop PC',
      });
      setDeviceAuthData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize mobile sign-in.';
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

          // Exchange approved request for session tokens
          const exchangeRes = await authApi.exchangeDeviceAuth({
            requestId: deviceAuthData.requestId,
            secretToken: deviceAuthData.secretToken,
          });

          setAccessToken(exchangeRes.accessToken);
          setSession(exchangeRes.user, exchangeRes.accessToken);

          navigate('/', { replace: true });
        } else if (statusRes.status === 'rejected') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeviceAuthError('Mobile sign-in request was rejected on your device.');
        } else if (statusRes.status === 'expired') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setDeviceAuthError('This sign-in request has expired. Please try again.');
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

  const handleLogin = async (values: LoginInput) => {
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

      navigate(redirectPathFromState(location.state), { replace: true });
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

  const onSubmit = form.handleSubmit(handleLogin);

  if (desktopHandoffRunning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Laptop className="size-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Connecting to Desktop App</CardTitle>
            <CardDescription className="text-xs">
              Handing off authenticated session to OneTab AI Desktop…
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Please check your desktop application. If it didn&apos;t focus automatically, click below:
            </p>
            <Button
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
          <Button variant="ghost" size="sm" onClick={cancelMobileQRLogin} className="text-xs">
            Back to standard sign in
          </Button>
        }
      >
        <div className="space-y-4 text-center">
          {deviceAuthLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Generating secure pairing code…</p>
            </div>
          ) : deviceAuthError ? (
            <div className="py-6 space-y-4">
              <p className="text-xs text-destructive">{deviceAuthError}</p>
              <Button size="sm" onClick={startMobileQRLogin}>
                Try Again
              </Button>
            </div>
          ) : deviceAuthData ? (
            <div className="space-y-4">
              <div className="flex justify-center p-3 bg-white rounded-xl shadow-inner border border-border/80 w-fit mx-auto">
                <QRCode value={deviceAuthData.verificationUrl} size={180} />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Or enter this code on mobile:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-bold tracking-wider bg-surface-muted px-3 py-1 rounded-lg border border-border">
                    {deviceAuthData.userCode}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={handleCopyCode}
                    aria-label="Copy code"
                  >
                    {copiedCode ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>Waiting for mobile confirmation…</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
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
      title="Sign in to OneTab AI"
      subtitle={
        isDesktopHandoff
          ? 'Sign in to connect your account to the OneTab AI Desktop application.'
          : isDesktop
            ? 'Sign in using your browser, mobile app, or credentials.'
            : 'Welcome back. Enter your details to continue.'
      }
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {isDesktop && (
        <div className="space-y-3 mb-4">
          <Button
            type="button"
            className="w-full gap-2 h-10 font-medium"
            onClick={onBrowserLoginClick}
            loading={browserLoginStarting}
          >
            <Globe className="size-4" />
            <span>Continue with Browser (Recommended)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 h-10"
            onClick={startMobileQRLogin}
          >
            <Smartphone className="size-4 text-primary" />
            <span>Sign in with Mobile (QR)</span>
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-surface px-2 text-muted-foreground">
                or sign in with password
              </span>
            </div>
          </div>
        </div>
      )}

      {(!isDesktop || showDirectCredentials) && (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormError error={formErrorMessage(login.error)} />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email or Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      autoComplete="username"
                      placeholder="you@company.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </Button>
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      id="rememberMe"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="rememberMe"
                    className="cursor-pointer text-xs font-normal text-muted-foreground"
                  >
                    Remember me for 30 days
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              loading={form.formState.isSubmitting || login.isPending}
            >
              Sign in
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
