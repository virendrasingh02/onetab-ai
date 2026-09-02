import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@org/ui';
import { resetPasswordSchema, type ResetPasswordInput } from '@org/validation';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useResetPassword } from '../use-auth.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPassword = useResetPassword();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync(values);
    } catch {
      // Surfaced by <FormError>.
    }
  });

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle="This link is missing its token or has expired."
        footer={
          <Link
            to="/forgot-password"
            className="font-medium text-foreground hover:underline transition-colors"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Password reset links expire after one hour and can only be used once.
          Request a fresh one to continue.
        </p>
      </AuthLayout>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <AuthLayout title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="gap-4 py-4 flex flex-col items-center text-center">
          <div className="size-12 flex items-center justify-center rounded-full bg-surface-raised border border-border text-success-text">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            For your security, all existing sessions have been signed out.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => navigate('/login')}
            className="w-full mt-2"
            trailingIcon={<ArrowRight className="size-4" />}
          >
            Continue to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Make it strong — length matters more than complex symbols."
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
          <FormError error={formErrorMessage(resetPassword.error)} />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs">New password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    trailingSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="flex items-center text-subtle hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
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
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs">Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    trailingSlot={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        className="flex items-center text-subtle hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    }
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="md"
            className="w-full mt-1"
            loading={form.formState.isSubmitting || resetPassword.isPending}
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Update password
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

