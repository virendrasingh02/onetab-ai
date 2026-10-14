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

function Snippet({ preview }: { preview: ReplyPreview }) {
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
 * The quote shown above a reply in the timeline: a thin accent rail, the
 * original's author and a one-line snippet. Clicking it jumps to the original.
 * With no `preview` the original is not loaded yet; the click still pages it in.
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
        preview ? `Jump to message from ${preview.senderName}` : 'Jump to original message'
      }
      className={cn(
        'group/quote mb-1 -ml-1 flex w-fit max-w-full min-w-0 items-center gap-2 rounded-md py-0.5 pr-2.5 pl-1 text-left text-xs text-muted-foreground transition-colors',
        onJump && 'hover:bg-accent hover:text-foreground',
      )}
    >
      <CornerUpLeft
        className="size-3.5 shrink-0 text-accent-violet"
        aria-hidden
      />
      {preview ? (
        <>
          <UserAvatar
            name={preview.senderName}
            src={preview.senderAvatarUrl}
            seed={preview.senderId}
            size="xs"
            indicator={false}
          />
          <span className="shrink-0 font-semibold text-foreground">
            {preview.senderName}
          </span>
          <span className="min-w-0 truncate">
            <Snippet preview={preview} />
          </span>
        </>
      ) : (
        <span className="italic">Replied to an earlier message</span>
      )}
    </button>
  );
}

/** The "Replying to …" strip above the composer input. */
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
    <div className="gap-2 border-b border-border px-3.5 py-2 text-xs flex items-center text-muted-foreground">
      <CornerUpLeft
        className="size-3.5 shrink-0 text-accent-violet"
        aria-hidden
      />
      <button
        type="button"
        onClick={onJump}
        className="min-w-0 gap-1.5 flex flex-1 items-center text-left hover:text-foreground"
      >
        <span className="shrink-0">Replying to</span>
        <span className="shrink-0 font-semibold text-foreground">
          {preview.senderName}
        </span>
        <span className="min-w-0 truncate">
          <Snippet preview={preview} />
        </span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="size-6 flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
