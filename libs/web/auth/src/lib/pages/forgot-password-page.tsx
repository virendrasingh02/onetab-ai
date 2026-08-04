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
import { MailCheck } from 'lucide-react';
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

  // The success screen is identical regardless of whether the account exists —
  // the API deliberately gives no signal, and neither should the UI.
  if (forgotPassword.isSuccess) {
    const devToken = forgotPassword.data?.devToken;
    return (
      <AuthLayout
        title="Check your email"
        subtitle={forgotPassword.data?.message}
        footer={
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="gap-3 py-4 flex flex-col items-center text-center">
          <div className="size-11 flex items-center justify-center rounded-full bg-success/10 text-success">
            <MailCheck className="size-5" />
          </div>
          <p className="text-sm text-balance text-muted-foreground">
            If an account exists for that address, we have sent a link to reset
            your password. The link expires in one hour.
          </p>

          {devToken ? (
            <div className="mt-2 p-3 w-full rounded-md bg-muted text-left">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Development only — no mail transport is configured yet:
              </p>
              <Link
                to={`/reset-password?token=${devToken}`}
                className="text-xs font-mono break-all text-primary hover:underline"
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
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
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
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            loading={form.formState.isSubmitting || forgotPassword.isPending}
          >
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
