import { zodResolver } from '@hookform/resolvers/zod';
import {
  Checkbox,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@org/ui';
import { registerSchema, type RegisterInput } from '@org/validation';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Mail, User } from 'lucide-react';
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
            className="font-medium text-white hover:underline transition-colors"
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
                <FormLabel className="text-xs text-zinc-300 font-medium">
                  Full name
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <User className="size-3.5 text-zinc-500" />
                    </div>
                    <input
                      {...field}
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-500 text-xs focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[11px] text-rose-400" />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1 text-left">
                <FormLabel className="text-xs text-zinc-300 font-medium">
                  Password
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
                <ul className="mt-1 gap-1.5 grid grid-cols-2">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={
                          met
                            ? 'gap-1 text-[11px] flex items-center text-emerald-400'
                            : 'gap-1 text-[11px] flex items-center text-zinc-500'
                        }
                      >
                        <Check
                          className={met ? 'size-3 text-emerald-400' : 'size-3 opacity-30'}
                          aria-hidden
                        />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
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
                  Confirm password
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
                    className="mt-0.5 border-zinc-700 data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                  <label
                    htmlFor="acceptTerms"
                    className="text-zinc-400 cursor-pointer select-none leading-tight"
                  >
                    I agree to the Terms of Service and Privacy Policy.
                  </label>
                </div>
                <FormMessage className="text-[11px] text-rose-400" />
              </FormItem>
            )}
          />

          <button
            type="submit"
            disabled={form.formState.isSubmitting || register.isPending}
            className="w-full h-8 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
          >
            {form.formState.isSubmitting || register.isPending ? (
              <Loader2 className="size-3.5 animate-spin text-black" />
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </form>
      </Form>
    </AuthLayout>
  );
}


