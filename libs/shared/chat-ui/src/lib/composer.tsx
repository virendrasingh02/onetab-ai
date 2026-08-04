import type { RoomMember } from '@org/types';
import { Button, Hint, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Paperclip, Send, Smile, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/** A small, dependency-free picker. Enough for a composer, no 2 MB payload. */
const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: 'Reactions',
    emoji: [
      '👍',
      '👎',
      '❤️',
      '🎉',
      '😄',
      '😮',
      '😢',
      '🙏',
      '🔥',
      '👀',
      '✅',
      '🚀',
    ],
  },
  {
    label: 'People',
    emoji: [
      '😀',
      '😅',
      '😉',
      '😊',
      '🤔',
      '🙃',
      '😴',
      '🤯',
      '🥳',
      '😎',
      '🤝',
      '👋',
    ],
  },
  {
    label: 'Objects',
    emoji: [
      '💡',
      '📌',
      '📎',
      '📅',
      '⏰',
      '⚠️',
      '🐛',
      '🔒',
      '📈',
      '🧪',
      '☕',
      '🍕',
    ],
  },
];

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div
      role="dialog"
      aria-label="Emoji picker"
      className="left-0 mb-2 w-64 p-2 absolute bottom-full z-50 rounded-lg border bg-popover shadow-overlay"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Emoji</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close emoji picker"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {EMOJI_GROUPS.map((group) => (
          <section key={group.label}>
            <p className="px-1 py-1 font-medium text-[10px] text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="gap-0.5 grid grid-cols-6">
              {group.emoji.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelect(emoji)}
                  aria-label={emoji}
                  className="rounded p-1 text-lg hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export interface ComposerProps {
  onSend: (body: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList) => void;
  /** Candidates for @-mention autocomplete. */
  members?: RoomMember[];
  placeholder?: string;
  disabled?: boolean;
  /** Rendered above the input, e.g. a reply or edit banner. */
  contextSlot?: ReactNode;
  /** Enter sends; Shift+Enter inserts a newline. */
  enterToSend?: boolean;
}

export function Composer({
  onSend,
  onTyping,
  onAttach,
  members = [],
  placeholder = 'Write a message…',
  disabled = false,
  contextSlot,
  enterToSend = true,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop the typing notice when the composer unmounts mid-compose, otherwise
  // the indicator sticks for everyone else until the server expires it.
  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      onTyping?.(false);
    };
  }, [onTyping]);

  const signalTyping = useCallback(() => {
    onTyping?.(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping?.(false), 3000);
  }, [onTyping]);

  const mentionMatches = mentionQuery
    ? members
        .filter((member) =>
          member.displayName.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const handleChange = (next: string) => {
    setValue(next);
    signalTyping();

    // Only offer completions for a mention token at the caret.
    const match = /(?:^|\s)@(\w*)$/.exec(next);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (member: RoomMember) => {
    setValue((current) =>
      current.replace(
        /(?:^|\s)@(\w*)$/,
        (prefix) =>
          `${prefix.startsWith(' ') ? ' ' : ''}@${member.displayName} `,
      ),
    );
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const submit = async () => {
    const body = value.trim();
    if (!body || disabled) return;

    setValue('');
    setMentionQuery(null);
    onTyping?.(false);
    await onSend(body);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMatches.length && event.key === 'Tab') {
      event.preventDefault();
      insertMention(mentionMatches[0]);
      return;
    }
    if (event.key === 'Enter' && enterToSend && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="p-3 relative border-t">
      {contextSlot}

      {mentionMatches.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="left-3 mb-2 w-64 p-1 absolute bottom-full z-50 overflow-hidden rounded-lg border bg-popover shadow-overlay"
        >
          {mentionMatches.map((member) => (
            <li key={member.userId}>
              <button
                onClick={() => insertMention(member)}
                className="gap-2 px-2 py-1.5 text-sm flex w-full items-center rounded-md text-left hover:bg-accent"
              >
                <UserAvatar
                  name={member.displayName}
                  src={member.avatarUrl}
                  seed={member.userId}
                  size="xs"
                />
                <span className="truncate">{member.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmoji ? (
        <EmojiPicker
          onSelect={(emoji) => {
            setValue((current) => current + emoji);
            setShowEmoji(false);
            textareaRef.current?.focus();
          }}
          onClose={() => setShowEmoji(false)}
        />
      ) : null}

      <div
        className={cn(
          'gap-1 px-2 py-1.5 flex items-end rounded-lg border border-input bg-background',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
          disabled && 'opacity-60',
        )}
      >
        <Hint label="Attach a file">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Attach a file"
            disabled={disabled}
            onClick={() => document.getElementById('composer-file')?.click()}
          >
            <Paperclip />
          </Button>
        </Hint>
        <input
          id="composer-file"
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) onAttach?.(event.target.files);
            event.target.value = '';
          }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="Message"
          className="max-h-40 min-h-8 py-1 text-sm field-sizing-content flex-1 resize-none bg-transparent outline-none placeholder:text-muted-foreground"
        />

        <Hint label="Emoji">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Insert emoji"
            disabled={disabled}
            onClick={() => setShowEmoji((open) => !open)}
          >
            <Smile />
          </Button>
        </Hint>

        <Button
          size="icon-sm"
          aria-label="Send message"
          disabled={disabled || !value.trim()}
          onClick={() => void submit()}
        >
          <Send />
        </Button>
      </div>

      <p className="mt-1 px-1 text-[10px] text-muted-foreground">
        {enterToSend
          ? 'Enter to send · Shift+Enter for a new line'
          : 'Ctrl+Enter to send'}
      </p>
    </div>
  );
}
