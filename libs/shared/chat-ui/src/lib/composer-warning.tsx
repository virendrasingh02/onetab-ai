import { X, EyeOff } from 'lucide-react';
import { Button, Badge } from '@org/ui';
import { useIsMobile } from '@org/hooks';
import { cn } from '@org/utils';
import type { AddAction, ComposerSurfaceKind, MentionKind } from '@org/types';

export interface ComposerWarningTarget {
  id: string;
  name: string;
  kind: MentionKind;
  addAction: AddAction;
}

export interface ComposerWarningState {
  targets: ComposerWarningTarget[];
}

export interface ComposerWarningProps {
  state: ComposerWarningState;
  onDismiss: () => void;
  onAdd: (targetId: string, addAction: AddAction) => void;
  channelName?: string;
  peerName?: string;
  surfaceKind?: ComposerSurfaceKind;
  className?: string;
}

export function formatTargetSentence(
  target: ComposerWarningTarget,
  surfaceKind: ComposerSurfaceKind = 'channel',
  channelName?: string,
  peerName?: string,
): string {
  const name = `@${target.name}`;
  const ch = channelName ? `#${channelName}` : 'this channel';

  if (surfaceKind === 'channel') {
    if (target.kind === 'user') {
      if (target.addAction === 'channel-member') {
        return `${name} isn't in ${ch} yet.`;
      }
      return `${name} isn't in ${ch} — ask an admin to add them so they can see this.`;
    }
    if (target.kind === 'agent' || target.kind === 'coworker') {
      if (target.addAction === 'channel-agent') {
        return `${name} isn't connected to ${ch}.`;
      }
      return `${name} isn't connected to ${ch} and won't see this.`;
    }
    if (target.kind === 'app') {
      if (target.addAction === 'channel-app') {
        return `${name} isn't connected to ${ch}.`;
      }
      return `${name} isn't connected to ${ch} and won't act on this.`;
    }
  }

  if (surfaceKind === 'dm') {
    if (target.kind === 'user') {
      return `${name} isn't in this conversation.`;
    }
    return `${name} won't see this message here.`;
  }

  if (surfaceKind === 'group-dm') {
    if (target.kind === 'user') {
      return `${name} isn't in this conversation yet.`;
    }
    return `${name} won't see this message here.`;
  }

  if (surfaceKind === 'thread') {
    if (target.kind === 'user') {
      return `${name} isn't in ${ch} and won't see this reply.`;
    }
    if (target.kind === 'agent' || target.kind === 'coworker') {
      if (target.addAction === 'channel-agent') {
        return `${name} isn't connected to ${ch}.`;
      }
      return `${name} isn't connected to ${ch} and won't see this reply.`;
    }
    if (target.kind === 'app') {
      if (target.addAction === 'channel-app') {
        return `${name} isn't connected to ${ch}.`;
      }
      return `${name} isn't connected to ${ch} and won't act on this reply.`;
    }
  }

  if (
    surfaceKind === 'agent' ||
    surfaceKind === 'coworker' ||
    surfaceKind === 'app'
  ) {
    const peer = peerName ? `@${peerName}` : 'the other participant';
    return `${name} won't see this — this conversation is just between you and ${peer}.`;
  }

  return `${name} isn't in this conversation.`;
}

export function formatActionLabel(addAction: AddAction): string | null {
  switch (addAction) {
    case 'channel-member':
    case 'channel-agent':
      return 'Add to channel';
    case 'channel-app':
      return 'Connect app';
    case 'group-dm-member':
      return 'Add to conversation';
    case 'start-group':
      return 'Start a group';
    default:
      return null;
  }
}

export function ComposerWarning({
  state,
  onDismiss,
  onAdd,
  channelName,
  peerName,
  surfaceKind = 'channel',
  className,
}: ComposerWarningProps) {
  const isMobile = useIsMobile();

  if (!state || state.targets.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'group/message relative mb-1.5 flex gap-4 px-4 pt-2.5 pb-1.5 text-sm animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="w-10 shrink-0">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <EyeOff className="size-4" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <header className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold tracking-wide text-foreground">
            Only visible to you
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="size-5 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="mt-0.5 flex flex-col gap-2">
          {state.targets.map((target) => {
            const sentence = formatTargetSentence(
              target,
              surfaceKind,
              channelName,
              peerName,
            );
            const actionLabel = formatActionLabel(target.addAction);

            return (
              <div
                key={target.id}
                className={cn(
                  'flex items-center justify-between gap-2',
                  isMobile ? 'flex-col items-start gap-2 pt-1' : 'flex-row',
                )}
              >
                <p className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap text-sm text-muted-foreground">
                  <span>{sentence}</span>
                  {target.kind === 'agent' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 uppercase"
                    >
                      AI Agent
                    </Badge>
                  ) : target.kind === 'coworker' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 uppercase"
                    >
                      AI Coworker
                    </Badge>
                  ) : target.kind === 'app' ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 uppercase"
                    >
                      App
                    </Badge>
                  ) : null}
                </p>

                {actionLabel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-6 px-2 text-xs shrink-0',
                      isMobile && 'w-full',
                    )}
                    onClick={() => onAdd(target.id, target.addAction)}
                  >
                    {actionLabel}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
