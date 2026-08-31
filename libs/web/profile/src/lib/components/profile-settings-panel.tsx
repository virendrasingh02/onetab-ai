import { userApi } from '@org/api-client';
import { useAuthStore, useCurrentUser } from '@org/auth';
import { Button, LoadingState, useFocusStore } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { ImageCropperDialog } from './image-cropper-dialog.js';
import { ProfileDetails } from './profile-details.js';
import { ProfileEditModal } from './profile-edit-modal.js';
import { ProfileHeader } from './profile-header.js';
import { ProfileSummaryCard } from './profile-summary-card.js';

export function ProfileSettingsPanel() {
  const { workspace } = useCurrentWorkspace();
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);
  const openStatusModal = useFocusStore((s) => s.openStatusModal);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');

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

  if (!user) {
    return <LoadingState label="Loading profile..." />;
  }

  const workspaceRole = workspace?.role || 'Member';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Profile & Details</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Update your photo, cover banner, display identity, and regional details.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditModalOpen(true)}
          className="text-xs gap-1.5 border-border bg-surface hover:bg-accent self-start sm:self-auto cursor-pointer"
        >
          <UserCheck className="size-3.5 text-primary" />
          <span>Edit Profile</span>
        </Button>
      </div>

      {/* Profile Header (Cover, Avatar, Main Meta & Quick Actions) */}
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
