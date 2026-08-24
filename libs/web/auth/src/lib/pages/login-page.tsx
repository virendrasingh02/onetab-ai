import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@org/api-client';
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
  Separator,
} from '@org/ui';
import { getDesktopApi, isDesktop } from '@org/web-desktop';
import { loginSchema, type LoginInput } from '@org/validation';
import { Eye, EyeOff, Globe, Laptop } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useLogin } from '../use-auth.js';
import { useAuthStore } from '../auth.store.js';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);

  const [showPassword, setShowPassword] = useState(false);
  const [browserLoginStarting, setBrowserLoginStarting] = useState(false);
  const [desktopHandoffRunning, setDesktopHandoffRunning] = useState(false);
  const [showDirectCredentials] = useState(!isDesktop);

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
      const from = (location.state as { from?: { pathname?: string } } | null)?.from;
      navigate(from?.pathname ?? '/', { replace: true });
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

      // Return the user to whatever they were trying to reach.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from;
      navigate(from?.pathname ?? '/', { replace: true });
    } catch {
      // Rendered by <FormError>; nothing to do here.
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

  return (
    <AuthLayout
      title="Sign in to OneTab AI"
      subtitle={
        isDesktopHandoff
          ? 'Sign in to connect your account to the OneTab AI Desktop application.'
          : isDesktop
            ? 'Sign in using your browser or credentials.'
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
        <div className="space-y-4 mb-4">
          <Button
            type="button"
            className="w-full gap-2 h-10"
            onClick={onBrowserLoginClick}
            loading={browserLoginStarting}
          >
            <Globe className="size-4" />
            <span>Sign in with Browser (Recommended)</span>
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
