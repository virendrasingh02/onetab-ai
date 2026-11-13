import type { CurrentUser } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@org/ui';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  Globe,
  Link as LinkIcon,
  MapPin,
  MoreHorizontal,
  Share2,
  Smile,
} from 'lucide-react';
import { useState } from 'react';
import { ProfileAvatar } from './profile-avatar.js';
import { ProfileCover } from './profile-cover.js';

export interface ProfileHeaderProps {
  user: CurrentUser;
  workspaceRole?: string;
  isCurrentUser?: boolean;
  onOpenEditModal: () => void;
  onOpenAvatarCrop: () => void;
  onOpenCoverCrop: () => void;
  onRemoveCover?: () => void;
  onOpenStatusModal?: () => void;
}

export function ProfileHeader({
  user,
  workspaceRole = 'Member',
  isCurrentUser = true,
  onOpenEditModal,
  onOpenAvatarCrop,
  onOpenCoverCrop,
  onRemoveCover,
  onOpenStatusModal,
}: ProfileHeaderProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handle = `@${user.username || user.email.split('@')[0]}`;
  const displayName = user.displayName || user.name;

  const handleCopyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success('Profile link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(handle);
    toast.success(`Copied handle ${handle}`);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Cover Banner Component */}
      <ProfileCover
        coverUrl={user.coverUrl}
        name={displayName}
        seed={user.id}
        editable={isCurrentUser}
        onChangeCover={onOpenCoverCrop}
        onRemoveCover={onRemoveCover}
      />

      {/* Identity & Actions Bar (Overlapping Cover Boundary) */}
      <div className="px-4 sm:px-6 relative">
        <div className="sm:flex-row sm:items-end gap-4 -mt-16 sm:-mt-20 flex flex-col justify-between">
          {/* Avatar overlapping cover boundary */}
          <div className="gap-4 flex items-end">
            <ProfileAvatar
              name={displayName}
              avatarUrl={user.avatarUrl}
              seed={user.id}
              presence={user.presence}
              statusEmoji={user.statusEmoji}
              statusText={user.statusText}
              editable={isCurrentUser}
              onEditAvatar={onOpenAvatarCrop}
            />

            {/* Identity details (Mobile Stack) */}
            <div className="sm:hidden space-y-1 pb-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {displayName}
              </h2>
              <p className="text-xs font-mono text-muted-foreground">
                {handle}
              </p>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="gap-2 sm:self-auto pt-2 sm:pt-0 flex items-center self-start">
            {isCurrentUser ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onOpenEditModal}
                  className="text-xs font-semibold gap-1.5 px-4 shadow-sm"
                >
                  <Edit3 className="size-3.5" />
                  <span>Edit Profile</span>
                </Button>

                {onOpenStatusModal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenStatusModal}
                    className="text-xs gap-1.5 border-border bg-surface hover:bg-accent"
                  >
                    <Smile className="size-3.5" />
                    <span className="md:inline hidden">
                      {user.statusText ? 'Update Status' : 'Set Status'}
                    </span>
                  </Button>
                )}
              </>
            ) : null}

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="More profile actions"
                  className="size-8 border-border bg-surface hover:bg-accent"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-foreground"
              >
                <DropdownMenuItem
                  onClick={handleCopyProfileLink}
                  className="text-xs font-medium gap-2 cursor-pointer rounded-lg hover:bg-accent"
                >
                  {copiedLink ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <LinkIcon className="size-3.5" />
                  )}
                  <span>Copy Profile Link</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyUsername}
                  className="text-xs font-medium gap-2 cursor-pointer rounded-lg hover:bg-accent"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Username Handle</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-border/60" />

                {isCurrentUser && (
                  <>
                    <DropdownMenuItem
                      onClick={onOpenAvatarCrop}
                      className="text-xs font-medium gap-2 cursor-pointer rounded-lg hover:bg-accent"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Change Avatar</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={onOpenCoverCrop}
                      className="text-xs font-medium gap-2 cursor-pointer rounded-lg hover:bg-accent"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Change Header Cover</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem
                  onClick={() => {
                    if (navigator.share) {
                      navigator
                        .share({
                          title: displayName,
                          url: window.location.href,
                        })
                        .catch(() => undefined);
                    } else {
                      handleCopyProfileLink();
                    }
                  }}
                  className="text-xs font-medium gap-2 cursor-pointer rounded-lg hover:bg-accent"
                >
                  <Share2 className="size-3.5" />
                  <span>Share Profile</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Identity & Metadata Row (Desktop) */}
        <div className="pt-3 space-y-2">
          <div className="gap-3 flex flex-wrap items-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {displayName}
            </h1>
            <span className="text-sm font-mono text-muted-foreground">
              {handle}
            </span>
            <Badge
              variant="neutral"
              className="font-semibold border-border bg-surface-raised text-[10px] uppercase"
            >
              {workspaceRole}
            </Badge>
            {user.jobTitle && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand/10 text-brand-text">
                {user.jobTitle}
              </span>
            )}
          </div>

          {/* Bio statement */}
          {user.bio ? (
            <p className="text-xs max-w-2xl leading-relaxed text-foreground/90">
              {user.bio}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No bio provided yet.
            </p>
          )}

          {/* Quick Meta Chips */}
          <div className="gap-4 pt-1 text-xs flex flex-wrap items-center text-muted-foreground">
            {user.location && (
              <div className="gap-1.5 flex items-center">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span>{user.location}</span>
              </div>
            )}

            {user.website && (
              <a
                href={
                  user.website.startsWith('http')
                    ? user.website
                    : `https://${user.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5 flex items-center text-primary hover:underline"
              >
                <Globe className="size-3.5" />
                <span className="max-w-xs truncate">
                  {user.website.replace(/^https?:\/\//, '')}
                </span>
              </a>
            )}

            {user.timezone && (
              <div className="gap-1.5 flex items-center">
                <Clock className="size-3.5 text-muted-foreground" />
                <span>{user.timezone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Status Highlight Banner if set */}
        {(user.statusText || user.statusEmoji) && (
          <div className="mt-4 p-3 text-xs gap-3 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 text-foreground">
            <div className="gap-2.5 min-w-0 flex items-center">
              <span className="text-lg shrink-0">
                {user.statusEmoji || '💬'}
              </span>
              <div className="min-w-0">
                <span className="font-semibold block truncate">
                  {user.statusText}
                </span>
                {user.statusExpiresAt && (
                  <span className="gap-1 mt-0.5 flex items-center text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    <span>
                      Clears{' '}
                      {new Date(user.statusExpiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {isCurrentUser && onOpenStatusModal && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onOpenStatusModal}
                className="text-xs font-medium text-primary hover:bg-primary/10"
              >
                Change
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
