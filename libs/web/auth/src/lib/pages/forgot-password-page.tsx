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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@org/validation';
import { ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useForgotPassword } from '../use-auth.js';

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgotPassword.mutateAsync(values);
    } catch {
      // Surfaced by <FormError>.
    }
  });

  if (forgotPassword.isSuccess) {
    const devToken = forgotPassword.data?.devToken;
    return (
      <AuthLayout
        title="Check your email"
        subtitle={forgotPassword.data?.message}
        footer={
          <Link
            to="/login"
            className="font-medium text-white hover:underline transition-colors"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="gap-4 py-4 flex flex-col items-center text-center">
          <div className="size-12 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/80 text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
            If an account exists for that address, we have sent a link to reset
            your password. The link expires in one hour.
          </p>

          {devToken ? (
            <div className="mt-2 p-3 w-full rounded-lg bg-[#121214] border border-zinc-800 text-left">
              <p className="mb-1 text-[11px] font-medium text-zinc-400">
                Development only:
              </p>
              <Link
                to={`/reset-password?token=${devToken}`}
                className="text-[11px] font-mono break-all text-white hover:underline"
              >
                /reset-password?token={devToken}
              </Link>
            </div>
          ) : null}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter your work email and we will send you a reset link."
      footer={
        <Link
          to="/login"
          className="font-medium text-white hover:underline transition-colors"
        >
          Back to sign in
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError error={formErrorMessage(forgotPassword.error)} />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs text-zinc-300 font-medium">
                  Work email
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <Mail className="size-3.5 text-zinc-500" />
                    </div>
                    <input
                      {...field}
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[11px] text-rose-400" />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={form.formState.isSubmitting || forgotPassword.isPending}
            className="w-full h-8 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
          >
            {form.formState.isSubmitting || forgotPassword.isPending ? (
              <Loader2 className="size-3.5 animate-spin text-black" />
            ) : (
              <>
                <span>Send reset link</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </form>
      </Form>
    </AuthLayout>
  );
}

