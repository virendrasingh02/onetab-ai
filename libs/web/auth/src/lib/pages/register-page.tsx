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
import { ArrowRight, Check, Eye, EyeOff, Mail, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import {
  formErrorMessage,
  redirectPathFromAuthState,
  useRegister,
} from '../use-auth.js';


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
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      email:
        (location.state as { email?: string } | null)?.email ?? '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });

  const password = form.watch('password') ?? '';

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      navigate(redirectPathFromAuthState(location.state, '/workspaces/new'), {
        replace: true,
      });
    } catch {
      // Surfaced through <FormError> / field errors.
    }
  });

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start collaborating with your team in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-foreground hover:underline transition-colors"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>

        <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
          <FormError error={formErrorMessage(register.error)} />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs">Full name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    leadingIcon={<User />}
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs">Password</FormLabel>
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
                <ul className="mt-1 gap-1.5 grid grid-cols-2">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={
                          met
                            ? 'gap-1 text-[11px] flex items-center text-success-text'
                            : 'gap-1 text-[11px] flex items-center text-muted-foreground'
                        }
                      >
                        <Check
                          className={met ? 'size-3 text-success-text' : 'size-3 opacity-30'}
                          aria-hidden
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs">Confirm password</FormLabel>
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

          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <div className="gap-2 text-xs flex items-start pt-0.5">
                  <Checkbox
                    id="acceptTerms"
                    checked={!!field.value}
                    onCheckedChange={(checked) => field.onChange(!!checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="acceptTerms"
                    className="text-muted-foreground cursor-pointer select-none leading-tight"
                  >
                    I agree to the Terms of Service and Privacy Policy.
                  </label>
                </div>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="md"
            className="w-full mt-1"
            loading={form.formState.isSubmitting || register.isPending}
            trailingIcon={<ArrowRight className="size-3.5" />}
          >
            Create account
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}


