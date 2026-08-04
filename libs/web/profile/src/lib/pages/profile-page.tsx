import { zodResolver } from '@hookform/resolvers/zod';
import { userApi } from '@org/api-client';
import { formErrorMessage, useAuthStore, useCurrentUser } from '@org/auth';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingState,
  Textarea,
  UserAvatar,
} from '@org/ui';
import { formatDate } from '@org/utils';
import { updateProfileSchema, type UpdateProfileInput } from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

export function ProfilePage() {
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);

  const updateProfile = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => setUser(updated),
  });

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      name: user?.name ?? '',
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      timezone: user?.timezone ?? 'UTC',
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  if (!user) return <LoadingState fullPage />;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync({
        ...values,
        // Empty strings mean "clear this field", which the API models as null.
        displayName: values.displayName || null,
        bio: values.bio || null,
        avatarUrl: values.avatarUrl || null,
      });
    } catch {
      // Rendered by <FormError>.
    }
  });

  return (
    <div className="max-w-2xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Your profile</h2>
        <p className="text-sm text-muted-foreground">
          How you appear to other members. Member since{' '}
          {formatDate(user.createdAt)}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
          <CardDescription>
            Your display name is shown instead of your full name where space is
            tight.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 gap-4 flex items-center">
            <UserAvatar
              name={user.displayName ?? user.name}
              src={form.watch('avatarUrl') || user.avatarUrl}
              seed={user.id}
              size="xl"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {user.displayName ?? user.name}
              </p>
              <p className="text-xs truncate text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError error={formErrorMessage(updateProfile.error)} />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="Optional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={3}
                        placeholder="What you work on"
                      />
                    </FormControl>
                    <FormDescription>Up to 280 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="https://…"
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to use your generated initials avatar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                loading={updateProfile.isPending}
                disabled={!form.formState.isDirty}
              >
                Save profile
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
