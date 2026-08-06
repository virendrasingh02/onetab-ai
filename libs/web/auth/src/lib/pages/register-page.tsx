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
import { registerSchema, type RegisterInput } from '@org/validation';
import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { formErrorMessage, useRegister } from '../use-auth.js';

/** Live checklist so the password rules are visible before submitting. */
const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (v: string) => v.length >= 10 },
  { label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'A number', test: (v: string) => /[0-9]/.test(v) },
];

export function RegisterPage() {
  const register = useRegister();
  const navigate = useNavigate();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });

  const password = form.watch('password') ?? '';

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      // A brand-new account has no workspace yet.
      navigate('/workspaces/new', { replace: true });
    } catch {
      // Surfaced through <FormError> / field errors.
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start collaborating with your team in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError error={formErrorMessage(register.error)} />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work email</FormLabel>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••••"
                  />
                </FormControl>
                <ul className="mt-1 gap-1 grid grid-cols-2">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={
                          met
                            ? 'gap-1 text-xs flex items-center text-success'
                            : 'gap-1 text-xs flex items-center text-muted-foreground'
                        }
                      >
                        <Check
                          className={met ? 'size-3' : 'size-3 opacity-30'}
                          aria-hidden
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
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
            name="acceptTerms"
            render={({ field }) => (
              <FormItem>
                <div className="gap-2.5 text-sm flex items-start">
                  <Checkbox
                    id="acceptTerms"
                    checked={!!field.value}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="mt-0.5"
                  />
                  <label htmlFor="acceptTerms" className="text-muted-foreground cursor-pointer select-none">
                    I agree to the Terms of Service and Privacy Policy.
                  </label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            loading={form.formState.isSubmitting || register.isPending}
          >
            Create account
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You will set up your first workspace next.
          </p>
        </form>
      </Form>
    </AuthLayout>
  );
}
