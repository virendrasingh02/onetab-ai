import { zodResolver } from '@hookform/resolvers/zod';
import { http } from '@org/api-client';
import { formErrorMessage } from '@org/auth';
import { useTheme, type Theme } from '@org/design-system';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Switch,
} from '@org/ui';
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [changed, setChanged] = useState(false);

  const changePassword = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      http.post('/auth/change-password', input).then(() => undefined),
    onSuccess: () => setChanged(true),
  });

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values);
      form.reset();
    } catch {
      // Rendered by <FormError>.
    }
  });

  return (
    <div className="max-w-2xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Preferences and account security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Applies to this browser. &ldquo;System&rdquo; follows your OS
            setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="gap-2 grid grid-cols-3"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.value)}
                  className={
                    selected
                      ? 'gap-1.5 p-3 text-sm flex flex-col items-center rounded-lg border-2 border-primary bg-accent text-accent-foreground'
                      : 'gap-1.5 p-3 text-sm flex flex-col items-center rounded-lg border-2 border-transparent bg-transparent ring-1 ring-border hover:bg-muted'
                  }
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Delivery preferences arrive with the notification service in a later
            phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 'mentions', label: 'Mentions and replies', checked: true },
            { id: 'invites', label: 'Workspace invitations', checked: true },
            { id: 'digest', label: 'Weekly digest email', checked: false },
          ].map((row) => (
            <div key={row.id} className="flex items-center justify-between">
              <Label htmlFor={row.id}>{row.label}</Label>
              {/* Disabled until the notification service exists — showing an
                  editable control that silently does nothing would be a lie. */}
              <Switch id={row.id} defaultChecked={row.checked} disabled />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>
            Changing your password signs out every other session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changed ? (
            <p className="text-sm text-success">
              Password updated. Other sessions have been signed out.
            </p>
          ) : null}
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError error={formErrorMessage(changePassword.error)} />

              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="current-password"
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
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" loading={changePassword.isPending}>
                Update password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
