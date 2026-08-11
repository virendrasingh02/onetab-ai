import type { RoomMember } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bold,
  ChevronDown,
  Clock,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Send,
  Slash,
  Smile,
  SquareCode,
  Strikethrough,
  Type,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
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
      className="left-0 mb-2 w-64 max-w-[calc(100vw-2rem)] p-2 absolute bottom-full z-50 rounded-lg border bg-popover shadow-overlay"
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

/* --- slash commands ------------------------------------------------------- */

export interface SlashCommand {
  name: string;
  /** Shown after the name, e.g. `[message]`. */
  args?: string;
  description: string;
}

/** The commands a channel understands. Matched by prefix as the user types. */
export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  { name: '/here', description: 'Notify everyone active in this channel' },
  { name: '/channel', description: 'Notify everyone in this channel' },
  { name: '/huddle', description: 'Start a huddle in this channel' },
  {
    name: '/remind',
    args: '[who] [what] [when]',
    description: 'Set a reminder for yourself or someone else',
  },
  {
    name: '/topic',
    args: '[text]',
    description: "Set the channel's topic",
  },
  {
    name: '/invite',
    args: '@person',
    description: 'Add someone to this channel',
  },
  {
    name: '/dm',
    args: '@person [message]',
    description: 'Open a direct message',
  },
  { name: '/poll', args: '[question]', description: 'Start a quick poll' },
  { name: '/away', description: 'Toggle your away status' },
  { name: '/shrug', args: '[message]', description: 'Append ¯\\_(ツ)_/¯' },
];

/* --- formatting ----------------------------------------------------------- */

type FormatKind =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'quote'
  | 'bullet'
  | 'ordered';

