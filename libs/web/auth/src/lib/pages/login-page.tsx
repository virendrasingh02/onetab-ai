import { zodResolver } from '@hookform/resolvers/zod';
import { authApi, setAccessToken } from '@org/api-client';
import {
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
      <div className="p-4 flex min-h-screen items-center justify-center bg-[#09090b]">
        <Card className="max-w-md w-full bg-[#121214] border-zinc-800 text-zinc-100 shadow-2xl rounded-xl">
          <CardHeader className="pb-2 text-center">
            <div className="size-12 mb-3 mx-auto flex items-center justify-center rounded-full bg-zinc-800 text-white">
              <Laptop className="size-6 text-white" />
            </div>
            <CardTitle className="text-lg font-semibold text-white">
              Connecting to Desktop App
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Handing off authenticated session to OneTab AI Desktop…
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 text-center">
            <p className="text-xs text-zinc-400">
              Please check your desktop application. If it didn&apos;t focus
              automatically, click below:
            </p>
            <button
              type="button"
              className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-sm transition-colors"
              onClick={() => {
                if (stateParam) {
                  window.location.href = `onetab://open`;
                }
              }}
            >
              Open Desktop Client
            </button>
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
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Back to standard sign in
          </button>
        }
      >
        <div className="space-y-4 text-center">
          {deviceAuthLoading ? (
            <div className="py-12 gap-3 flex flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-white" />
              <p className="text-xs text-zinc-400">
                Generating secure pairing code…
              </p>
            </div>
          ) : deviceAuthError ? (
            <div className="py-6 space-y-4">
              <p className="text-xs text-rose-400">{deviceAuthError}</p>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium"
                onClick={startMobileQRLogin}
              >
                Try Again
              </button>
            </div>
          ) : deviceAuthData ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-white shadow-inner mx-auto flex w-fit justify-center rounded-xl border border-zinc-700">
                <QRCode value={deviceAuthData.verificationUrl} size={180} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-zinc-400">
                  Or enter this code on mobile:
                </p>
                <div className="gap-2 flex items-center justify-center">
                  <span className="text-xl font-bold tracking-wider px-3 py-1 rounded-lg border border-zinc-800 bg-[#121214] font-mono text-white">
                    {deviceAuthData.userCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label="Copy code"
                    className="p-2 rounded-lg border border-zinc-800 bg-[#121214] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    {copiedCode ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="gap-2 pt-1 text-xs flex items-center justify-center text-zinc-400">
                <Loader2 className="size-3.5 animate-spin text-zinc-400" />
                <span>Waiting for mobile confirmation…</span>
              </div>

              <button
                type="button"
                className="w-full h-9 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                onClick={cancelMobileQRLogin}
              >
                Cancel
              </button>
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
            className="font-medium text-white hover:underline transition-colors"
          >
            Create one
          </Link>
        </>
      }
    >
      {/* Desktop-only helpers: browser hand-off + mobile QR sign-in. */}
      {isDesktop && (
        <div className="space-y-2.5 mb-4">
          <button
            type="button"
            className="w-full h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
            onClick={onBrowserLoginClick}
            disabled={browserLoginStarting}
          >
            {browserLoginStarting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Globe className="size-3.5" />
            )}
            <span>Continue with Browser (Recommended)</span>
          </button>

          <button
            type="button"
            className="w-full h-8 px-3 rounded-lg bg-[#121214] hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            onClick={startMobileQRLogin}
          >
            <Smartphone className="size-3.5 text-zinc-400" />
            <span>Sign in with Mobile (QR)</span>
          </button>
        </div>
      )}

      {/* FORM: MAGIC LINK MODE */}
      {authMode === 'magic-link' ? (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1.5">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                <Mail className="size-3.5 text-zinc-500" />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="your@company.com"
                value={form.watch('email')}
                onChange={(e) => form.setValue('email', e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-[11px] text-rose-400">
                {form.formState.errors.email.message}
              </p>
            )}
            <p className="text-[11px] text-zinc-400 text-left pt-0.5">
              We&apos;ll email a secure sign-in link.
            </p>
          </div>

          <button
            type="submit"
            className="w-full h-8 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>Continue with magic link</span>
            <ArrowRight className="size-3.5" />
          </button>
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
                  <FormLabel className="text-xs text-zinc-300 font-medium">
                    Work Email
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                        <Mail className="size-3.5 text-zinc-500" />
                      </div>
                      <input
                        {...field}
                        type="email"
                        autoComplete="username"
                        placeholder="your@company.com"
                        className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px] text-rose-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1 text-left">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs text-zinc-300 font-medium">
                      Password
                    </FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••••"
                        className="w-full h-8 pl-3 pr-8 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px] text-rose-400" />
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
                      className="border-zinc-700 data-[state=checked]:bg-white data-[state=checked]:text-black"
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="rememberMe"
                    className="text-xs font-normal cursor-pointer text-zinc-400 select-none"
                  >
                    Remember me for 30 days
                  </FormLabel>
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={form.formState.isSubmitting || login.isPending}
              className="w-full h-8 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
            >
              {form.formState.isSubmitting || login.isPending ? (
                <Loader2 className="size-3.5 animate-spin text-black" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>
        </Form>
      )}

      {/* Mode Switcher Link */}

      <div className="mt-4 text-center">
        {authMode === 'magic-link' ? (
          <button
            type="button"
            onClick={() => setAuthMode('password')}
            className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <KeyRound className="size-3.5" />
            <span>Sign in with password instead</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthMode('magic-link')}
            className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="size-3.5" />
            <span>Sign in with magic link instead</span>
          </button>
        )}
      </div>
    </AuthLayout>
  );
}


