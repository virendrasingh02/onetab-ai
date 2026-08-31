import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage, useAddAccount, useSignUpAccount } from '@org/auth';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
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
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const addAccount = useAddAccount();
  const signUp = useSignUpAccount();

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
  };

  const handleLogin = loginForm.handleSubmit(async (values) => {
    try {
      const data = await addAccount.mutateAsync(values);
      toast.success(
        `Signed in as ${data.user.displayName ?? data.user.name}.`,
      );
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-raised/40">
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            <span>Add another account</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Log in or sign up with another account. Your current account stays
            signed in, and you can switch between them any time.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as 'login' | 'signup')}
          className="p-5"
        >
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Log in
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <Form {...loginForm}>
              <form onSubmit={handleLogin} className="space-y-3" noValidate>
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
                          type="password"
                          autoComplete="current-password"
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
                  loading={
                    loginForm.formState.isSubmitting || addAccount.isPending
                  }
                >
                  Log in &amp; switch
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <Form {...signupForm}>
              <form onSubmit={handleSignup} className="space-y-3" noValidate>
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
                          type="password"
                          autoComplete="new-password"
                          placeholder="At least 10 characters"
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
                  control={signupForm.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-2.5 text-xs">
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
                          className="cursor-pointer select-none text-muted-foreground"
                        >
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
                  loading={
                    signupForm.formState.isSubmitting || signUp.isPending
                  }
                >
                  Create account &amp; switch
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <div className="p-3 bg-surface-raised/50 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="h-8 text-xs px-4"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
