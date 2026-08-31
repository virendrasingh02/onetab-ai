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
    return (
      <>{customRenderer({ message, event, isOwn })}</>
    );
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
        'group/app-card relative my-2 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
      style={{
        borderLeftWidth: event.accentColor ? '4px' : undefined,
        borderLeftColor: event.accentColor,
      }}
    >
      {/* 1. APP HEADER */}
      <header className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <UserAvatar
            name={event.appName || message.senderName}
            seed={event.appIcon || event.appId}
            src={message.senderAvatarUrl}
            size="md"
            className="size-10 ring-2 ring-border shadow-xs"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground tracking-tight">
                {event.appName || message.senderName}
              </span>

              <Badge
                variant="neutral"
                className="text-[9px] py-0 h-4 uppercase font-bold tracking-wider bg-accent-violet-soft text-accent-violet border-accent-violet/20 gap-0.5"
              >
                <Blocks className="size-2.5" />
                <span>{event.category || 'App'}</span>
              </Badge>

              {event.badge && (
                <Badge
                  variant={
                    event.badge.variant === 'violet'
                      ? 'primary'
                      : event.badge.variant || 'primary'
                  }
                  className="text-[10px] py-0 h-4 font-semibold"
                >
                  {event.badge.label}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <time dateTime={new Date(message.timestamp).toISOString()}>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <span>•</span>
              <span className="font-mono text-[10px]">{event.eventType}</span>
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
          <DropdownMenuContent align="end" className="w-48 text-xs">
            {event.url && (
              <DropdownMenuItem
                onClick={() => window.open(event.url, '_blank', 'noopener,noreferrer')}
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2">
            {getCardIcon()}
            <span>{event.title}</span>
          </h3>

          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
              title="Open external link"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {event.subtitle && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {event.subtitle}
          </p>
        )}
      </div>

      {/* 3. DYNAMIC STRUCTURED FIELDS */}
      {event.fields && event.fields.length > 0 && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
          {event.fields.map((f, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-xl border border-border/80 bg-surface-raised p-2.5 shadow-2xs',
                !f.inline && 'sm:col-span-2',
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {f.label}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold text-foreground truncate">
                  {String(f.value)}
                </span>
                {f.badge && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 font-mono">
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
        <p className="mt-3 pt-2 text-[11px] text-muted-foreground border-t border-border/50">
          {event.footer}
        </p>
      )}

      {/* 5. INTERACTIVE ACTIONS BAR */}
      {event.actions && event.actions.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
          {event.actions.map((act) => {
            const btnVariant =
              act.variant === 'default' ? 'primary' : act.variant || 'outline';
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
    </article>
  );
}
