import type {
  AppResponseMessageContent,
  Message,
  StructuredMessageAction,
} from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { MessageTime } from '../message-time.js';
import { EntityKindBadge } from '../entity-kind-badge.js';
import {
  AlertTriangle,
  ArrowUpRight,
  Blocks,
  Building2,
  Calendar as CalendarIcon,
  Copy,
  ExternalLink,
  GitPullRequest,
  MoreHorizontal,
  Workflow,
} from 'lucide-react';
import { executeStructuredAction } from './action-handler.js';
import { appCardRegistry } from './app-card-registry.js';

export interface AppResponseCardProps {
  message: Message;
  event: AppResponseMessageContent;
  isOwn?: boolean;
  isHighlighted?: boolean;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
  onOpenThread?: () => void;
}

export function AppResponseCard({
  message,
  event,
  isOwn = false,
  isHighlighted = false,
  onAction,
  onOpenThread,
}: AppResponseCardProps) {
  // Check if a specialized plugin renderer was registered
  const customRenderer = appCardRegistry.get(event.cardType || event.appId);
  if (customRenderer) {
    return <>{customRenderer({ message, event, isOwn })}</>;
  }

  const handleActionClick = async (action: StructuredMessageAction) => {
    if (onAction) {
      await onAction(action);
      return;
    }
    await executeStructuredAction(action, {
      roomId: message.roomId,
      messageId: message.id,
      appId: event.appId,
    });
  };

  const getCardIcon = () => {
    switch (event.cardType) {
      case 'github':
        return <GitPullRequest className="size-4 text-info-text" />;
      case 'linear':
      case 'jira':
      case 'task':
        return <Workflow className="size-4 text-accent-violet" />;
      case 'sentry':
        return <AlertTriangle className="size-4 text-destructive-text" />;
      case 'crm':
      case 'contact':
        return <Building2 className="size-4 text-success" />;
      case 'calendar':
        return <CalendarIcon className="size-4 text-warning-text" />;
      default:
        return <Blocks className="size-4 text-primary" />;
    }
  };

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/app-card -mx-4 gap-4 px-4 pt-2.5 pb-1 relative flex transition-colors hover:bg-foreground/[0.035]',
        isHighlighted && 'border-l-2 border-l-primary bg-primary/5',
      )}
    >
      <div className="w-10 shrink-0">
        <UserAvatar
          name={event.appName || message.senderName}
          seed={event.appIcon || event.appId}
          src={message.senderAvatarUrl}
          size="md"
          className="size-10 rounded-full shadow-xs"
        />
      </div>

      <div className="min-w-0 flex-1">
        {/* 1. APP HEADER — same shape as a normal message header */}
        <header className="gap-3 flex items-start justify-between">
          <div className="gap-3 min-w-0 flex items-start">
            <div className="min-w-0">
              <div className="gap-2 flex flex-wrap items-center">
                <span className="font-bold text-message text-foreground">
                  {event.appName || message.senderName}
                </span>

                <EntityKindBadge
                  kind="app"
                  icon={<Blocks className="size-2.5" />}
                  label={event.category || 'App'}
                />

                {event.badge && (
                  <Badge
                    variant={
                      event.badge.variant === 'violet'
                        ? 'primary'
                        : event.badge.variant || 'primary'
                    }
                    className="py-0 h-4 font-semibold text-2xs"
                  >
                    {event.badge.label}
                  </Badge>
                )}
                <MessageTime
                  timestamp={message.timestamp}
                  className="font-medium text-xs cursor-pointer text-muted-foreground hover:underline"
                />
              </div>
            </div>
          </div>

          {/* Header Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="App card options"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              collisionPadding={8}
              className="w-48 text-xs z-50 border-border bg-popover text-popover-foreground shadow-overlay"
            >
              {event.url && (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(event.url, '_blank', 'noopener,noreferrer')
                  }
                  className="gap-2"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Open in {event.appName}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard?.writeText(event.title);
                  toast.success('Title copied to clipboard');
                }}
                className="gap-2"
              >
                <Copy className="size-3.5" />
                <span>Copy Card Info</span>
              </DropdownMenuItem>
              {onOpenThread && (
                <DropdownMenuItem onClick={onOpenThread} className="gap-2">
                  <Workflow className="size-3.5" />
                  <span>Reply in Thread</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 2. CARD TITLE & SUBTITLE */}
        <div className="mt-3">
          <div className="gap-2 flex items-start justify-between">
            <h3 className="text-sm font-bold gap-2 flex items-center text-foreground transition-colors hover:text-primary">
              {getCardIcon()}
              <span>{event.title}</span>
            </h3>

            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Open external link"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          {event.subtitle && (
            <p className="text-xs mt-1 leading-relaxed text-muted-foreground">
              {event.subtitle}
            </p>
          )}
        </div>

        {/* 3. DYNAMIC STRUCTURED FIELDS */}
        {event.fields && event.fields.length > 0 && (
          <div className="mt-3 sm:grid-cols-2 gap-2 text-xs grid">
            {event.fields.map((f, idx) => (
              <div
                key={idx}
                className={cn(
                  'p-2.5 shadow-2xs rounded-xl border border-border/80 bg-surface-raised',
                  !f.inline && 'sm:col-span-2',
                )}
              >
                <span className="font-bold tracking-wider block text-2xs text-muted-foreground uppercase">
                  {f.label}
                </span>
                <div className="gap-2 mt-1 flex items-center">
                  <span className="font-semibold truncate text-foreground">
                    {String(f.value)}
                  </span>
                  {f.badge && (
                    <Badge
                      variant="outline"
                      className="py-0 h-4 font-mono text-2xs"
                    >
                      {f.badge}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. FOOTER */}
        {event.footer && (
          <p className="mt-3 pt-2 text-xs border-t border-border/50 text-muted-foreground">
            {event.footer}
          </p>
        )}

        {/* 5. INTERACTIVE ACTIONS BAR */}
        {event.actions && event.actions.length > 0 && (
          <div className="mt-3.5 pt-3 gap-2 flex flex-wrap items-center border-t border-border/60">
            {event.actions.map((act) => {
              const btnVariant =
                act.variant === 'default'
                  ? 'primary'
                  : act.variant || 'outline';
              return (
                <Button
                  key={act.id}
                  size="sm"
                  variant={btnVariant}
                  onClick={() => handleActionClick(act)}
                  className="h-7 text-xs gap-1.5 shadow-2xs"
                >
                  <span>{act.label}</span>
                  <ArrowUpRight className="size-3 opacity-70" />
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
