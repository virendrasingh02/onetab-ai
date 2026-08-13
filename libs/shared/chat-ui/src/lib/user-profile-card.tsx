import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Popover,
  PopoverContent,
  PopoverTrigger,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Calendar,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { getUserColor } from './indicators.js';

export interface UserProfileCardProps {
  userId: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  powerLevel?: number;
  email?: string;
  joinedAt?: string | number;
  bio?: string;
  status?: 'online' | 'unavailable' | 'offline';
  children: ReactNode;
  onSendDirectMessage?: (userId: string) => void;
  onOpenSidePanel?: (user: {
    userId: string;
    name: string;
    avatarUrl?: string;
    role?: string;
    powerLevel?: number;
  }) => void;
}

export function UserProfileCard({
  userId,
  name,
  avatarUrl,
  role = 'Member',
  powerLevel = 0,
  email,
  joinedAt,
  bio = 'Software Engineer & Team Collaborator on OneTab AI.',
  status = 'online',
  children,
  onSendDirectMessage,
  onOpenSidePanel,
}: UserProfileCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const userColor = getUserColor(userId);
  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(false);
    if (onOpenSidePanel) {
      onOpenSidePanel({ userId, name, avatarUrl, role, powerLevel });
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      {/* Hover Popover Preview Card */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <span
            onClick={handleClick}
            onMouseEnter={() => setPopoverOpen(true)}
            className="inline-block cursor-pointer"
          >
            {children}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onMouseEnter={() => setPopoverOpen(true)}
          onMouseLeave={() => setPopoverOpen(false)}
          className="w-80 overflow-hidden rounded-2xl border border-[#3f4147] bg-[#232428] p-0 text-[#dbdee1] shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Banner Gradient */}
          <div
            style={{
              background: `linear-gradient(135deg, ${userColor} 0%, #1e1f22 100%)`,
            }}
            className="h-20 w-full relative"
          >
            <div className="absolute top-2 right-2 flex gap-1">
              {powerLevel >= 100 ? (
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  👑 Admin
                </span>
              ) : powerLevel >= 50 ? (
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  🛡️ Mod
                </span>
              ) : null}
            </div>
          </div>

          {/* User Avatar Row */}
          <div className="relative px-4 pb-3 pt-0">
            <div className="-mt-10 mb-2 flex items-end justify-between">
              <div className="relative">
                <UserAvatar
                  name={name}
                  src={avatarUrl}
                  seed={userId}
                  size="xl"
                  className="size-20 rounded-full ring-4 ring-[#232428] shadow-lg"
                />
                <span
                  className={cn(
                    'absolute bottom-1 right-1 size-4 rounded-full ring-2 ring-[#232428]',
                    status === 'online'
                      ? 'bg-[#23a55a]'
                      : status === 'unavailable'
                        ? 'bg-[#f0b232]'
                        : 'bg-[#80848e]',
                  )}
                />
              </div>

              <Button
                size="sm"
                onClick={handleClick}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-lg px-3 py-1.5 shadow-sm"
              >
                Right Bar Details
              </Button>
            </div>

            {/* Display Name & Handle */}
            <div className="space-y-0.5">
              <h3 className="text-base font-extrabold text-white tracking-tight">
                {name}
              </h3>
              <p className="text-xs font-mono font-medium text-[#949ba4]">{handle}</p>
            </div>

            <hr className="my-3 border-[#35373c]" />

            {/* Bio & Details */}
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                  About Me
                </p>
                <p className="mt-0.5 text-[#dbdee1] leading-relaxed line-clamp-2">{bio}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                  Roles
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="neutral" className="bg-[#2b2d31] text-white border-[#3f4147]">
                    {role}
                  </Badge>
                  <Badge variant="neutral" className="bg-[#2b2d31] text-[#5865f2] border-[#5865f2]/40">
                    Power {powerLevel}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPopoverOpen(false);
                  onSendDirectMessage?.(userId);
                }}
                className="flex-1 border-[#3f4147] bg-[#2b2d31] text-xs font-semibold text-white hover:bg-[#35373c]"
              >
                <MessageSquare className="mr-1.5 size-3.5 text-[#5865f2]" />
                Send Message
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Fallback Full Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border border-[#3f4147] bg-[#1e1f22] p-0 text-[#dbdee1] shadow-2xl">
          <div
            style={{
              background: `linear-gradient(135deg, ${userColor} 0%, #111214 100%)`,
            }}
            className="h-28 w-full relative p-4 flex items-start justify-between"
          >
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-[#f59e0b]" />
              User Profile
            </span>
          </div>

          <div className="relative px-6 pb-6 pt-0">
            <div className="-mt-12 mb-4 flex items-end justify-between">
              <div className="relative">
                <UserAvatar
                  name={name}
                  src={avatarUrl}
                  seed={userId}
                  size="xl"
                  className="size-24 rounded-full ring-4 ring-[#1e1f22] shadow-2xl"
                />
                <span
                  className={cn(
                    'absolute bottom-1 right-1 size-5 rounded-full ring-4 ring-[#1e1f22]',
                    status === 'online'
                      ? 'bg-[#23a55a]'
                      : status === 'unavailable'
                        ? 'bg-[#f0b232]'
                        : 'bg-[#80848e]',
                  )}
                />
              </div>

              <Button
                onClick={() => {
                  setModalOpen(false);
                  onSendDirectMessage?.(userId);
                }}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded-xl px-4 py-2 shadow-md"
              >
                <MessageSquare className="mr-1.5 size-4" />
                Direct Message
              </Button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  {name}
                </h2>
                {powerLevel >= 50 ? (
                  <Badge variant="primary" className="bg-[#5865f2] text-white">
                    {powerLevel >= 100 ? 'Admin' : 'Moderator'}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs font-mono text-[#949ba4]">{handle}</p>
            </div>

            <hr className="my-4 border-[#2b2d31]" />

            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-[#2b2d31] bg-[#2b2d31]/50 p-3.5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                  Bio & Overview
                </p>
                <p className="text-[#dbdee1] leading-relaxed">{bio}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[#2b2d31] bg-[#2b2d31]/50 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                    <Shield className="size-3.5 text-[#5865f2]" />
                    <span>Role & Access</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-white">{role}</p>
                </div>

                <div className="rounded-xl border border-[#2b2d31] bg-[#2b2d31]/50 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                    <Zap className="size-3.5 text-[#f59e0b]" />
                    <span>Power Level</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-white">{powerLevel} / 100</p>
                </div>

                {/*
                  The modal took `email` and `joinedAt` and drew neither, so the
                  fallback profile showed strictly less than the side panel it
                  stands in for.
                */}
                {email ? (
                  <div className="rounded-xl border border-[#2b2d31] bg-[#2b2d31]/50 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                      <Mail className="size-3.5 text-[#3ba55d]" />
                      <span>Email</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold break-all text-white">
                      {email}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-[#2b2d31] bg-[#2b2d31]/50 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                    <Calendar className="size-3.5 text-[#949ba4]" />
                    <span>Member since</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-white">
                    {joinedAt
                      ? new Date(joinedAt).toLocaleDateString()
                      : 'Workspace Member'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * User Profile Right Side Panel Component (Renders in right sidebar bar like threads)
 */
export function UserProfileRightPanel({
  userId,
  name,
  avatarUrl,
  role = 'Member',
  powerLevel = 0,
  email,
  joinedAt,
  bio = 'Software Engineer & Team Collaborator on OneTab AI.',
  status = 'online',
  onSendDirectMessage,
}: {
  userId: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  powerLevel?: number;
  email?: string;
  joinedAt?: string | number;
  bio?: string;
  status?: 'online' | 'unavailable' | 'offline';
  onSendDirectMessage?: (userId: string) => void;
}) {
  const userColor = getUserColor(userId);
  const handle = `@${userId.replace(/^@/, '').split(':')[0]}`;

  return (
    <div className="flex flex-col h-full bg-[#2b2d31] text-[#dbdee1]">
      {/* Cover Header Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${userColor} 0%, #1e1f22 100%)`,
        }}
        className="h-28 w-full relative p-4 flex items-start justify-between"
      >
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-xs flex items-center gap-1">
          <Sparkles className="size-3 text-[#f59e0b]" />
          User Profile
        </span>
      </div>

      {/* Profile Details Content Body */}
      <div className="relative p-4 flex-1 overflow-y-auto scrollbar-subtle space-y-4">
        {/* Avatar & Action */}
        <div className="-mt-12 flex items-end justify-between">
          <div className="relative">
            <UserAvatar
              name={name}
              src={avatarUrl}
              seed={userId}
              size="xl"
              className="size-20 rounded-full ring-4 ring-[#2b2d31] shadow-2xl"
            />
            <span
              className={cn(
                'absolute bottom-0.5 right-0.5 size-4 rounded-full ring-2 ring-[#2b2d31]',
                status === 'online'
                  ? 'bg-[#23a55a]'
                  : status === 'unavailable'
                    ? 'bg-[#f0b232]'
                    : 'bg-[#80848e]',
              )}
            />
          </div>

          <Button
            size="sm"
            onClick={() => onSendDirectMessage?.(userId)}
            className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded-xl px-3.5 py-1.5 shadow-md"
          >
            <MessageSquare className="mr-1.5 size-3.5" />
            Direct Message
          </Button>
        </div>

        {/* Name & Handle */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {name}
            </h2>
            {powerLevel >= 50 ? (
              <Badge variant="primary" className="bg-[#5865f2] text-white text-[10px]">
                {powerLevel >= 100 ? 'Admin' : 'Moderator'}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs font-mono text-[#949ba4]">{handle}</p>
        </div>

        <hr className="border-[#35373c]" />

        {/* Bio & Details */}
        <div className="space-y-3 text-xs">
          <div className="rounded-xl border border-[#35373c] bg-[#1e1f22]/50 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
              About Me
            </p>
            <p className="text-[#dbdee1] leading-relaxed">{bio}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#35373c] bg-[#1e1f22]/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                <Shield className="size-3 text-[#5865f2]" />
                <span>Role</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-white">{role}</p>
            </div>

            <div className="rounded-xl border border-[#35373c] bg-[#1e1f22]/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                <Zap className="size-3 text-[#f59e0b]" />
                <span>Power</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-white">{powerLevel} / 100</p>
            </div>

            {email ? (
              <div className="col-span-2 rounded-xl border border-[#35373c] bg-[#1e1f22]/50 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                  <Mail className="size-3 text-[#22c55e]" />
                  <span>Email</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-white">{email}</p>
              </div>
            ) : null}

            <div className="col-span-2 rounded-xl border border-[#35373c] bg-[#1e1f22]/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                <Calendar className="size-3 text-[#3b82f6]" />
                <span>Member Joined</span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-white">
                {joinedAt ? new Date(joinedAt).toLocaleDateString() : 'Workspace Member'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
