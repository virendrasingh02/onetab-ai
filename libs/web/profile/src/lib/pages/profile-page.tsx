import { userApi } from '@org/api-client';
import { useAuthStore, useCurrentUser } from '@org/auth';
import { Button, LoadingState, ScrollArea, useFocusStore } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ImageCropperDialog } from '../components/image-cropper-dialog.js';
import { ProfileDetails } from '../components/profile-details.js';
import { ProfileEditModal } from '../components/profile-edit-modal.js';
import { ProfileHeader } from '../components/profile-header.js';
import { ProfileSummaryCard } from '../components/profile-summary-card.js';

export function ProfilePage() {
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const { workspace, isLoading: isWorkspaceLoading } = useCurrentWorkspace();
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);
  const openStatusModal = useFocusStore((s) => s.openStatusModal);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');

  const backUrl = workspaceSlug ? `/w/${workspaceSlug}` : '/';

  const updateProfileMutation = useMutation({
    mutationFn: (input: { avatarUrl?: string | null; coverUrl?: string | null }) =>
      userApi.updateProfile({
        name: user?.name || 'User',
        ...input,
      }),
    onSuccess: (updated) => {
      setUser(updated);
    },
  });

  const handleOpenAvatarCrop = () => {
    setCropType('avatar');
    setCropperOpen(true);
  };

  const handleOpenCoverCrop = () => {
    setCropType('cover');
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (cropType === 'avatar') {
      await updateProfileMutation.mutateAsync({ avatarUrl: croppedDataUrl });
    } else {
      await updateProfileMutation.mutateAsync({ coverUrl: croppedDataUrl });
    }
  };

  const handleRemoveCover = async () => {
    await updateProfileMutation.mutateAsync({ coverUrl: null });
  };

  if (isWorkspaceLoading || !user) {
    return <LoadingState fullPage label="Loading profile..." />;
  }

  const workspaceRole = workspace?.role || 'Member';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top Navigation Bar */}
      <header className="h-12 shrink-0 border-b border-border/70 bg-surface/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 text-xs">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Workspace</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">User Profile</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground font-mono">@{user.email.split('@')[0]}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setEditModalOpen(true)}
            className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
          >
            <UserCheck className="size-3.5 text-primary" />
            <span>Edit Profile</span>
          </Button>
        </div>
      </header>

      {/* Main Scrollable Profile Area */}
      <main className="min-h-0 flex-1 overflow-hidden bg-surface-inset/15">
        <ScrollArea className="h-full w-full" contentClassName="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8">
          {/* Profile Header (Cover, Avatar, Main Meta & Actions) */}
          <ProfileHeader
            user={user}
            workspaceRole={workspaceRole}
            isCurrentUser={true}
            onOpenEditModal={() => setEditModalOpen(true)}
            onOpenAvatarCrop={handleOpenAvatarCrop}
            onOpenCoverCrop={handleOpenCoverCrop}
            onRemoveCover={handleRemoveCover}
            onOpenStatusModal={openStatusModal}
          />

          {/* 2-Column Split: Detailed Info Left, Compact Summary Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Structured Profile Details */}
            <div className="lg:col-span-2 space-y-6">
              <ProfileDetails user={user} workspaceRole={workspaceRole} />
            </div>

            {/* Right Col: Compact Profile Summary Card & Workspace Context */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Profile Card Preview
                </h3>
                <ProfileSummaryCard user={user} workspaceRole={workspaceRole} />
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
        </ScrollArea>
      </main>

      {/* Profile Edit Dialog */}
      <ProfileEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        user={user}
      />

      {/* Image Cropper Dialog for Avatar & Cover */}
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        cropType={cropType}
        initialImageUrl={cropType === 'avatar' ? user.avatarUrl : user.coverUrl}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
