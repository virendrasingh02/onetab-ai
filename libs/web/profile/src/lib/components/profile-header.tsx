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

  const handle = `@${user.email.split('@')[0]}`;
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
    <div className="w-full space-y-4">
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
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
          {/* Avatar overlapping cover boundary */}
          <div className="flex items-end gap-4">
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
              <h2 className="text-xl font-bold tracking-tight text-foreground">{displayName}</h2>
              <p className="text-xs font-mono text-muted-foreground">{handle}</p>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0">
            {isCurrentUser ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onOpenEditModal}
                  className="text-xs font-semibold gap-1.5 shadow-sm px-4"
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
                    <Smile className="size-3.5 text-primary" />
                    <span className="hidden md:inline">
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
              <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl border border-border bg-popover text-foreground shadow-xl">
                <DropdownMenuItem
                  onClick={handleCopyProfileLink}
                  className="text-xs font-medium cursor-pointer rounded-lg hover:bg-accent gap-2"
                >
                  {copiedLink ? <Check className="size-3.5 text-success" /> : <LinkIcon className="size-3.5" />}
                  <span>Copy Profile Link</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleCopyUsername}
                  className="text-xs font-medium cursor-pointer rounded-lg hover:bg-accent gap-2"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Username Handle</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-border/60" />

                {isCurrentUser && (
                  <>
                    <DropdownMenuItem
                      onClick={onOpenAvatarCrop}
                      className="text-xs font-medium cursor-pointer rounded-lg hover:bg-accent gap-2"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Change Avatar</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={onOpenCoverCrop}
                      className="text-xs font-medium cursor-pointer rounded-lg hover:bg-accent gap-2"
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
                        .share({ title: displayName, url: window.location.href })
                        .catch(() => undefined);
                    } else {
                      handleCopyProfileLink();
                    }
                  }}
                  className="text-xs font-medium cursor-pointer rounded-lg hover:bg-accent gap-2"
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
            <span className="text-sm font-mono text-muted-foreground">{handle}</span>
            <Badge variant="neutral" className="text-[10px] uppercase font-semibold border-border bg-surface-raised">
              {workspaceRole}
            </Badge>
            {user.jobTitle && (
              <span className="text-xs font-medium text-primary-text bg-primary/10 px-2.5 py-0.5 rounded-full">
                {user.jobTitle}
              </span>
            )}
          </div>

          {/* Bio statement */}
          {user.bio ? (
            <p className="text-xs text-foreground/90 max-w-2xl leading-relaxed">{user.bio}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No bio provided yet.</p>
          )}

          {/* Quick Meta Chips */}
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            {user.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span>{user.location}</span>
              </div>
            )}

            {user.website && (
              <a
                href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Globe className="size-3.5" />
                <span className="truncate max-w-xs">{user.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}

            {user.timezone && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span>{user.timezone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Status Highlight Banner if set */}
        {(user.statusText || user.statusEmoji) && (
          <div className="mt-4 p-3 rounded-xl border border-primary/25 bg-primary/5 text-xs text-foreground flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg shrink-0">{user.statusEmoji || '💬'}</span>
              <div className="min-w-0">
                <span className="font-semibold block truncate">{user.statusText}</span>
                {user.statusExpiresAt && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="size-3" />
                    <span>Clears {new Date(user.statusExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                className="text-xs text-primary font-medium hover:bg-primary/10"
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
