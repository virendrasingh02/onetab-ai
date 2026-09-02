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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@org/validation';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
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
            className="font-medium text-foreground hover:underline transition-colors"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="gap-4 py-4 flex flex-col items-center text-center">
          <div className="size-12 flex items-center justify-center rounded-full bg-surface-raised border border-border text-success-text">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            If an account exists for that address, we have sent a link to reset
            your password. The link expires in one hour.
          </p>

          {devToken ? (
            <div className="mt-2 p-3 w-full rounded-lg bg-surface border border-border text-left">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                Development only:
              </p>
              <Link
                to={`/reset-password?token=${devToken}`}
                className="text-[11px] font-mono break-all text-foreground hover:underline"
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
          className="font-medium text-foreground hover:underline transition-colors"
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
                <FormLabel className="text-xs">Work email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    leadingIcon={<Mail />}
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
            loading={form.formState.isSubmitting || forgotPassword.isPending}
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}

