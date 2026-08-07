import { zodResolver } from '@hookform/resolvers/zod';
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
} from '@org/ui';
import { loginSchema, type LoginInput } from '@org/validation';
import { Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useLogin } from '../use-auth.js';

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const handleLogin = async (values: LoginInput) => {
    try {
      await login.mutateAsync(values);
      // Return the user to whatever they were trying to reach.
      const from = (location.state as { from?: { pathname?: string } } | null)
        ?.from;
      navigate(from?.pathname ?? '/', { replace: true });
    } catch {
      // Rendered by <FormError>; nothing to do here.
    }
  };

  const onSubmit = form.handleSubmit(handleLogin);

  const handleQuickDemoLogin = (email: string) => {
    const password = 'password123';
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', password, { shouldValidate: true });
    form.setValue('rememberMe', true);
    void handleLogin({ email, password, rememberMe: true });
  };

  return (
    <AuthLayout
      title="Sign in to OneTab AI"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
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
                    placeholder="admin@onetab.ai or dev@onetab.ai"
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
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or quick sign-in with demo accounts
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => handleQuickDemoLogin('admin@onetab.ai')}
              disabled={form.formState.isSubmitting || login.isPending}
            >
              <ShieldCheck className="mr-1.5 size-3.5 text-primary" />
              Admin Demo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => handleQuickDemoLogin('dev@onetab.ai')}
              disabled={form.formState.isSubmitting || login.isPending}
            >
              <UserCheck className="mr-1.5 size-3.5 text-primary" />
              Developer Demo
            </Button>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
