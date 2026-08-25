import { cn } from '@org/utils';
import {
  Activity,
  Bot,
  Cpu,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu.js';

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
  provider: _provider = 'OpenAI',
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
  const statusConfig: Record<AgentStatus, { label: string; dotClass: string; badgeClass: string }> = {
    online: { label: 'Available', dotClass: 'bg-success animate-pulse', badgeClass: 'text-success-text bg-success/10 border-success/20' },
    running: { label: 'Running', dotClass: 'bg-primary animate-ping', badgeClass: 'text-primary-text bg-primary/15 border-primary/30' },
    idle: { label: 'Idle', dotClass: 'bg-warning', badgeClass: 'text-warning-text bg-warning/10 border-warning/20' },
    offline: { label: 'Offline', dotClass: 'bg-muted-foreground', badgeClass: 'text-muted-foreground bg-muted border-border' },
    error: { label: 'Error', dotClass: 'bg-destructive', badgeClass: 'text-destructive-text bg-destructive/10 border-destructive/20' },
  };

  const currentStatus = statusConfig[status];

  // 1. Compact Variant
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-btn border border-border bg-surface p-2.5 text-xs shadow-xs hover:border-border-strong transition-all',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="size-full rounded-md object-cover" />
            ) : (
              icon || <Bot className="size-4" />
            )}
            <span className={cn('absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-surface', currentStatus.dotClass)} />
          </div>
          <div className="truncate">
            <div className="font-semibold text-foreground truncate">{name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{model}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onChat && (
            <Button size="xs" variant="outline" onClick={onChat} leadingIcon={<MessageSquare className="size-3" />}>
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
          'flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-3.5 text-xs shadow-xs hover:border-border-strong transition-all',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised border border-border text-foreground">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="size-full rounded-lg object-cover" />
            ) : (
              icon || <Bot className="size-5 text-primary" />
            )}
            <span className={cn('absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface', currentStatus.dotClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{name}</h3>
              <Badge variant="secondary" className="text-[10px] font-mono h-4.5 px-1.5">
                {model}
              </Badge>
              <span className={cn('rounded-full border px-1.5 py-0.2 text-[10px] font-medium', currentStatus.badgeClass)}>
                {currentStatus.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{description}</p>
          </div>
        </div>

        {/* Tools & Capabilities */}
        <div className="hidden md:flex items-center gap-1.5">
          {tools.slice(0, 3).map((tool) => (
            <Badge key={tool} variant="outline" className="text-[10px] font-mono bg-surface-raised">
              {tool}
            </Badge>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRun && (
            <Button size="xs" variant="primary" onClick={onRun} leadingIcon={<Play className="size-3" />}>
              Run
            </Button>
          )}
          {onChat && (
            <Button size="xs" variant="outline" onClick={onChat} leadingIcon={<MessageSquare className="size-3" />}>
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
        'group relative flex flex-col justify-between rounded-card border border-border bg-surface p-4 text-xs shadow-xs transition-all duration-(--duration-fast)',
        'hover:border-border-strong hover:shadow-sm',
        variant === 'featured' && 'border-primary/40 bg-gradient-to-b from-primary/5 to-transparent',
        className,
      )}
      {...props}
    >
      <div>
        {/* Top bar: Avatar, Name, Status & Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised border border-border text-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="size-full rounded-lg object-cover" />
              ) : (
                icon || <Bot className="size-5 text-primary" />
              )}
              <span className={cn('absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface', currentStatus.dotClass)} />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground tracking-tight">{name}</h3>
                {variant === 'featured' && (
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                <Cpu className="size-3" />
                <span>{model}</span>
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
                <Play className="size-3.5 mr-2 text-primary" />
                Run Agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        <p className="mt-3 text-muted-foreground line-clamp-2 leading-relaxed text-[11px]">
          {description}
        </p>

        {/* Tools and Capabilities Tags */}
        {(tools.length > 0 || capabilities.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tools.map((t) => (
              <span
                key={t}
                className="rounded-xs bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60"
              >
                {t}
              </span>
            ))}
            {capabilities.map((c) => (
              <span
                key={c}
                className="rounded-xs bg-accent px-1.5 py-0.5 font-medium text-[10px] text-accent-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Stats & Primary Actions */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-subtle font-mono">
          {runsCount !== undefined && (
            <span title="Total executions">
              {runsCount.toLocaleString()} runs
            </span>
          )}
          {avgLatency && (
            <span title="Average response latency" className="flex items-center gap-0.5">
              <Activity className="size-3 text-primary" />
              {avgLatency}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onChat && (
            <Button size="xs" variant="outline" onClick={onChat} leadingIcon={<MessageSquare className="size-3" />}>
              Chat
            </Button>
          )}
          {onRun && (
            <Button size="xs" variant="primary" onClick={onRun} leadingIcon={<Play className="size-3" />}>
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
