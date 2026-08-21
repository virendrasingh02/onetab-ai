import { cn } from '@org/utils';
import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  FileCode,
  FileText,
  Sparkles,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button.js';


export type UniversalCardType =
  | 'agent'
  | 'app'
  | 'workflow'
  | 'document'
  | 'file'
  | 'chart'
  | 'table'
  | 'search'
  | 'citation'
  | 'product'
  | 'task'
  | 'calendar'
  | 'meeting'
  | 'automation'
  | 'approval'
  | 'form'
  | 'metric'
  | 'code'
  | 'custom';

export interface UniversalCardAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  icon?: ReactNode;
  onClick?: (cardData: any) => void;
  href?: string;
}

export interface UniversalCardConfig {
  id: string;
  type: UniversalCardType;
  variant?: 'default' | 'compact' | 'featured' | 'interactive';
  density?: 'compact' | 'default' | 'comfortable';
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  statusType?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  icon?: ReactNode;
  avatarUrl?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  data?: any;
  actions?: UniversalCardAction[];
  footer?: ReactNode;
}


export interface UniversalCardProps extends ComponentProps<'div'> {
  config: UniversalCardConfig;
  onActionClick?: (actionId: string, cardConfig: UniversalCardConfig) => void;
}

export function UniversalCard({ config, onActionClick, className, ...props }: UniversalCardProps) {
  const {
    type,
    variant = 'default',
    density = 'default',
    title,
    subtitle,
    description,
    status,
    statusType = 'neutral',
    icon,
    avatarUrl,
    metadata,
    tags,
    actions = [],
    footer,
  } = config;


  const statusBadgeClasses = {
    success: 'bg-success/15 text-success-text border-success/30',
    warning: 'bg-warning/15 text-warning-text border-warning/30',
    error: 'bg-destructive/15 text-destructive-text border-destructive/30',
    info: 'bg-info/15 text-info-text border-info/30',
    neutral: 'bg-surface-raised text-muted-foreground border-border',
  }[statusType];

  const getTypeIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'agent':
        return <Bot className="size-4 text-primary" />;
      case 'workflow':
      case 'automation':
        return <Workflow className="size-4 text-accent-violet" />;
      case 'document':
        return <FileText className="size-4 text-info" />;
      case 'metric':
        return <TrendingUp className="size-4 text-success" />;
      case 'task':
        return <CheckCircle2 className="size-4 text-primary" />;
      case 'meeting':
      case 'calendar':
        return <Calendar className="size-4 text-accent-amber" />;
      case 'code':
        return <FileCode className="size-4 text-accent-cyan" />;
      case 'approval':
        return <AlertCircle className="size-4 text-warning" />;
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  const densityPadding = {
    compact: 'p-2.5 gap-2',
    default: 'p-3.5 gap-3',
    comfortable: 'p-4.5 gap-4',
  }[density];

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-card border border-border bg-surface shadow-xs transition-all duration-(--duration-fast)',
        'hover:border-border-strong hover:shadow-sm text-xs',
        variant === 'featured' && 'border-primary/40 bg-gradient-to-b from-primary/5 to-transparent',
        variant === 'interactive' && 'cursor-pointer hover:border-primary/50',
        densityPadding,
        className,
      )}
      {...props}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-raised border border-border">
            {avatarUrl ? (
              <img src={avatarUrl} alt={title} className="size-full rounded-md object-cover" />
            ) : (
              getTypeIcon()
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground truncate">{title}</h4>
            {subtitle && (
              <span className="text-[11px] text-muted-foreground truncate block">{subtitle}</span>
            )}
          </div>
        </div>

        {status && (
          <span
            className={cn(
              'shrink-0 rounded-xs border px-1.5 py-0.2 text-[10px] font-medium',
              statusBadgeClasses,
            )}
          >
            {status}
          </span>
        )}
      </div>

      {/* Card Body */}
      {description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {description}
        </p>
      )}

      {/* Metadata or Key-Values */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-btn bg-surface-raised p-2 text-[11px] font-mono border border-border/60">
          {Object.entries(metadata).map(([key, val]) => (
            <div key={key} className="truncate">
              <span className="text-subtle capitalize">{key}: </span>
              <span className="text-foreground font-medium">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-xs bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer & Actions */}
      {(actions.length > 0 || footer) && (
        <div className="mt-auto pt-2.5 border-t border-border flex items-center justify-between gap-2">
          <div className="text-[11px] text-subtle">{footer}</div>

          <div className="flex items-center gap-1.5 ml-auto">
            {actions.map((act) => (
              <Button
                key={act.id}
                size="xs"
                variant={act.variant ?? 'secondary'}
                leadingIcon={act.icon}
                onClick={() => {
                  act.onClick?.(config);
                  onActionClick?.(act.id, config);
                }}
              >
                {act.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
