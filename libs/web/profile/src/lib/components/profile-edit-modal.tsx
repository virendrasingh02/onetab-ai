import { zodResolver } from '@hookform/resolvers/zod';
import { userApi } from '@org/api-client';
import { useAuthStore } from '@org/auth';
import type { CurrentUser } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  TimezoneSelect,
  toast,
  UserAvatar,
  UserCover,
} from '@org/ui';
import { getSystemTimezone } from '@org/utils';
import { updateProfileSchema, type UpdateProfileInput } from '@org/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Info, Lock, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { UsernameField } from './username-field.js';
import { ImageCropperDialog } from './image-cropper-dialog.js';
import { useProfileCover } from '../use-profile-cover.js';

export interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser;
}

export function ProfileEditModal({
  open,
  onOpenChange,
  user,
}: ProfileEditModalProps) {
  const setUser = useAuthStore((state) => state.setUser);
  const systemTimezone = getSystemTimezone();
  const {
    coverUrl,
    coverSrc,
    cropSource,
    uploadCover,
    removeCover,
    isSaving: isCoverSaving,
  } = useProfileCover();

  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');

  // Split name into first and last name for editing convenience
  const nameParts = (user.name || '').trim().split(/\s+/);
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name || '',
      displayName: user.displayName || '',
      username: user.username || undefined,
      bio: user.bio || '',
      timezone: user.timezone || systemTimezone,
      avatarUrl: user.avatarUrl || '',
      jobTitle: user.jobTitle || user.title || '',
      location: user.location || '',
      website: user.website || '',
      github: user.github || '',
    },
  });

  // Sync form values when user changes or modal opens
  useEffect(() => {
    if (open) {
      const parts = (user.name || '').trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');

      form.reset({
        name: user.name || '',
        displayName: user.displayName || '',
        username: user.username || undefined,
        bio: user.bio || '',
        timezone: user.timezone || systemTimezone,
        avatarUrl: user.avatarUrl || '',
        jobTitle: user.jobTitle || user.title || '',
        location: user.location || '',
        website: user.website || '',
        github: user.github || '',
      });
    }
  }, [open, user, form, systemTimezone]);

  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => {
      setUser(updated);
      // Rosters feed every profile card; refresh them so the new name/handle
      // shows on your own card straight away, in every workspace.
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Profile updated successfully');
      onOpenChange(false);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message || 'Failed to update profile';
      if (err?.response?.status === 409) form.setError('username', { message });
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Reconstruct full name from first and last if edited
    const combinedName =
      `${firstName.trim()} ${lastName.trim()}`.trim() || values.name;

    await updateMutation.mutateAsync({
      ...values,
      name: combinedName,
      displayName: values.displayName?.trim() || null,
      username:
        values.username && values.username !== user.username
          ? values.username
          : undefined,
      bio: values.bio?.trim() || null,
      avatarUrl: values.avatarUrl?.trim() || null,
      jobTitle: values.jobTitle?.trim() || null,
      location: values.location?.trim() || null,
      website: values.website?.trim() || null,
      github: values.github?.trim() || null,
    });
  });

  const handleOpenAvatarCropper = () => {
    setCropType('avatar');
    setCropperOpen(true);
  };

  const handleOpenCoverCropper = () => {
    setCropType('cover');
    setCropperOpen(true);
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    if (cropType === 'avatar') {
      form.setValue('avatarUrl', croppedDataUrl, { shouldDirty: true });
    } else {
      // Covers save straight away rather than riding the form draft.
      void uploadCover(croppedDataUrl);
    }
  };

  const avatarWatch = form.watch('avatarUrl') || user.avatarUrl;
  const displayNameWatch =
    form.watch('displayName') || `${firstName} ${lastName}`.trim() || user.name;
  const usernameHandle = `@${form.watch('username') || user.username || user.email.split('@')[0]}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl p-0 shadow-2xl flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border-border bg-card">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/60">
            <DialogTitle className="text-lg font-bold text-foreground">
              Edit Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update your photo, cover banner, display identity, and regional
              details.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-x-hidden overflow-y-auto">
            {/* Visual Cover & Avatar Preview Box */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">
                Cover &amp; Profile Picture
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-raised">
                {/* Cover Preview Area */}
                <UserCover
                  src={coverSrc}
                  seed={user.id}
                  className="h-36 sm:h-44"
                >
                  <div className="inset-0 from-black/25 absolute bg-gradient-to-t to-transparent" />

                  {/* Change/Remove Cover buttons */}
                  <div className="top-3 right-3 gap-2 absolute flex items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={handleOpenCoverCropper}
                      disabled={isCoverSaving}
                      className="bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs gap-1.5 border-white/20 border shadow-md"
                    >
                      <Camera className="size-3.5" />
                      <span>Change Cover</span>
                    </Button>

                    {coverUrl ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={isCoverSaving}
                        onClick={() => void removeCover()}
                        className="bg-black/60 text-white backdrop-blur-md text-xs px-2 border-white/20 border shadow-md hover:bg-destructive/80"
                        title="Remove cover"
                      >
                        <Trash2 className="size-3.5 text-destructive-foreground" />
                      </Button>
                    ) : null}
                  </div>
                </UserCover>

                {/* Avatar Preview Area */}
                <div className="px-6 pb-4 pt-0 gap-x-4 gap-y-3 relative flex flex-wrap items-end">
                  <div className="-mt-12 group/edit relative inline-block shrink-0">
                    <div className="relative overflow-hidden rounded-full bg-surface shadow-lg ring-4 ring-surface">
                      <UserAvatar
                        name={displayNameWatch}
                        src={avatarWatch}
                        seed={user.id}
                        size="xl"
                        className="size-24 rounded-full"
                        indicator={false}
                      />
                      <button
                        type="button"
                        onClick={handleOpenAvatarCropper}
                        className="inset-0 bg-black/60 backdrop-blur-2xs gap-1 text-white absolute flex cursor-pointer flex-col items-center justify-center opacity-0 transition-opacity group-hover/edit:opacity-100"
                      >
                        <Camera className="size-5 text-white" />
                        <span className="font-bold tracking-wider text-[9px] uppercase">
                          Change
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 pb-1 flex-1">
                    <p className="text-base font-semibold tracking-tight truncate text-foreground">
                      {displayNameWatch}
                    </p>
                    <p className="text-xs truncate font-mono text-muted-foreground">
                      {usernameHandle}
                    </p>
                  </div>

                  <div className="gap-2 pb-1 flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleOpenAvatarCropper}
                      className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
                    >
                      <Camera className="size-3.5" />
                      <span>Change Avatar</span>
                    </Button>
                    {avatarWatch ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          form.setValue('avatarUrl', '', { shouldDirty: true })
                        }
                        className="text-xs gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-0.5" />
                        <span>Remove</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <FormError
                  error={
                    updateMutation.error
                      ? 'Failed to save changes. Please try again.'
                      : undefined
                  }
                />

                {/* 3-Column Responsive Name Grid: First Name, Last Name, Display Name */}
                <div className="sm:grid-cols-3 gap-4 grid grid-cols-1">
                  <Field label="First Name" required>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Virendra"
                      className="h-9 text-xs"
                    />
                  </Field>

                  <Field label="Last Name" required>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Singh"
                      className="h-9 text-xs"
                    />
                  </Field>

                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Display Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. Virendra S."
                            className="h-9 text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email Field (Guarded / Read-Only per Auth Specs) */}
                <Field
                  label={
                    <>
                      <Lock className="size-3 text-muted-foreground" />
                      <span>Email Address</span>
                    </>
                  }
                  labelAside={
                    <span className="text-[11px] text-muted-foreground">
                      Primary Login
                    </span>
                  }
                  hint={
                    <>
                      <Info className="size-3 shrink-0 text-muted-foreground" />
                      <span>
                        To change your verified email, visit Account Security
                        settings.
                      </span>
                    </>
                  }
                >
                  <Input
                    value={user.email}
                    disabled
                    className="h-9 text-xs cursor-not-allowed border-border bg-surface-muted font-mono text-muted-foreground"
                  />
                </Field>

                {/* Username / Handle */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field, fieldState }) => (
                    <UsernameField
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      current={user.username}
                      error={fieldState.error?.message}
                    />
                  )}
                />

                {/* Bio */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold">
                          Bio
                        </FormLabel>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {(field.value || '').length}/280
                        </span>
                      </div>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={3}
                          maxLength={280}
                          placeholder="Tell teammates about your role, projects, and interests..."
                          className="text-xs resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Timezone */}
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">
                        Timezone <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <TimezoneSelect
                          value={field.value || systemTimezone}
                          onChange={(zone) =>
                            form.setValue('timezone', zone, {
                              shouldDirty: true,
                            })
                          }
                        />
                      </FormControl>
                      <FormDescription className="text-[11px]">
                        Used for scheduling, teammate local time cards, and
                        notifications.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 2-Column Responsive: Job Title & Location */}
                <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Job Title
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. Principal Software Engineer"
                            className="h-9 text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Location
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. San Francisco, CA or Remote"
                            className="h-9 text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 2-Column Responsive: Website & GitHub */}
                <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Website / Portfolio
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="https://yourwebsite.com"
                            className="h-9 text-xs font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="github"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          GitHub Username
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. octocat"
                            className="h-9 text-xs font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </div>

          <DialogFooter className="p-4 sm:justify-between gap-2 flex shrink-0 items-center justify-between border-t border-border/60 bg-surface-muted/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={updateMutation.isPending}
              onClick={onSubmit}
              className="text-xs px-5 shadow-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Image Cropper Dialog */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        cropType={cropType}
        initialImageUrl={cropType === 'avatar' ? avatarWatch : cropSource}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
