import { cn } from '@org/utils';
import {
  Activity,
  Bot,
  MessageSquare,
  MoreVertical,
  Play,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

import type { ComponentProps, ReactNode } from 'react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { AIModelBadge } from '../ai/AIModelBadge.js';

export type AgentStatus = 'online' | 'idle' | 'running' | 'offline' | 'error';

export interface AIAgentCardProps extends ComponentProps<'div'> {
  id: string;
  name: string;
  description: string;
  status?: AgentStatus;
  avatarUrl?: string;
  icon?: ReactNode;
  model?: string;
  provider?: string;
  capabilities?: string[];
  tools?: string[];
  runsCount?: number;
  tokensUsed?: number | string;
  avgLatency?: string;
  variant?: 'card' | 'compact' | 'row' | 'featured';
  onRun?: () => void;
  onChat?: () => void;
  onConfigure?: () => void;
  onDuplicate?: () => void;
}

export function AIAgentCard({
  id: _id,
  name,
  description,
  status = 'online',
  avatarUrl,
  icon,
  model = 'GPT-4o',
  provider,
  capabilities = [],
  tools = [],
  runsCount,
  tokensUsed: _tokensUsed,
  avgLatency,
  variant = 'card',
  onRun,
  onChat,
  onConfigure,
  onDuplicate,
  className,
  ...props
}: AIAgentCardProps) {
  const statusConfig: Record<
    AgentStatus,
    { label: string; dotClass: string; badgeClass: string }
  > = {
    online: {
      label: 'Available',
      dotClass: 'bg-success animate-pulse',
      badgeClass: 'text-success-text bg-success/10 border-success/20',
    },
    running: {
      label: 'Running',
      dotClass: 'bg-brand animate-ping',
      badgeClass: 'text-brand-text bg-brand/15 border-brand/30',
    },
    idle: {
      label: 'Idle',
      dotClass: 'bg-warning',
      badgeClass: 'text-warning-text bg-warning/10 border-warning/20',
    },
    offline: {
      label: 'Offline',
      dotClass: 'bg-muted-foreground',
      badgeClass: 'text-muted-foreground bg-muted border-border',
    },
    error: {
      label: 'Error',
      dotClass: 'bg-destructive',
      badgeClass:
        'text-destructive-text bg-destructive/10 border-destructive/20',
    },
  };

  const currentStatus = statusConfig[status];

  // 1. Compact Variant
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'gap-3 p-2.5 text-xs flex items-center justify-between rounded-btn border border-border bg-surface shadow-xs transition-all hover:border-border-strong',
          className,
        )}
        {...props}
      >
        <div className="gap-2.5 min-w-0 flex items-center">
          <div className="size-7 relative flex shrink-0 items-center justify-center rounded-md border border-brand/20 bg-brand/10 text-brand-text">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="size-full rounded-md object-cover"
              />
            ) : (
              icon || <Bot className="size-4" />
            )}
            <span
              className={cn(
                '-bottom-0.5 -right-0.5 size-2 absolute rounded-full ring-2 ring-surface',
                currentStatus.dotClass,
              )}
            />
          </div>
          <div className="truncate">
            <div className="font-semibold truncate text-foreground">{name}</div>
            <div className="mt-0.5">
              <AIModelBadge
                modelId={model}
                provider={provider}
                variant="compact"
              />
            </div>
          </div>
        </div>

        <div className="gap-1 flex shrink-0 items-center">
          {onChat && (
            <Button
              size="xs"
              variant="outline"
              onClick={onChat}
              leadingIcon={<MessageSquare className="size-3" />}
            >
              Chat
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 2. Row Variant
  if (variant === 'row') {
    return (
      <div
        className={cn(
          'gap-4 p-3.5 text-xs flex flex-wrap items-center justify-between rounded-card border border-border bg-surface shadow-xs transition-all hover:border-border-strong',
          className,
        )}
        {...props}
      >
        <div className="gap-3 min-w-0 flex flex-1 items-center">
          <div className="size-10 relative flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-foreground">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="size-full rounded-lg object-cover"
              />
            ) : (
              icon || <Bot className="size-5 text-brand-text" />
            )}
            <span
              className={cn(
                '-bottom-0.5 -right-0.5 size-2.5 absolute rounded-full ring-2 ring-surface',
                currentStatus.dotClass,
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="gap-2 flex items-center">
              <h3 className="font-semibold truncate text-foreground">{name}</h3>
              <AIModelBadge
                modelId={model}
                provider={provider}
                variant="subtle"
              />
              <span
                className={cn(
                  'px-1.5 py-0.2 font-medium rounded-full border text-2xs',
                  currentStatus.badgeClass,
                )}
              >
                {currentStatus.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-meta text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {/* Tools & Capabilities */}
        <div className="md:flex gap-1.5 hidden items-center">
          {tools.slice(0, 3).map((tool) => (
            <Badge
              key={tool}
              variant="outline"
              className="bg-surface-raised font-mono text-2xs"
            >
              {tool}
            </Badge>
          ))}
        </div>

        {/* Actions */}
        <div className="gap-2 flex items-center">
          {onRun && (
            <Button
              size="xs"
              variant="primary"
              onClick={onRun}
              leadingIcon={<Play className="size-3" />}
            >
              Run
            </Button>
          )}
          {onChat && (
            <Button
              size="xs"
              variant="outline"
              onClick={onChat}
              leadingIcon={<MessageSquare className="size-3" />}
            >
              Chat
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 3. Featured / Card Default Variant
  return (
    <div
      className={cn(
        'group p-4 text-xs relative flex flex-col justify-between rounded-card border border-border bg-surface shadow-xs transition-all duration-(--duration-fast)',
        'hover:border-border-strong hover:shadow-sm',
        variant === 'featured' &&
          'border-brand/40 bg-gradient-to-b from-brand/5 to-transparent',
        className,
      )}
      {...props}
    >
      <div>
        {/* Top bar: Avatar, Name, Status & Menu */}
        <div className="gap-3 flex items-start justify-between">
          <div className="gap-3 flex items-center">
            <div className="size-10 relative flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-foreground">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                icon || <Bot className="size-5 text-brand-text" />
              )}
              <span
                className={cn(
                  '-bottom-0.5 -right-0.5 size-2.5 absolute rounded-full ring-2 ring-surface',
                  currentStatus.dotClass,
                )}
              />
            </div>

            <div>
              <div className="gap-1.5 flex items-center">
                <h3 className="font-semibold tracking-tight text-foreground">
                  {name}
                </h3>
                {variant === 'featured' && (
                  <Sparkles className="size-3.5 shrink-0 text-brand-text" />
                )}
              </div>
              <div className="mt-1">
                <AIModelBadge
                  modelId={model}
                  provider={provider}
                  variant="subtle"
                />
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="More options">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onConfigure && (
                <DropdownMenuItem onClick={onConfigure}>
                  <Settings className="size-3.5 mr-2" />
                  Configure
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Zap className="size-3.5 mr-2" />
                  Duplicate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRun}>
                <Play className="size-3.5 mr-2 text-brand-text" />
                Run Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        <p className="mt-3 leading-relaxed line-clamp-2 text-meta text-muted-foreground">
          {description}
        </p>

        {/* Tools and Capabilities Tags */}
        {(tools.length > 0 || capabilities.length > 0) && (
          <div className="mt-3 gap-1 flex flex-wrap">
            {tools.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded-xs border border-border/60 bg-surface-raised font-mono text-2xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {capabilities.map((c) => (
              <span
                key={c}
                className="px-1.5 py-0.5 font-medium rounded-xs bg-accent text-2xs text-accent-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Stats & Primary Actions */}
      <div className="mt-4 pt-3 gap-2 flex items-center justify-between border-t border-border">
        <div className="gap-3 flex items-center font-mono text-meta text-subtle">
          {runsCount !== undefined && (
            <span title="Total executions">
              {runsCount.toLocaleString()} runs
            </span>
          )}
          {avgLatency && (
            <span
              title="Average response latency"
              className="gap-0.5 flex items-center"
            >
              <Activity className="size-3 text-brand-text" />
              {avgLatency}
            </span>
          )}
        </div>

        <div className="gap-1.5 flex items-center">
          {onChat && (
            <Button
              size="xs"
              variant="outline"
              onClick={onChat}
              leadingIcon={<MessageSquare className="size-3" />}
            >
              Chat
            </Button>
          )}
          {onRun && (
            <Button
              size="xs"
              variant="primary"
              onClick={onRun}
              leadingIcon={<Play className="size-3" />}
            >
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
