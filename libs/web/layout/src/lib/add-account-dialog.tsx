import { zodResolver } from '@hookform/resolvers/zod';
import { isTwoFactorChallenge } from '@org/api-client';
import {
  formErrorMessage,
  TwoFactorChallengePanel,
  useAddAccount,
  useSignUpAccount,
} from '@org/auth';
import type { TwoFactorChallengeResponse } from '@org/types';
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@org/ui';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@org/validation';
import { AtSign, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The footer's submit button sits outside the forms and targets them by id.
const LOGIN_FORM_ID = 'add-account-login';
const SIGNUP_FORM_ID = 'add-account-signup';

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="flex items-center text-subtle hover:text-foreground transition-colors"
    >
      {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  );
}

const fieldIcon = (icon: ReactNode) => (
  <span className="flex text-subtle [&>svg]:size-3.5">{icon}</span>
);

export function AddAccountDialog({
  open,
  onOpenChange,
}: AddAccountDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const addAccount = useAddAccount();
  const signUp = useSignUpAccount();
  // The account being added has two-factor on: its code is still owed.
  const [twoFactor, setTwoFactor] = useState<TwoFactorChallengeResponse | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const signupForm = useForm<RegisterInput>({
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

  const close = () => {
    onOpenChange(false);
    setMode('login');
    loginForm.reset();
    signupForm.reset();
    addAccount.reset();
    signUp.reset();
    setTwoFactor(null);
    setShowPassword(false);
  };

  const handleLogin = loginForm.handleSubmit(async (values) => {
    try {
      const data = await addAccount.mutateAsync(values);
      if (isTwoFactorChallenge(data)) {
        setTwoFactor(data);
        return;
      }
      toast.success(`Signed in as ${data.user.displayName ?? data.user.name}.`);
      close();
    } catch {
      // Shown inline from `addAccount.error` / field errors.
    }
  });

  const handleSignup = signupForm.handleSubmit(async (values) => {
    try {
      const data = await signUp.mutateAsync(values);
      toast.success(
        `Account created for ${data.user.displayName ?? data.user.name}.`,
      );
      close();
    } catch {
      // Shown inline from `signUp.error` / field errors.
    }
  });

  const isLogin = mode === 'login';
  const submitting = isLogin
    ? loginForm.formState.isSubmitting || addAccount.isPending
    : signupForm.formState.isSubmitting || signUp.isPending;
  const passwordType = showPassword ? 'text' : 'password';
  const passwordToggle = (
    <PasswordToggle
      visible={showPassword}
      onToggle={() => setShowPassword((v) => !v)}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3 pr-12 pb-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-4" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-base">Add another account</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Your current account stays signed in — switch between them any
              time from the workspace menu.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="pb-4">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as 'login' | 'signup');
              setShowPassword(false);
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                Log in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              {twoFactor ? (
                <TwoFactorChallengePanel
                  challenge={twoFactor}
                  mode="add-account"
                  cancelLabel="Back"
                  onSignedIn={(data) => {
                    toast.success(
                      `Signed in as ${data.user.displayName ?? data.user.name}.`,
                    );
                    close();
                  }}
                  onCancel={() => {
                    setTwoFactor(null);
                    addAccount.reset();
                    loginForm.setValue('password', '');
                  }}
                />
              ) : (
                <Form {...loginForm}>
                  <form
                    id={LOGIN_FORM_ID}
                    onSubmit={handleLogin}
                    className="space-y-3"
                    noValidate
                  >
                    <FormError error={formErrorMessage(addAccount.error)} />

                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email or username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="text"
                              autoComplete="username"
                              placeholder="you@company.com"
                              leadingIcon={fieldIcon(<AtSign />)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type={passwordType}
                              autoComplete="current-password"
                              placeholder="Your password"
                              leadingIcon={fieldIcon(<Lock />)}
                              trailingSlot={passwordToggle}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <Form {...signupForm}>
                <form
                  id={SIGNUP_FORM_ID}
                  onSubmit={handleSignup}
                  className="space-y-3"
                  noValidate
                >
                  <FormError error={formErrorMessage(signUp.error)} />

                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="name"
                            placeholder="Ada Lovelace"
                            leadingIcon={fieldIcon(<User />)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
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
                            leadingIcon={fieldIcon(<Mail />)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type={passwordType}
                            autoComplete="new-password"
                            placeholder="At least 10 characters"
                            leadingIcon={fieldIcon(<Lock />)}
                            trailingSlot={passwordToggle}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type={passwordType}
                            autoComplete="new-password"
                            placeholder="Repeat your password"
                            leadingIcon={fieldIcon(<Lock />)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem>
                        <div className="gap-2.5 text-xs flex items-start">
                          <Checkbox
                            id="add-account-terms"
                            checked={!!field.value}
                            onCheckedChange={(checked) =>
                              field.onChange(!!checked)
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor="add-account-terms"
                            className="cursor-pointer text-muted-foreground select-none"
                          >
                            I agree to the Terms of Service and Privacy Policy.
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogBody>

        {/* The 2FA panel carries its own Verify / Back actions. */}
        {isLogin && twoFactor ? null : (
          <DialogFooter className="border-t border-border py-4">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={isLogin ? LOGIN_FORM_ID : SIGNUP_FORM_ID}
              loading={submitting}
            >
              {isLogin ? 'Log in & switch' : 'Create account & switch'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
