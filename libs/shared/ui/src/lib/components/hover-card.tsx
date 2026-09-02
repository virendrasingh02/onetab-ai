import { cn } from '@org/utils';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import {
  Calendar,
  Hash,
  Lock,
  Users,
} from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar.js';
import { Badge } from './badge.js';

/* -------------------------------------------------------------------------- */
/* Base Hover Card Primitives                                                 */
/* -------------------------------------------------------------------------- */

export type HoverCardProps =
  ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>;

export function HoverCard({
  openDelay = 300,
  closeDelay = 150,
  ...props
}: HoverCardProps) {
  return (
    <HoverCardPrimitive.Root
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

export const HoverCardTrigger = HoverCardPrimitive.Trigger;
export const HoverCardPortal = HoverCardPrimitive.Portal;

export interface HoverCardContentProps
  extends ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content> {
  collisionPadding?: number;
}

export const HoverCardContent = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(({ className, align = 'center', sideOffset = 6, collisionPadding = 8, ...props }, ref) => {
  return (
    <HoverCardPortal>
      <HoverCardPrimitive.Content
        ref={ref}
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-50 w-72 max-w-[calc(100vw-1rem)] max-h-(--radix-hover-card-content-available-height) overflow-y-auto overscroll-contain scrollbar-subtle',
          'rounded-popup border border-border bg-popover p-3 text-popover-foreground shadow-overlay outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-(--duration-fast) ease-standard',
          'data-[side=bottom]:slide-in-from-top-1.5 data-[side=top]:slide-in-from-bottom-1.5',
          'data-[side=left]:slide-in-from-right-1.5 data-[side=right]:slide-in-from-left-1.5',
          className,
        )}
        {...props}
      />
    </HoverCardPortal>
  );
});

HoverCardContent.displayName = 'HoverCardContent';

/* -------------------------------------------------------------------------- */
/* Standard Contextual Hover Card Helpers                                     */
/* -------------------------------------------------------------------------- */

export interface UserHoverCardProps {
  children: ReactNode;
  user: {
    name: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    status?: 'online' | 'offline' | 'busy' | 'away';
    bio?: string;
    timezone?: string;
  };
  openDelay?: number;
  closeDelay?: number;
}

export function UserHoverCard({
  children,
  user,
  openDelay = 300,
  closeDelay = 150,
}: UserHoverCardProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-start justify-between gap-3">
          <Avatar className="size-11 border border-border">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          {user.role && (
            <Badge variant="outline" className="text-[10px] font-normal capitalize">
              {user.role}
            </Badge>
          )}
        </div>

        <div className="mt-2.5">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-foreground truncate">{user.name}</h4>
            {user.status && (
              <span
                className={cn(
                  'size-2 rounded-full',
                  user.status === 'online' && 'bg-emerald-500',
                  user.status === 'busy' && 'bg-rose-500',
                  user.status === 'away' && 'bg-amber-500',
                  user.status === 'offline' && 'bg-muted-foreground/40',
                )}
                title={`Status: ${user.status}`}
              />
            )}
          </div>
          {user.email && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
        </div>

        {user.bio && (
          <p className="mt-2 text-xs text-foreground/90 leading-relaxed line-clamp-2">
            {user.bio}
          </p>
        )}

        {user.timezone && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>Local time: {user.timezone}</span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export interface ProjectHoverCardProps {
  children: ReactNode;
  project: {
    name: string;
    description?: string;
    status?: string;
    membersCount?: number;
    updatedAt?: string;
    identifier?: string;
  };
  openDelay?: number;
  closeDelay?: number;
}

export function ProjectHoverCard({
  children,
  project,
  openDelay = 300,
  closeDelay = 150,
}: ProjectHoverCardProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex items-start justify-between gap-2">
          <div>
            {project.identifier && (
              <span className="font-mono text-[10px] font-semibold text-subtle uppercase">
                {project.identifier}
              </span>
            )}
            <h4 className="text-sm font-semibold text-foreground leading-snug">
              {project.name}
            </h4>
          </div>
          {project.status && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {project.status}
            </Badge>
          )}
        </div>

        {project.description && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
          {project.membersCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="size-3.5" />
              <span>{project.membersCount} members</span>
            </div>
          )}
          {project.updatedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              <span>Updated {project.updatedAt}</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export interface KanbanCardHoverCardProps {
  children: ReactNode;
  card: {
    title: string;
    identifier?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
  };
  openDelay?: number;
  closeDelay?: number;
}

export function KanbanCardHoverCard({
  children,
  card,
  openDelay = 300,
  closeDelay = 150,
}: KanbanCardHoverCardProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex items-center justify-between gap-2">
          {card.identifier && (
            <span className="font-mono text-[10px] font-semibold text-subtle">
              {card.identifier}
            </span>
          )}
          {card.priority && (
            <Badge variant="outline" className="text-[10px] capitalize">
              {card.priority}
            </Badge>
          )}
        </div>

        <h4 className="mt-1.5 text-xs font-semibold text-foreground line-clamp-2">
          {card.title}
        </h4>

        <div className="mt-3 flex flex-col gap-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
          {card.status && (
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <span className="font-medium text-foreground capitalize">{card.status}</span>
            </div>
          )}
          {card.assignee && (
            <div className="flex items-center justify-between">
              <span>Assignee:</span>
              <span className="font-medium text-foreground">{card.assignee}</span>
            </div>
          )}
          {card.dueDate && (
            <div className="flex items-center justify-between">
              <span>Due Date:</span>
              <span className="font-medium text-foreground">{card.dueDate}</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export interface ChannelHoverCardProps {
  children: ReactNode;
  channel: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    membersCount?: number;
  };
  openDelay?: number;
  closeDelay?: number;
}

export function ChannelHoverCard({
  children,
  channel,
  openDelay = 300,
  closeDelay = 150,
}: ChannelHoverCardProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex items-center gap-1.5">
          {channel.isPrivate ? (
            <Lock className="size-3.5 text-muted-foreground" />
          ) : (
            <Hash className="size-3.5 text-muted-foreground" />
          )}
          <h4 className="text-xs font-semibold text-foreground truncate">{channel.name}</h4>
        </div>

        {channel.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {channel.description}
          </p>
        )}

        {channel.membersCount !== undefined && (
          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
            <Users className="size-3.5" />
            <span>{channel.membersCount} members</span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
