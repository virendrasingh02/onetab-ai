import { isCallLive } from '@org/matrix-client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { ChevronDown, Headphones, Link2, Phone, Video } from 'lucide-react';
import { useCallback } from 'react';
import { useCall } from './use-call.js';

export interface ConversationCallControlProps {
  /** Starts the conversation's huddle, or joins the one already running. */
  onHuddle: () => void;
  /** A huddle is already running here — the action joins rather than starts. */
  huddleRunning?: boolean;
  busy?: boolean;
  /** Shareable join link; adds "Copy huddle link" to the menu. */
  huddleLink?: string;
  /**
   * Room to place a 1:1 voice/video call in. Set only for direct messages —
   * a call in a group would ring every member, which is what a huddle is for.
   */
  directCallRoomId?: string | null;
}

/**
 * The one call affordance in every conversation header: a huddle button with
 * a menu holding every other way to talk — 1:1 voice/video in a DM, the huddle
 * link in a channel. Channels, DMs and group DMs all render this, so the
 * header looks and behaves the same wherever you are.
 */
export function ConversationCallControl({
  directCallRoomId,
  ...props
}: ConversationCallControlProps) {
  // `useCall` subscribes to the call manager, so only DMs pay for it.
  return directCallRoomId ? (
    <DirectCallControl {...props} roomId={directCallRoomId} />
  ) : (
    <CallControlButton {...props} />
  );
}

function DirectCallControl({
  roomId,
  ...props
}: Omit<ConversationCallControlProps, 'directCallRoomId'> & {
  roomId: string;
}) {
  const { state, startCall } = useCall();
  const start = useCallback(
    async (kind: 'voice' | 'video') => {
      try {
        await startCall(roomId, kind);
      } catch (err: unknown) {
        toast.error(`Could not start ${kind} call`, {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [roomId, startCall],
  );
  return (
    <CallControlButton
      {...props}
      calls={{
        disabled: isCallLive(state),
        onVoice: () => void start('voice'),
        onVideo: () => void start('video'),
      }}
    />
  );
}

function CallControlButton({
  onHuddle,
  huddleRunning = false,
  busy = false,
  huddleLink,
  calls,
}: Omit<ConversationCallControlProps, 'directCallRoomId'> & {
  calls?: { disabled: boolean; onVoice: () => void; onVideo: () => void };
}) {
  const huddleLabel = huddleRunning ? 'Join huddle' : 'Start a huddle';

  const copyHuddleLink = useCallback(() => {
    if (!huddleLink) return;
    navigator.clipboard?.writeText(huddleLink).then(
      () =>
        toast.success('Huddle link copied', {
          description: 'Anyone in the channel who opens it joins the huddle.',
        }),
      () => toast.error('Could not copy the huddle link.'),
    );
  }, [huddleLink]);

  return (
    <div
      className={cn(
        'inline-flex h-7 items-center overflow-hidden rounded-md border border-border bg-background shadow-xs transition-colors',
        'hover:border-foreground/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40',
      )}
    >
      <Hint label={huddleLabel}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={huddleLabel}
          onClick={onHuddle}
          disabled={busy}
          className="h-full w-8 rounded-none focus-visible:ring-0"
        >
          <Headphones />
        </Button>
      </Hint>
      <DropdownMenu>
        <span aria-hidden className="h-4 w-px bg-border" />
        <Hint label="Call options">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Call options"
              className="h-full w-6 rounded-none text-muted-foreground focus-visible:ring-0 data-[state=open]:bg-accent data-[state=open]:text-foreground"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem
            className="gap-2.5"
            disabled={busy}
            onSelect={onHuddle}
          >
            <Headphones className="size-4" />
            <span>{huddleLabel}</span>
          </DropdownMenuItem>
          {calls ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2.5"
                disabled={calls.disabled}
                onSelect={calls.onVoice}
              >
                <Phone className="size-4" />
                <span>Start voice call</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2.5"
                disabled={calls.disabled}
                onSelect={calls.onVideo}
              >
                <Video className="size-4" />
                <span>Start video call</span>
              </DropdownMenuItem>
            </>
          ) : null}
          {huddleLink ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5" onSelect={copyHuddleLink}>
                <Link2 className="size-4" />
                <span>Copy huddle link</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
