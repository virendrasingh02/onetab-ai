import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@org/ui';
import { resetPasswordSchema, type ResetPasswordInput } from '@org/validation';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
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
            className="font-medium text-white hover:underline transition-colors"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-xs text-zinc-400 text-center leading-relaxed">
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
          <div className="size-12 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/80 text-emerald-400">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
            For your security, all existing sessions have been signed out.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm mt-2"
          >
            <span>Continue to sign in</span>
            <ArrowRight className="size-4" />
          </button>
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
                <FormLabel className="text-xs text-zinc-300 font-medium">
                  New password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••••"
                      className="w-full h-8 pl-3 pr-8 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[11px] text-rose-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs text-zinc-300 font-medium">
                  Confirm new password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <input
                      {...field}
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••••"
                      className="w-full h-8 pl-3 pr-8 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[11px] text-rose-400" />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={form.formState.isSubmitting || resetPassword.isPending}
            className="w-full h-8 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
          >
            {form.formState.isSubmitting || resetPassword.isPending ? (
              <Loader2 className="size-3.5 animate-spin text-black" />
            ) : (
              <>
                <span>Update password</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </form>
      </Form>
    </AuthLayout>
  );
}

