import type { Message, StructuredMessageAction, SystemMessageContent } from '@org/types';
import { Button } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { executeStructuredAction } from './action-handler.js';

export interface SystemMessageCardProps {
  message: Message;
  event: SystemMessageContent;
  isHighlighted?: boolean;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
}

export function SystemMessageCard({
  message,
  event,
  isHighlighted = false,
  onAction,
}: SystemMessageCardProps) {
  const getSeverityStyle = () => {
    switch (event.severity) {
      case 'success':
        return {
          icon: <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />,
          border: 'border-emerald-500/40 bg-emerald-500/5',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="size-4 text-amber-500 shrink-0" />,
          border: 'border-amber-500/40 bg-amber-500/5',
        };
      case 'error':
        return {
          icon: <AlertCircle className="size-4 text-rose-500 shrink-0" />,
          border: 'border-rose-500/40 bg-rose-500/5',
        };
      default:
        return {
          icon: <Info className="size-4 text-blue-500 shrink-0" />,
          border: 'border-blue-500/40 bg-blue-500/5',
        };
    }
  };

  const style = getSeverityStyle();

  const handleAction = async (action: StructuredMessageAction) => {
    if (onAction) {
      await onAction(action);
      return;
    }
    await executeStructuredAction(action, {
      roomId: message.roomId,
      messageId: message.id,
    });
  };

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/system-card relative my-2 rounded-xl border p-3.5 text-xs transition-all shadow-2xs max-w-lg',
        style.border,
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      <div className="flex items-start gap-2.5">
        {style.icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground">{event.title}</span>
            {event.code && (
              <span className="font-mono text-[10px] text-muted-foreground">{event.code}</span>
            )}
          </div>
          {event.details && (
            <p className="mt-1 text-muted-foreground leading-relaxed">{event.details}</p>
          )}

          {event.actions && event.actions.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
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
                    onClick={() => handleAction(act)}
                    className="h-6 text-[11px] px-2 gap-1"
                  >
                    <span>{act.label}</span>
                    <ArrowUpRight className="size-3 opacity-70" />
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
