import { cn } from '@org/utils';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { Calendar, Hash, Lock, Users } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { UserAvatar } from './avatar.js';
import { Badge } from './badge.js';

/* -------------------------------------------------------------------------- */
/* Base Hover Card Primitives                                                 */
/* -------------------------------------------------------------------------- */

export type HoverCardProps = ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Root
>;

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

export interface HoverCardContentProps extends ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Content
> {
  collisionPadding?: number;
}

export const HoverCardContent = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(
  (
    {
      className,
      align = 'center',
      sideOffset = 6,
      collisionPadding = 8,
      ...props
    },
    ref,
  ) => {
    return (
      <HoverCardPortal>
        <HoverCardPrimitive.Content
          ref={ref}
          data-slot="hover-card-content"
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(
            'w-72 scrollbar-subtle z-50 max-h-(--radix-hover-card-content-available-height) max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain',
            'p-3 rounded-popup border border-border bg-popover text-popover-foreground shadow-overlay outline-none',
            className,
          )}
          {...props}
        />
      </HoverCardPortal>
    );
  },
);

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
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="gap-3 flex items-start justify-between">
          <UserAvatar
            name={user.name}
            src={user.avatarUrl}
            size="lg"
            presence={user.status}
            className="size-11"
          />
          {user.role && (
            <Badge
              variant="outline"
              className="font-normal text-2xs capitalize"
            >
              {user.role}
            </Badge>
          )}
        </div>

        <div className="mt-2.5">
          <div className="gap-1.5 flex items-center">
            <h4 className="text-sm font-semibold truncate text-foreground">
              {user.name}
            </h4>
          </div>
          {user.email && (
            <p className="text-xs truncate text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>

        {user.bio && (
          <p className="mt-2 text-xs leading-relaxed line-clamp-2 text-foreground/90">
            {user.bio}
          </p>
        )}

        {user.timezone && (
          <div className="mt-3 gap-1.5 flex items-center text-meta text-muted-foreground">
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
        <div className="gap-2 flex items-start justify-between">
          <div>
            {project.identifier && (
              <span className="font-semibold font-mono text-2xs text-subtle uppercase">
                {project.identifier}
              </span>
            )}
            <h4 className="text-sm font-semibold leading-snug text-foreground">
              {project.name}
            </h4>
          </div>
          {project.status && (
            <Badge variant="secondary" className="font-normal text-2xs">
              {project.status}
            </Badge>
          )}
        </div>

        {project.description && (
          <p className="mt-2 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
            {project.description}
          </p>
        )}

        <div className="mt-3 gap-4 pt-2 flex items-center border-t border-border/50 text-meta text-muted-foreground">
          {project.membersCount !== undefined && (
            <div className="gap-1 flex items-center">
              <Users className="size-3.5" />
              <span>{project.membersCount} members</span>
            </div>
          )}
          {project.updatedAt && (
            <div className="gap-1 flex items-center">
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
        <div className="gap-2 flex items-center justify-between">
          {card.identifier && (
            <span className="font-semibold font-mono text-2xs text-subtle">
              {card.identifier}
            </span>
          )}
          {card.priority && (
            <Badge variant="outline" className="text-2xs capitalize">
              {card.priority}
            </Badge>
          )}
        </div>

        <h4 className="mt-1.5 text-xs font-semibold line-clamp-2 text-foreground">
          {card.title}
        </h4>

        <div className="mt-3 gap-1 pt-2 flex flex-col border-t border-border/50 text-meta text-muted-foreground">
          {card.status && (
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <span className="font-medium text-foreground capitalize">
                {card.status}
              </span>
            </div>
          )}
          {card.assignee && (
            <div className="flex items-center justify-between">
              <span>Assignee:</span>
              <span className="font-medium text-foreground">
                {card.assignee}
              </span>
            </div>
          )}
          {card.dueDate && (
            <div className="flex items-center justify-between">
              <span>Due Date:</span>
              <span className="font-medium text-foreground">
                {card.dueDate}
              </span>
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
        <div className="gap-1.5 flex items-center">
          {channel.isPrivate ? (
            <Lock className="size-3.5 text-muted-foreground" />
          ) : (
            <Hash className="size-3.5 text-muted-foreground" />
          )}
          <h4 className="text-xs font-semibold truncate text-foreground">
            {channel.name}
          </h4>
        </div>

        {channel.description && (
          <p className="mt-1.5 text-xs line-clamp-2 text-muted-foreground">
            {channel.description}
          </p>
        )}

        {channel.membersCount !== undefined && (
          <div className="mt-2.5 gap-1 pt-2 flex items-center border-t border-border/50 text-meta text-muted-foreground">
            <Users className="size-3.5" />
            <span>{channel.membersCount} members</span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
