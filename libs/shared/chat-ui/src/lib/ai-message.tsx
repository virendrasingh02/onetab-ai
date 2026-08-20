import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { Sparkles, TriangleAlert, User } from 'lucide-react';

/**
 * One turn in an assistant transcript.
 *
 * Deliberately structural rather than imported from a feature library: the
 * model chat, the docked assistant and an agent conversation all render these
 * rows, and each builds its transcript from a different source — a live
 * completion, a cached one, or an execution log read back from the server.
 */
export interface AITranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** ISO timestamp — formatted at render, not at creation. */
  at: string;
}

/**
 * `compact` is the docked assistant in a ~340px rail; `comfortable` is the
 * full-page view. One bubble, two scales — the two surfaces previously drew
 * their own, down to different radii and different meta rows.
 */
export type AIDensity = 'comfortable' | 'compact';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export interface AIMessageProps {
  message: AITranscriptMessage;
  /** Names the assistant after the model that answered. */
  assistantLabel?: string;
  density?: AIDensity;
}

export function AIMessage({
  message,
  assistantLabel = 'Copilot',
  density = 'comfortable',
}: AIMessageProps) {
  const isUser = message.role === 'user';
  const isCompact = density === 'compact';

  return (
    <div
      className={cn(
        'space-y-1 rounded-card leading-relaxed',
        isCompact ? 'max-w-[90%] p-3 text-xs' : 'max-w-[85%] p-3.5 text-sm',
        isUser
          ? 'ml-auto bg-primary text-primary-foreground'
          : 'mr-auto border border-border bg-surface-raised text-foreground',
      )}
    >
      <div className="gap-3 text-[10px] flex items-center justify-between opacity-70">
        <span className="gap-1 font-medium flex items-center">
          {isUser ? (
            <User className="size-3" aria-hidden />
          ) : (
            <Sparkles className="size-3" aria-hidden />
          )}
          <span className="truncate">{isUser ? 'You' : assistantLabel}</span>
        </span>
        <time dateTime={message.at} className="shrink-0">
          {timeLabel(message.at)}
        </time>
      </div>
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  );
}

export function AIThinkingRow({ density = 'comfortable' }: { density?: AIDensity }) {
  return (
    <div
      className={cn(
        'gap-2 rounded-card mr-auto flex w-fit items-center',
        'border border-border bg-surface-raised text-muted-foreground',
        density === 'compact' ? 'p-3 text-xs' : 'p-3.5 text-sm',
      )}
      role="status"
    >
      <Sparkles className="size-4 animate-pulse text-primary" aria-hidden />
      <span>Thinking…</span>
    </div>
  );
}

export interface AIErrorRowProps {
  error: unknown;
  onRetry: () => void;
  density?: AIDensity;
}

export function AIErrorRow({
  error,
  onRetry,
  density = 'comfortable',
}: AIErrorRowProps) {
  return (
    <div
      className={cn(
        'gap-2 rounded-card mr-auto flex items-start',
        'border border-destructive/40 bg-destructive/10 text-destructive',
        density === 'compact' ? 'p-3 text-xs' : 'p-3.5 text-sm',
      )}
      role="alert"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <div className="space-y-1.5">
        <p>
          {error instanceof Error
            ? error.message
            : 'The assistant could not respond.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[11px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
