import { zodResolver } from '@hookform/resolvers/zod';
import { userApi } from '@org/api-client';
import { useAuthStore, useCurrentUser } from '@org/auth';
import type { CurrentUser } from '@org/types';
import {
  Button,
  Field,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingState,
  Textarea,
  toast,
  UserAvatar,
  UserCover,
} from '@org/ui';
import { useTranslation, type SupportedLanguageCode } from '@org/i18n';
import { updateProfileSchema, type UpdateProfileInput } from '@org/validation';
import {
  useCurrentWorkspace,
  useRegisterSettingsDirty,
} from '@org/web-workspace';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Camera,
  Globe,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ImageCropperDialog } from './image-cropper-dialog.js';
import { ProfileSummaryCard } from './profile-summary-card.js';
import { UsernameField } from './username-field.js';
import { useProfileCover } from '../use-profile-cover.js';

export function ProfileSettingsPanel() {
  const { workspace } = useCurrentWorkspace();
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');
  const { t, locale, setLocale } = useTranslation();
  const {
    coverUrl,
    coverSrc,
    cropSource,
    uploadCover,
    removeCover,
    isSaving: isCoverSaving,
  } = useProfileCover();

  // Split name into first and last name
  const nameParts = (user?.name || '').trim().split(/\s+/);
  const initialFirstName = nameParts[0] || '';
  const initialLastName = nameParts.slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || '',
      displayName: user?.displayName || '',
      username: user?.username || undefined,
      bio: user?.bio || '',
      timezone: user?.timezone || 'UTC',
      preferredLanguage:
        (user?.preferredLanguage as SupportedLanguageCode) || locale || 'en',
      avatarUrl: user?.avatarUrl || '',
      jobTitle: user?.jobTitle || user?.title || '',
      location: user?.location || '',
      website: user?.website || '',
      github: user?.github || '',
    },
  });

  useEffect(() => {
    if (user) {
      const parts = (user.name || '').trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');

      form.reset({
        name: user.name || '',
        displayName: user.displayName || '',
        username: user.username || undefined,
        bio: user.bio || '',
        timezone: user.timezone || 'UTC',
        preferredLanguage:
          (user.preferredLanguage as SupportedLanguageCode) || locale || 'en',
        avatarUrl: user.avatarUrl || '',
        jobTitle: user.jobTitle || user.title || '',
        location: user.location || '',
        website: user.website || '',
        github: user.github || '',
      });
    }
  }, [user, form, locale]);

  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => {
      setUser(updated);
      // Rosters feed every profile card; refresh them so the new name/handle
      // shows on your own card straight away, in every workspace.
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      if (updated.preferredLanguage) {
        setLocale(updated.preferredLanguage as SupportedLanguageCode);
      }
      form.reset({
        name: updated.name || '',
        displayName: updated.displayName || '',
        username: updated.username || undefined,
        bio: updated.bio || '',
        timezone: updated.timezone || 'UTC',
        preferredLanguage:
          (updated.preferredLanguage as SupportedLanguageCode) ||
          locale ||
          'en',
        avatarUrl: updated.avatarUrl || '',
        jobTitle: updated.jobTitle || updated.title || '',
        location: updated.location || '',
        website: updated.website || '',
        github: updated.github || '',
      });
      toast.success(
        t('settings.language_changed_success', 'Profile saved successfully'),
      );
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message || 'Failed to update profile';
      // A handle taken between the live check and Save lands on the field.
      if (err?.response?.status === 409) form.setError('username', { message });
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const combinedName =
      `${firstName.trim()} ${lastName.trim()}`.trim() || values.name;

    await updateMutation.mutateAsync({
      ...values,
      name: combinedName,
      displayName: values.displayName?.trim() || null,
      // Only a changed handle goes up, so a plain save never re-checks it.
      username:
        values.username && values.username !== user?.username
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

  // Feed the settings shell's unsaved-changes guard.
  useRegisterSettingsDirty(
    'settings.profile-panel',
    form.formState.isDirty ||
      firstName !== initialFirstName ||
      lastName !== initialLastName,
    () => onSubmit(),
    () => {
      form.reset();
      setFirstName(initialFirstName);
      setLastName(initialLastName);
    },
  );

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

  if (!user) {
    return <LoadingState label="Loading profile..." />;
  }

  const workspaceRole = workspace?.role || 'Member';
  const avatarWatch = form.watch('avatarUrl') || user.avatarUrl;
  const displayNameWatch =
    form.watch('displayName') || `${firstName} ${lastName}`.trim() || user.name;
  const jobTitleWatch = form.watch('jobTitle') || user.jobTitle || user.title;
  const bioWatch = form.watch('bio') || user.bio;
  const usernameHandle = `@${form.watch('username') || user.username || user.email.split('@')[0]}`;

  const previewUser: CurrentUser = {
    ...user,
    name: `${firstName} ${lastName}`.trim() || user.name,
    displayName: displayNameWatch,
    avatarUrl: avatarWatch,
    coverUrl,
    jobTitle: jobTitleWatch,
    title: jobTitleWatch,
    bio: bioWatch,
  };

  return (
    <div className="space-y-8">
      {/* 2-Column Responsive Layout: Form Left (2 cols), Live Preview Right (1 col) */}
      <div className="lg:grid-cols-3 gap-8 grid grid-cols-1 items-start">
        {/* Left Column: Direct Inline Editable Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visual Cover & Avatar Inline Card */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Cover & Profile Photo
            </h3>
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xs">
              {/* Cover Preview Area */}
              <UserCover src={coverSrc} seed={user.id} className="h-36 sm:h-44">
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

          {/* Form Fields Card */}
          <div className="p-5 space-y-6 rounded-xl border border-border bg-surface shadow-xs">
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
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        form.setValue(
                          'name',
                          `${e.target.value} ${lastName}`.trim(),
                          { shouldDirty: true },
                        );
                      }}
                      placeholder="e.g. Virendra"
                      className="h-9 text-xs"
                    />
                  </Field>

                  <Field label="Last Name" required>
                    <Input
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        form.setValue(
                          'name',
                          `${firstName} ${e.target.value}`.trim(),
                          { shouldDirty: true },
                        );
                      }}
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

                {/* Email (Read-Only) & Username Grid */}
                <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
                  <Field
                    label={
                      <div className="gap-1.5 flex items-center">
                        <Mail className="size-3 text-muted-foreground" />
                        <span>Email Address</span>
                      </div>
                    }
                    hint={
                      <div className="gap-1 flex items-center text-muted-foreground">
                        <Lock className="size-3 shrink-0" />
                        <span>Verified Primary Login</span>
                      </div>
                    }
                  >
                    <Input
                      value={user.email}
                      disabled
                      className="h-9 text-xs cursor-not-allowed border-border bg-surface-muted font-mono text-muted-foreground"
                    />
                  </Field>

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
                </div>

                {/* Job Title & Location Grid */}
                <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold gap-1.5 flex items-center">
                          <Briefcase className="size-3 text-muted-foreground" />
                          <span>Job Title / Role</span>
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
                        <FormLabel className="text-xs font-semibold gap-1.5 flex items-center">
                          <MapPin className="size-3 text-muted-foreground" />
                          <span>Location</span>
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

                {/* Bio */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold">
                          About / Bio
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

                {/* Social Profiles Grid: Website & GitHub */}
                <div className="sm:grid-cols-2 gap-4 pt-2 grid grid-cols-1 border-t border-border/40">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold gap-1.5 flex items-center">
                          <Globe className="size-3 text-muted-foreground" />
                          <span>Personal Website</span>
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
                        <FormLabel className="text-xs font-semibold gap-1.5 flex items-center">
                          <LinkIcon className="size-3 text-muted-foreground" />
                          <span>GitHub Username</span>
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

                {/* Action Buttons */}
                <div className="gap-3 pt-4 flex items-center justify-end border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      !form.formState.isDirty &&
                      firstName === initialFirstName &&
                      lastName === initialLastName
                    }
                    onClick={() => {
                      form.reset();
                      setFirstName(initialFirstName);
                      setLastName(initialLastName);
                    }}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    loading={updateMutation.isPending}
                    disabled={
                      !form.formState.isDirty &&
                      firstName === initialFirstName &&
                      lastName === initialLastName
                    }
                    className="text-xs px-5 shadow-xs"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>

        {/* Right Column: Live Profile Card Preview & Workspace Context */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Profile Card Preview
            </h3>
            <ProfileSummaryCard
              user={previewUser}
              workspaceRole={workspaceRole}
            />
          </div>

          {/* Workspace Badge & Info */}
          {workspace && (
            <div className="p-4 space-y-2 text-xs rounded-xl border border-border bg-surface">
              <div className="gap-2 font-bold flex items-center text-foreground">
                <Sparkles className="size-4 text-primary" />
                <span>Workspace Membership</span>
              </div>
              <p className="leading-relaxed text-muted-foreground">
                You are viewing your active profile within{' '}
                <strong className="text-foreground">{workspace.name}</strong> as
                an{' '}
                <span className="font-semibold text-primary">
                  {workspace.role}
                </span>
                .
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Cropper Dialog for Avatar & Cover */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        cropType={cropType}
        initialImageUrl={cropType === 'avatar' ? avatarWatch : cropSource}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
