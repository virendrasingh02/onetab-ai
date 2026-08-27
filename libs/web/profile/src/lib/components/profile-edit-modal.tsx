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
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ScrollArea,
  Textarea,
  TimezoneSelect,
  toast,
  UserAvatar,
} from '@org/ui';
import { getSystemTimezone } from '@org/utils';
import { updateProfileSchema, type UpdateProfileInput } from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import { Camera, Info, Lock, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImageCropperDialog } from './image-cropper-dialog.js';

export interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser;
}

export function ProfileEditModal({ open, onOpenChange, user }: ProfileEditModalProps) {
  const setUser = useAuthStore((state) => state.setUser);
  const systemTimezone = getSystemTimezone();

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
      bio: user.bio || '',
      timezone: user.timezone || systemTimezone,
      avatarUrl: user.avatarUrl || '',
      coverUrl: user.coverUrl || '',
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
        bio: user.bio || '',
        timezone: user.timezone || systemTimezone,
        avatarUrl: user.avatarUrl || '',
        coverUrl: user.coverUrl || '',
        jobTitle: user.jobTitle || user.title || '',
        location: user.location || '',
        website: user.website || '',
        github: user.github || '',
      });
    }
  }, [open, user, form, systemTimezone]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated successfully');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Reconstruct full name from first and last if edited
    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim() || values.name;

    await updateMutation.mutateAsync({
      ...values,
      name: combinedName,
      displayName: values.displayName?.trim() || null,
      bio: values.bio?.trim() || null,
      avatarUrl: values.avatarUrl?.trim() || null,
      coverUrl: values.coverUrl?.trim() || null,
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
      form.setValue('coverUrl', croppedDataUrl, { shouldDirty: true });
    }
  };

  const avatarWatch = form.watch('avatarUrl') || user.avatarUrl;
  const coverWatch = form.watch('coverUrl') || user.coverUrl;
  const displayNameWatch = form.watch('displayName') || `${firstName} ${lastName}`.trim() || user.name;
  const usernameHandle = `@${user.email.split('@')[0]}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b border-border/60 shrink-0">
            <DialogTitle className="text-lg font-bold text-foreground">Edit Profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update your photo, cover banner, display identity, and regional details.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto" contentClassName="p-6 space-y-6">
            {/* Visual Cover & Avatar Preview Box */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Cover &amp; Profile Picture</div>
              <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-raised">
                {/* Cover Preview Area */}
                <div
                  className="h-36 sm:h-44 w-full relative bg-cover bg-center"
                  style={{
                    backgroundImage: coverWatch
                      ? `url(${coverWatch})`
                      : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)',
                  }}
                >
                  <div className="absolute inset-0 bg-black/30" />

                  {/* Change/Remove Cover buttons */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={handleOpenCoverCropper}
                      className="bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs gap-1.5 shadow-md border border-white/20"
                    >
                      <Camera className="size-3.5" />
                      <span>Change Cover</span>
                    </Button>

                    {coverWatch ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => form.setValue('coverUrl', '', { shouldDirty: true })}
                        className="bg-black/60 hover:bg-destructive/80 text-white backdrop-blur-md text-xs px-2 shadow-md border border-white/20"
                        title="Remove cover"
                      >
                        <Trash2 className="size-3.5 text-destructive-foreground" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Avatar Preview Area */}
                <div className="px-6 pb-4 pt-0 relative flex items-end justify-between">
                  <div className="-mt-14 relative group/edit inline-block">
                    <div className="relative rounded-full ring-4 ring-card shadow-xl overflow-hidden bg-surface">
                      <UserAvatar
                        name={displayNameWatch}
                        src={avatarWatch}
                        seed={user.id}
                        size="xl"
                        className="size-24 rounded-full"
                      />
                      <button
                        type="button"
                        onClick={handleOpenAvatarCropper}
                        className="absolute inset-0 bg-black/60 backdrop-blur-2xs opacity-0 group-hover/edit:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white cursor-pointer"
                      >
                        <Camera className="size-5 text-white" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Change</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
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
                        onClick={() => form.setValue('avatarUrl', '', { shouldDirty: true })}
                        className="text-xs text-destructive hover:text-destructive gap-1"
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
                <FormError error={updateMutation.error ? 'Failed to save changes. Please try again.' : undefined} />

                {/* 3-Column Responsive Name Grid: First Name, Last Name, Display Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      First Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Virendra"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Last Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Singh"
                      className="h-9 text-xs"
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Display Name</FormLabel>
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
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Lock className="size-3 text-muted-foreground" />
                      <span>Email Address</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">Primary Login</span>
                  </div>
                  <Input
                    value={user.email}
                    disabled
                    className="h-9 text-xs bg-surface-muted border-border font-mono text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="size-3 text-muted-foreground shrink-0" />
                    <span>To change your verified email, visit Account Security settings.</span>
                  </p>
                </div>

                {/* Username / Handle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Username / Handle</label>
                  <Input
                    value={usernameHandle}
                    disabled
                    className="h-9 text-xs bg-surface-muted border-border font-mono text-muted-foreground"
                  />
                </div>

                {/* Bio */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold">Bio</FormLabel>
                        <span className="text-[10px] text-muted-foreground font-mono">
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
                          onChange={(zone) => form.setValue('timezone', zone, { shouldDirty: true })}
                        />
                      </FormControl>
                      <FormDescription className="text-[11px]">
                        Used for scheduling, teammate local time cards, and notifications.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 2-Column Responsive: Job Title & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Job Title</FormLabel>
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
                        <FormLabel className="text-xs font-semibold">Location</FormLabel>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Website / Portfolio</FormLabel>
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
                        <FormLabel className="text-xs font-semibold">GitHub Username</FormLabel>
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
          </ScrollArea>

          <DialogFooter className="p-4 bg-surface-muted/60 border-t border-border/60 flex items-center justify-between sm:justify-between gap-2 shrink-0">
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
        initialImageUrl={cropType === 'avatar' ? avatarWatch : coverWatch}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
