import type { RoomMember } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AtSign,
  ChevronDown,
  Clock,
  Film,
  Plus,
  Send,
  Slash,
  Smile,
  Video,
} from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { DiscordEmojiGifPicker } from './discord-emoji-gif-picker.js';
import {
  LexicalComposerInput,
  type LexicalEditorRef,
  type MentionCandidate,
} from './lexical-composer.js';
import { DEFAULT_SLASH_COMMANDS, type SlashCommand } from './slash-commands.js';

export { DEFAULT_SLASH_COMMANDS, type SlashCommand };

/**
 * Mentions that address a group rather than a person. They lead the `@` menu
 * because they are the ones people reach for by name rather than by face.
 */
const GROUP_MENTIONS: MentionCandidate[] = [
  {
    id: 'here',
    name: 'here',
    kind: 'group',
    subtitle: 'Notify active members in this channel',
  },
  {
    id: 'channel',
    name: 'channel',
    kind: 'group',
    subtitle: 'Notify every member of this channel',
  },
];

export interface ComposerProps {
  onSend: (body: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList) => void;
  members?: RoomMember[];
  placeholder?: string;
  disabled?: boolean;
  contextSlot?: ReactNode;
  enterToSend?: boolean;
  /** Off in the thread panel, where the reply box stays out of the way. */
  showFormatting?: boolean;
  slashCommands?: SlashCommand[];
  onSchedule?: (body: string, when: string) => void;
  onStartHuddle?: () => void;
  onRecordClip?: () => void;
}

/**
 * The message box: a Lexical rich-text editor plus the surrounding controls.
 *
 * The editor owns everything that depends on the caret — formatting, the `@`,
 * `/` and `:` menus, markdown shortcuts — because those need to know where the
 * cursor is. This component owns what sits around it: attachments, the emoji
 * and GIF pickers, scheduling, and send.
 */
export function Composer({
  onSend,
  onTyping,
  onAttach,
  members = [],
  placeholder = 'Message channel…',
  disabled = false,
  contextSlot,
  showFormatting = true,
  slashCommands = DEFAULT_SLASH_COMMANDS,
  onSchedule,
  onStartHuddle,
}: ComposerProps) {
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    tab: 'emoji' | 'gif';
  }>({ open: false, tab: 'emoji' });

  const lexicalRef = useRef<LexicalEditorRef | null>(null);
  const fileInputId = useId();

  const mentionCandidates = useMemo<MentionCandidate[]>(
    () => [
      ...GROUP_MENTIONS,
      ...members.map((member) => ({
        id: member.userId,
        name: member.displayName,
        avatarUrl: member.avatarUrl,
        kind: 'user' as const,
      })),
    ],
    [members],
  );

  const handleSelectGif = (gifUrl: string, title?: string) => {
    void onSend(`![${title || 'GIF'}](${gifUrl})`);
    setPickerState({ open: false, tab: 'emoji' });
  };

  return (
    <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background p-3">
      {contextSlot}

      {pickerState.open ? (
        <DiscordEmojiGifPicker
          defaultTab={pickerState.tab}
          onSelectEmoji={(emoji) => lexicalRef.current?.insertText(emoji)}
          onSelectGif={handleSelectGif}
          onClose={() => setPickerState({ open: false, tab: 'emoji' })}
        />
      ) : null}

      <div
        className={cn(
          'relative flex flex-col rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        <LexicalComposerInput
          placeholder={placeholder}
          onSend={onSend}
          onTyping={onTyping}
          disabled={disabled}
          showToolbar={showFormatting}
          members={mentionCandidates}
          slashCommands={slashCommands}
          onRegisterRef={(ref) => {
            lexicalRef.current = ref;
          }}
        />

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-border bg-surface-raised px-2.5 py-1.5 rounded-b-xl">
          <div className="flex items-center gap-1">
            <Hint label="Attach file or media">
              <button
                type="button"
                onClick={() => document.getElementById(fileInputId)?.click()}
                className="flex size-7 items-center justify-center rounded-full bg-accent text-foreground hover:bg-selected transition-colors"
              >
                <Plus className="size-4" />
              </button>
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

            <span className="mx-1 h-4 w-px bg-accent/50" />

            {/* Typing the trigger is what opens the menu, so these buttons do
                exactly that rather than duplicating the menu themselves. */}
            <Hint label="Mention someone (@)">
              <button
                type="button"
                onClick={() => {
                  lexicalRef.current?.focus();
                  lexicalRef.current?.insertText('@');
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <AtSign className="size-4" />
              </button>
            </Hint>

            <Hint label="Insert emoji">
              <button
                type="button"
                onClick={() =>
                  setPickerState((current) => ({
                    open: !current.open || current.tab !== 'emoji',
                    tab: 'emoji',
                  }))
                }
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  pickerState.open &&
                    pickerState.tab === 'emoji' &&
                    'bg-primary text-primary-foreground',
                )}
              >
                <Smile className="size-4" />
              </button>
            </Hint>

            <Hint label="Open GIF picker">
              <button
                type="button"
                onClick={() =>
                  setPickerState((current) => ({
                    open: !current.open || current.tab !== 'gif',
                    tab: 'gif',
                  }))
                }
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  pickerState.open &&
                    pickerState.tab === 'gif' &&
                    'bg-primary text-primary-foreground',
                )}
              >
                <Film className="size-3.5" />
                <span className="text-[10px] uppercase tracking-wider">GIF</span>
              </button>
            </Hint>

            <Hint label="Slash commands (/)">
              <button
                type="button"
                onClick={() => {
                  lexicalRef.current?.focus();
                  lexicalRef.current?.insertText('/');
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Slash className="size-3.5" />
              </button>
            </Hint>

            {onStartHuddle ? (
              <Hint label="Start voice huddle">
                <button
                  type="button"
                  onClick={onStartHuddle}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Video className="size-4" />
                </button>
              </Hint>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            {onSchedule ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Schedule message"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 bg-surface text-foreground border-border"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Schedule message
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  {['In 30 minutes', 'Tomorrow at 9:00 AM', 'Monday at 9:00 AM'].map(
                    (when) => (
                      <DropdownMenuItem
                        key={when}
                        onSelect={() => {
                          const body = lexicalRef.current?.getMarkdown().trim();
                          if (!body) return;
                          onSchedule(body, when);
                          lexicalRef.current?.clear();
                        }}
                        className="hover:bg-accent focus:bg-accent"
                      >
                        <Clock className="mr-2 size-3.5" />
                        {when}
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <button
              type="button"
              onClick={() => lexicalRef.current?.send()}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:bg-primary-hover active:scale-95 disabled:opacity-50"
            >
              <span>Send</span>
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 px-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">Enter</strong> to send ·{' '}
          <strong className="font-semibold text-foreground">Shift+Enter</strong> for
          a line break · <strong className="font-semibold text-foreground">@</strong>{' '}
          people, <strong className="font-semibold text-foreground">/</strong>{' '}
          commands, <strong className="font-semibold text-foreground">:</strong>{' '}
          emoji · markdown as you type
        </span>
      </div>
    </div>
  );
}
