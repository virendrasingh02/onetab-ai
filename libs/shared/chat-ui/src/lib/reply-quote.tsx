import type { Message } from '@org/types';
import { UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { CornerUpLeft, Image as ImageIcon, X } from 'lucide-react';

/** What the quote needs from the message being replied to. */
export interface ReplyPreview {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  /** Plain-text snippet; empty for media-only messages. */
  text: string;
  /** Media-only original — shown as a label instead of a snippet. */
  hasAttachment: boolean;
  isRedacted: boolean;
}

const SNIPPET_LENGTH = 140;

/** Flattens markdown-ish text into a one-line snippet. */
function toSnippet(body: string): string {
  const flat = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > SNIPPET_LENGTH
    ? `${flat.slice(0, SNIPPET_LENGTH).trimEnd()}…`
    : flat;
}

export function toReplyPreview(message: Message): ReplyPreview {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatarUrl: message.senderAvatarUrl,
    text: toSnippet(message.forwarded ? '' : message.body),
    hasAttachment: !!message.attachment || !!message.forwarded,
    isRedacted: message.isRedacted,
  };
}

export function ReplySnippet({ preview }: { preview: ReplyPreview }) {
  if (preview.isRedacted) {
    return <span className="italic">Original message was deleted</span>;
  }
  if (preview.text) return <span>{preview.text}</span>;
  if (preview.hasAttachment) {
    return (
      <span className="gap-1 inline-flex items-center">
        <ImageIcon className="size-3" aria-hidden />
        Attachment
      </span>
    );
  }
  return <span className="italic">Empty message</span>;
}

/**
 * The quote shown above a reply in the timeline: a card with an accent rail,
 * the original's author on top and up to two lines of its text below.
 * Clicking it jumps to the original. With no `preview` the original is not
 * loaded yet; the click still pages it in.
 */
export function ReplyQuote({
  preview,
  onJump,
}: {
  preview: ReplyPreview | null;
  onJump?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!onJump}
      aria-label={
        preview
          ? `Jump to message from ${preview.senderName}`
          : 'Jump to original message'
      }
      className={cn(
        'group/quote mt-0.5 mb-1.5 min-w-0 py-1.5 pr-3 pl-3.5 text-xs sm:max-w-xl relative flex w-fit max-w-full overflow-hidden rounded-lg border border-border/60 bg-muted/40 text-left transition-colors',
        'before:inset-y-0 before:left-0 before:absolute before:w-[3px] before:bg-accent-violet/60 before:transition-colors',
        onJump &&
          'cursor-pointer hover:border-accent-violet/30 hover:bg-accent-violet-soft hover:before:bg-accent-violet focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
    >
      {preview ? (
        <span className="min-w-0 gap-0.5 flex flex-col">
          <span className="min-w-0 gap-1.5 flex items-center">
            <CornerUpLeft
              className="size-3 shrink-0 text-accent-violet"
              aria-hidden
            />
            <UserAvatar
              name={preview.senderName}
              src={preview.senderAvatarUrl}
              seed={preview.senderId}
              size="xs"
              indicator={false}
            />
            <span className="font-semibold truncate text-accent-violet">
              {preview.senderName}
            </span>
          </span>
          <span className="leading-snug line-clamp-2 break-words text-muted-foreground group-hover/quote:text-foreground/80">
            <ReplySnippet preview={preview} />
          </span>
        </span>
      ) : (
        <span className="gap-1.5 flex items-center text-muted-foreground italic">
          <CornerUpLeft
            className="size-3 shrink-0 text-accent-violet"
            aria-hidden
          />
          Replied to an earlier message
        </span>
      )}
    </button>
  );
}

/** The "Replying to …" card above the composer input. */
export function ReplyingToBar({
  preview,
  onCancel,
  onJump,
}: {
  preview: ReplyPreview;
  onCancel: () => void;
  onJump?: () => void;
}) {
  return (
    <div className="px-2.5 pt-2.5">
      <div className="gap-2 py-1.5 pr-1.5 pl-3.5 text-xs before:inset-y-0 before:left-0 relative flex items-center overflow-hidden rounded-lg border border-accent-violet/20 bg-accent-violet-soft before:absolute before:w-[3px] before:bg-accent-violet">
        <button
          type="button"
          onClick={onJump}
          className="min-w-0 gap-0.5 flex flex-1 flex-col text-left focus-visible:outline-none"
        >
          <span className="min-w-0 gap-1.5 flex items-center text-muted-foreground">
            <CornerUpLeft
              className="size-3 shrink-0 text-accent-violet"
              aria-hidden
            />
            <span className="shrink-0">Replying to</span>
            <span className="font-semibold truncate text-accent-violet">
              {preview.senderName}
            </span>
          </span>
          <span className="min-w-0 truncate text-foreground/80">
            <ReplySnippet preview={preview} />
          </span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="size-7 flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