const WRAPPERS: Partial<Record<FormatKind, [before: string, after: string]>> = {
  bold: ['**', '**'],
  italic: ['_', '_'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
  codeblock: ['```\n', '\n```'],
  link: ['[', '](url)'],
};

const LINE_PREFIXES: Partial<Record<FormatKind, string>> = {
  quote: '> ',
  bullet: '• ',
  ordered: '1. ',
};

const FORMAT_BUTTONS: {
  kind: FormatKind;
  label: string;
  shortcut?: string;
  icon: ReactNode;
}[] = [
  { kind: 'bold', label: 'Bold', shortcut: 'Ctrl+B', icon: <Bold /> },
  { kind: 'italic', label: 'Italic', shortcut: 'Ctrl+I', icon: <Italic /> },
  { kind: 'strike', label: 'Strikethrough', icon: <Strikethrough /> },
  { kind: 'link', label: 'Link', shortcut: 'Ctrl+K', icon: <Link2 /> },
  { kind: 'ordered', label: 'Ordered list', icon: <ListOrdered /> },
  { kind: 'bullet', label: 'Bulleted list', icon: <List /> },
  { kind: 'quote', label: 'Blockquote', icon: <Quote /> },
  { kind: 'code', label: 'Code', icon: <Code /> },
  { kind: 'codeblock', label: 'Code block', icon: <SquareCode /> },
];

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
  /** Hides the formatting toolbar for compact placements like a thread reply. */
  showFormatting?: boolean;
  /** Commands offered when the message starts with `/`. */
  slashCommands?: SlashCommand[];
  /** Enables the send split-button; omit for a plain send. */
  onSchedule?: (body: string, when: string) => void;
  onStartHuddle?: () => void;
  onRecordClip?: () => void;
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
  showFormatting = true,
  slashCommands = DEFAULT_SLASH_COMMANDS,
  onSchedule,
  onStartHuddle,
  onRecordClip,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [commandQuery, setCommandQuery] = useState<string | null>(null);
  const [formattingOpen, setFormattingOpen] = useState(showFormatting);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputId = useId();

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

  // Commands only apply to the whole message, so they are offered from the
  // start of the input rather than at any caret position like a mention.
  const commandMatches =
    commandQuery === null
      ? []
      : slashCommands
          .filter((command) => command.name.startsWith(`/${commandQuery}`))
          .slice(0, 6);

  const handleChange = (next: string) => {
    setValue(next);
    signalTyping();

    // Only offer completions for a mention token at the caret.
    const mention = /(?:^|\s)@(\w*)$/.exec(next);
    setMentionQuery(mention ? mention[1] : null);

    const command = /^\/(\w*)$/.exec(next);
    setCommandQuery(command ? command[1] : null);
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

  const insertCommand = (command: SlashCommand) => {
    setValue(`${command.name} `);
    setCommandQuery(null);
    textareaRef.current?.focus();
  };

  /**
   * Applies markdown around the selection.
   *
   * Wrapping the selected text — rather than dropping markers at the caret —
   * is what makes the toolbar worth having: select a phrase, hit bold, keep
   * typing. Line formats prefix every selected line instead.
   */
  const applyFormat = (kind: FormatKind) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    const prefix = LINE_PREFIXES[kind];
    if (prefix) {
      // Expand the selection to whole lines so the prefix lands in column 0.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end) || '';
      const prefixed = block
        .split('\n')
        .map((line, index) =>
          kind === 'ordered' ? `${index + 1}. ${line}` : `${prefix}${line}`,
        )
        .join('\n');

      const next = value.slice(0, lineStart) + prefixed + value.slice(end);
      setValue(next);
      queueMicrotask(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
      });
      return;
    }

    const [before, after] = WRAPPERS[kind] ?? ['', ''];
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);

    setValue(next);
    queueMicrotask(() => {
      textarea.focus();
      // Leave the selection on the text, not the markers, so a second format
      // can be stacked on the same phrase.
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  };

  const submit = async () => {
    const body = value.trim();
    if (!body || disabled) return;

    setValue('');
    setMentionQuery(null);
    setCommandQuery(null);
    onTyping?.(false);
    await onSend(body);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (commandMatches.length && event.key === 'Tab') {
      event.preventDefault();
      insertCommand(commandMatches[0]);
      return;
    }
    if (mentionMatches.length && event.key === 'Tab') {
      event.preventDefault();
      insertMention(mentionMatches[0]);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const shortcut: Partial<Record<string, FormatKind>> = {
        b: 'bold',
        i: 'italic',
        k: 'link',
      };
      const kind = shortcut[event.key.toLowerCase()];
      if (kind) {
        event.preventDefault();
        applyFormat(kind);
        return;
      }
    }

    if (event.key === 'Escape') {
      setMentionQuery(null);
      setCommandQuery(null);
      setShowEmoji(false);
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

      {commandMatches.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Slash commands"
          className="left-3 right-3 mb-2 p-1 absolute bottom-full z-50 overflow-hidden rounded-lg border bg-popover shadow-overlay"
        >
          <li className="px-2 py-1 font-medium text-[10px] text-muted-foreground uppercase">
            Commands
          </li>
          {commandMatches.map((command) => (
            <li key={command.name}>
              <button
                onClick={() => insertCommand(command)}
                className="gap-2 px-2 py-1.5 text-sm flex w-full items-center rounded-md text-left hover:bg-accent"
              >
                <Slash className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs shrink-0 text-foreground">
                  {command.name}
                </span>
                {command.args ? (
                  <span className="font-mono text-xs shrink-0 text-subtle">
                    {command.args}
                  </span>
                ) : null}
                <span className="ml-auto text-xs truncate text-muted-foreground">
                  {command.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mentionMatches.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="left-3 mb-2 w-64 max-w-[calc(100vw-2rem)] p-1 absolute bottom-full z-50 overflow-hidden rounded-lg border bg-popover shadow-overlay"
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
          'overflow-hidden rounded-lg border border-input bg-background',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
          disabled && 'opacity-60',
        )}
      >
        {formattingOpen ? (
          <div className="gap-0.5 px-1.5 py-1 flex flex-wrap items-center border-b border-border">
            {FORMAT_BUTTONS.map((button, index) => (
              <span key={button.kind} className="flex items-center">
                {/* Separate the character formats from the block formats. */}
                {index === 4 || index === 7 ? (
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                ) : null}
                <Hint label={button.label} shortcut={button.shortcut}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={button.label}
                    disabled={disabled}
                    onClick={() => applyFormat(button.kind)}
                  >
                    {button.icon}
                  </Button>
                </Hint>
              </span>
            ))}
          </div>
        ) : null}

        <div className="gap-1 px-2 py-1.5 flex items-end">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Message"
            className="max-h-40 min-h-8 px-1 py-1 text-sm field-sizing-content flex-1 resize-none bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="gap-0.5 px-1.5 pb-1.5 flex items-center">
          <Hint label={formattingOpen ? 'Hide formatting' : 'Show formatting'}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                formattingOpen ? 'Hide formatting' : 'Show formatting'
              }
              aria-pressed={formattingOpen}
              disabled={disabled}
              onClick={() => setFormattingOpen((open) => !open)}
            >
              <Type />
            </Button>
          </Hint>

          <Hint label="Attach a file">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Attach a file"
              disabled={disabled}
              onClick={() => document.getElementById(fileInputId)?.click()}
            >
              <Paperclip />
            </Button>
          </Hint>
          <input
            id={fileInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) onAttach?.(event.target.files);
              event.target.value = '';
            }}
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

          <Hint label="Run a command">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Run a command"
              disabled={disabled}
              onClick={() => {
                setValue('/');
                setCommandQuery('');
                textareaRef.current?.focus();
              }}
            >
              <Zap />
            </Button>
          </Hint>

          {onStartHuddle ? (
            <Hint label="Start a huddle">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Start a huddle"
                disabled={disabled}
                onClick={onStartHuddle}
              >
                <Video />
              </Button>
            </Hint>
          ) : null}

          {onRecordClip ? (
            <Hint label="Record a clip">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Record a clip"
                disabled={disabled}
                onClick={onRecordClip}
              >
                <Clock />
              </Button>
            </Hint>
          ) : null}

          <div className="ml-auto gap-0.5 flex items-center">
            <Button
              size="icon-sm"
              aria-label="Send message"
              disabled={disabled || !value.trim()}
              onClick={() => void submit()}
            >
              <Send />
            </Button>

            {onSchedule ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    aria-label="Send options"
                    disabled={disabled || !value.trim()}
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Schedule message</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {['In 30 minutes', 'Tomorrow at 9:00', 'Monday at 9:00'].map(
                    (when) => (
                      <DropdownMenuItem
                        key={when}
                        onSelect={() => {
                          const body = value.trim();
                          if (!body) return;
                          onSchedule(body, when);
                          setValue('');
                        }}
                      >
                        <Clock />
                        {when}
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-1 px-1 text-[10px] text-muted-foreground hidden sm:block">
        {enterToSend
          ? 'Enter to send · Shift+Enter for a new line · / for commands'
          : 'Ctrl+Enter to send'}
      </p>
    </div>
  );
}
