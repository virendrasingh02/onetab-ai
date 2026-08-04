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
import { ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useResetPassword } from '../use-auth.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPassword = useResetPassword();
  const navigate = useNavigate();

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
        subtitle="This link is missing its token."
        footer={
          <Link
            to="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Password reset links expire after one hour and can only be used once.
          Request a fresh one to continue.
        </p>
      </AuthLayout>
    );
  }

  if (resetPassword.isSuccess) {
    return (
      <AuthLayout title="Password updated" subtitle="You can now sign in.">
        <div className="gap-4 py-4 flex flex-col items-center text-center">
          <div className="size-11 flex items-center justify-center rounded-full bg-success/10 text-success">
            <ShieldCheck className="size-5" />
          </div>
          <p className="text-sm text-balance text-muted-foreground">
            For your security, every other session has been signed out.
          </p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Continue to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Make it long — length matters more than symbols."
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError error={formErrorMessage(resetPassword.error)} />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••••"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••••"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            loading={form.formState.isSubmitting || resetPassword.isPending}
          >
            Update password
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
