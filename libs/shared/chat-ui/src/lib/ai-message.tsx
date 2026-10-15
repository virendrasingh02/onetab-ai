import { Button, AIModelIcon, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { MarkdownMessage } from './markdown-message.js';

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
  modelId?: string;
  provider?: string;
  density?: AIDensity;
  /** The signed-in person, shown beside their own turns. */
  user?: { id?: string; name?: string; avatarUrl?: string | null };
}

/**
 * Your turns are a soft right-aligned bubble with your avatar; the assistant's
 * are plain text beside a model avatar — no card, no per-message chrome. The
 * sender and time stay available on hover/title rather than taking a row.
 */
export function AIMessage({
  message,
  assistantLabel = 'Copilot',
  modelId,
  provider,
  density = 'comfortable',
  user,
}: AIMessageProps) {
  const isUser = message.role === 'user';
  const isCompact = density === 'compact';
  const avatarSize = isCompact ? 'size-6' : 'size-8';
  const title = `${isUser ? (user?.name ?? 'You') : assistantLabel} · ${timeLabel(message.at)}`;

  return (
    <div
      title={title}
      className={cn(
        'gap-3 flex items-start',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          avatarSize,
          !isUser && 'border border-border bg-surface-raised',
        )}
      >
        {isUser ? (
          <UserAvatar
            name={user?.name ?? 'You'}
            src={user?.avatarUrl ?? undefined}
            seed={user?.id}
            size={isCompact ? 'xs' : 'sm'}
            indicator={false}
          />
        ) : (
          <AIModelIcon
            modelId={modelId || assistantLabel}
            provider={provider}
            size={isCompact ? 14 : 18}
            className="shrink-0"
          />
        )}
      </div>
      <div
        className={cn(
          'min-w-0 leading-relaxed',
          isCompact ? 'text-xs' : 'text-sm',
          isUser
            ? 'max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-foreground'
            : 'max-w-full flex-1 pt-1 text-foreground',
        )}
      >
        <MarkdownMessage
          text={message.content}
          className="text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}

export function AIThinkingRow({ density = 'comfortable' }: { density?: AIDensity }) {
  return (
    <div
      className={cn(
        'gap-2 mr-auto flex w-fit items-center py-1 text-muted-foreground',
        density === 'compact' ? 'text-xs' : 'text-sm',
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
          className="h-6 text-xs"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
