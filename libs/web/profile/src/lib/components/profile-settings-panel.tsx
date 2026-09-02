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
} from '@org/ui';
import { updateProfileSchema, type UpdateProfileInput } from '@org/validation';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation } from '@tanstack/react-query';
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

export function ProfileSettingsPanel() {
  const { workspace } = useCurrentWorkspace();
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');

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
      bio: user?.bio || '',
      timezone: user?.timezone || 'UTC',
      avatarUrl: user?.avatarUrl || '',
      coverUrl: user?.coverUrl || '',
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
        bio: user.bio || '',
        timezone: user.timezone || 'UTC',
        avatarUrl: user.avatarUrl || '',
        coverUrl: user.coverUrl || '',
        jobTitle: user.jobTitle || user.title || '',
        location: user.location || '',
        website: user.website || '',
        github: user.github || '',
      });
    }
  }, [user, form]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => {
      setUser(updated);
      form.reset({
        name: updated.name || '',
        displayName: updated.displayName || '',
        bio: updated.bio || '',
        timezone: updated.timezone || 'UTC',
        avatarUrl: updated.avatarUrl || '',
        coverUrl: updated.coverUrl || '',
        jobTitle: updated.jobTitle || updated.title || '',
        location: updated.location || '',
        website: updated.website || '',
        github: updated.github || '',
      });
      toast.success('Profile saved successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
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

  if (!user) {
    return <LoadingState label="Loading profile..." />;
  }

  const workspaceRole = workspace?.role || 'Member';
  const avatarWatch = form.watch('avatarUrl') || user.avatarUrl;
  const coverWatch = form.watch('coverUrl') || user.coverUrl;
  const displayNameWatch = form.watch('displayName') || `${firstName} ${lastName}`.trim() || user.name;
  const jobTitleWatch = form.watch('jobTitle') || user.jobTitle || user.title;
  const bioWatch = form.watch('bio') || user.bio;
  const usernameHandle = `@${user.email.split('@')[0]}`;

  const previewUser: CurrentUser = {
    ...user,
    name: `${firstName} ${lastName}`.trim() || user.name,
    displayName: displayNameWatch,
    avatarUrl: avatarWatch,
    coverUrl: coverWatch,
    jobTitle: jobTitleWatch,
    title: jobTitleWatch,
    bio: bioWatch,
  };

  return (
    <div className="space-y-8">
      {/* 2-Column Responsive Layout: Form Left (2 cols), Live Preview Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Direct Inline Editable Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visual Cover & Avatar Inline Card */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Cover & Profile Photo
            </h3>
            <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-raised shadow-xs">
              {/* Cover Preview Area */}
              <div
                className="h-36 sm:h-44 w-full relative bg-cover bg-center"
                style={{
                  backgroundImage: coverWatch
                    ? `url(${coverWatch})`
                    : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)',
                }}
              >
                <div className="absolute inset-0 bg-black/25" />

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
              <div className="px-6 pb-5 pt-0 relative flex items-end justify-between flex-wrap gap-4">
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

          {/* Form Fields Card */}
          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <FormError error={updateMutation.error ? 'Failed to save changes. Please try again.' : undefined} />

                {/* 3-Column Responsive Name Grid: First Name, Last Name, Display Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="First Name" required>
                    <Input
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        form.setValue('name', `${e.target.value} ${lastName}`.trim(), { shouldDirty: true });
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
                        form.setValue('name', `${firstName} ${e.target.value}`.trim(), { shouldDirty: true });
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

                {/* Email (Read-Only) & Username Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label={
                      <div className="flex items-center gap-1.5">
                        <Mail className="size-3 text-muted-foreground" />
                        <span>Email Address</span>
                      </div>
                    }
                    hint={
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="size-3 shrink-0" />
                        <span>Verified Primary Login</span>
                      </div>
                    }
                  >
                    <Input
                      value={user.email}
                      disabled
                      className="h-9 text-xs bg-surface-muted border-border font-mono text-muted-foreground cursor-not-allowed"
                    />
                  </Field>

                  <Field label="Username / Handle">
                    <Input
                      value={usernameHandle}
                      disabled
                      className="h-9 text-xs bg-surface-muted border-border font-mono text-muted-foreground cursor-not-allowed"
                    />
                  </Field>
                </div>

                {/* Job Title & Location Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
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
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
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
                        <FormLabel className="text-xs font-semibold">About / Bio</FormLabel>
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

                {/* Social Profiles Grid: Website & GitHub */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
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
                        <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
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
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!form.formState.isDirty && firstName === initialFirstName && lastName === initialLastName}
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
                    disabled={!form.formState.isDirty && firstName === initialFirstName && lastName === initialLastName}
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Profile Card Preview
            </h3>
            <ProfileSummaryCard user={previewUser} workspaceRole={workspaceRole} />
          </div>

          {/* Workspace Badge & Info */}
          {workspace && (
            <div className="p-4 rounded-2xl border border-border bg-surface space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Sparkles className="size-4 text-primary" />
                <span>Workspace Membership</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                You are viewing your active profile within{' '}
                <strong className="text-foreground">{workspace.name}</strong> as an{' '}
                <span className="text-primary font-semibold">{workspace.role}</span>.
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
        initialImageUrl={cropType === 'avatar' ? avatarWatch : coverWatch}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
