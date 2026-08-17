import type { RoomMember } from '@org/types';
import {
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
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  DiscordEmojiGifPicker,
} from './discord-emoji-gif-picker.js';
import {
  LexicalComposerInput,
  type LexicalEditorRef,
} from './lexical-composer.js';

export interface SlashCommand {
  name: string;
  args?: string;
  description: string;
}

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

export interface ComposerProps {
  onSend: (body: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList) => void;
  members?: RoomMember[];
  placeholder?: string;
  disabled?: boolean;
  contextSlot?: ReactNode;
  enterToSend?: boolean;
  showFormatting?: boolean;
  slashCommands?: SlashCommand[];
  onSchedule?: (body: string, when: string) => void;
  onStartHuddle?: () => void;
  onRecordClip?: () => void;
}

export function Composer({
  onSend,
  onTyping,
  onAttach,
  members = [],
  placeholder = 'Message channel…',
  disabled = false,
  contextSlot,
  onSchedule,
  onStartHuddle,
}: ComposerProps) {
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    tab: 'emoji' | 'gif';
  }>({ open: false, tab: 'emoji' });

  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const lexicalRef = useRef<LexicalEditorRef | null>(null);
  const fileInputId = useId();

  const handleSelectEmoji = (emoji: string) => {
    lexicalRef.current?.insertText(emoji);
  };

  const handleSelectGif = (gifUrl: string, title?: string) => {
    const markdownGif = `![${title || 'GIF'}](${gifUrl})`;
    void onSend(markdownGif);
  };

  const insertMention = (name: string) => {
    lexicalRef.current?.replaceMentionQuery(name);
    setShowMentionMenu(false);
    setMentionQuery('');
  };

  const specialMentions = [
    { id: 'here', displayName: 'here', subtitle: 'Notify active members in channel' },
    { id: 'channel', displayName: 'channel', subtitle: 'Notify all members in channel' },
  ];

  const filteredSpecialMentions = specialMentions.filter((item) =>
    item.displayName.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  const filteredMembers = members.filter((member) =>
    member.displayName.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  return (
    <div className="relative shrink-0 sticky bottom-0 z-20 p-3 bg-background border-t border-border">
      {contextSlot}

      {/* Mention Autocomplete Overlay Menu */}
      {showMentionMenu ? (
        <div className="absolute bottom-full left-3 z-50 mb-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5 text-primary-text">
              <AtSign className="size-3.5" />
              <span>Mention Member</span>
            </span>
            <button
              onClick={() => setShowMentionMenu(false)}
              className="text-[10px] hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1 scrollbar-subtle">
            {/* Special mentions: @here, @channel */}
            {filteredSpecialMentions.length > 0 ? (
              <>
                <div className="px-2 py-1 text-[10px] font-bold text-subtle uppercase">
                  Group Mentions
                </div>
                {filteredSpecialMentions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => insertMention(item.displayName)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 font-bold text-primary-text">
                      @
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary-text">@{item.displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </>
            ) : null}

            {/* Room Members */}
            {filteredMembers.length > 0 ? (
              <>
                <div className="mt-1.5 px-2 py-1 text-[10px] font-bold text-subtle uppercase">
                  Members — {filteredMembers.length}
                </div>
                {filteredMembers.map((member) => (
                  <button
                    key={member.userId}
                    onClick={() => insertMention(member.displayName)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  >
                    <UserAvatar
                      name={member.displayName}
                      src={member.avatarUrl}
                      seed={member.userId}
                      size="xs"
                    />
                    <span className="font-semibold text-foreground truncate">
                      @{member.displayName}
                    </span>
                  </button>
                ))}
              </>
            ) : filteredSpecialMentions.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                No members found matching &quot;@{mentionQuery}&quot;
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Discord Emoji & GIF Picker Overlay */}
      {pickerState.open ? (
        <DiscordEmojiGifPicker
          defaultTab={pickerState.tab}
          onSelectEmoji={handleSelectEmoji}
          onSelectGif={handleSelectGif}
          onClose={() => setPickerState({ open: false, tab: 'emoji' })}
        />
      ) : null}

      {/* Main Container Box */}
      <div
        className={cn(
          'relative flex flex-col rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        {/* Lexical Input Area */}
        <LexicalComposerInput
          placeholder={placeholder}
          onSend={onSend}
          onTyping={onTyping}
          disabled={disabled}
          onMentionTrigger={(q) => {
            setMentionQuery(q);
            setShowMentionMenu(true);
          }}
          onMentionClose={() => {
            setShowMentionMenu(false);
          }}
          onRegisterRef={(ref) => {
            lexicalRef.current = ref;
          }}
        />

        {/* Action Bar (Bottom Tools) */}
        <div className="flex items-center justify-between border-t border-border bg-surface-raised px-2.5 py-1.5 rounded-b-xl">
          <div className="flex items-center gap-1">
            {/* Attachment Button */}
            <Hint label="Attach file or media">
              <button
                type="button"
                onClick={() => document.getElementById(fileInputId)?.click()}
                className="flex size-7 items-center justify-center rounded-full bg-accent text-foreground hover:bg-selected hover:text-foreground transition-colors"
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

            {/* Mention Trigger Button */}
            <Hint label="Mention Member (@)">
              <button
                type="button"
                onClick={() => {
                  lexicalRef.current?.insertText('@');
                  setMentionQuery('');
                  setShowMentionMenu(true);
                }}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  showMentionMenu && 'bg-primary text-primary-foreground',
                )}
              >
                <AtSign className="size-4" />
              </button>
            </Hint>

            {/* Emoji Picker Button */}
            <Hint label="Insert Emoji">
              <button
                type="button"
                onClick={() =>
                  setPickerState((curr) => ({
                    open: !curr.open || curr.tab !== 'emoji',
                    tab: 'emoji',
                  }))
                }
                className={cn(
                  'flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  pickerState.open && pickerState.tab === 'emoji' && 'bg-primary text-primary-foreground',
                )}
              >
                <Smile className="size-4" />
              </button>
            </Hint>

            {/* GIF Picker Button */}
            <Hint label="Open GIF Picker">
              <button
                type="button"
                onClick={() =>
                  setPickerState((curr) => ({
                    open: !curr.open || curr.tab !== 'gif',
                    tab: 'gif',
                  }))
                }
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  pickerState.open && pickerState.tab === 'gif' && 'bg-primary text-primary-foreground',
                )}
              >
                <Film className="size-3.5" />
                <span className="text-[10px] uppercase tracking-wider">GIF</span>
              </button>
            </Hint>

            {/* Command Trigger Button */}
            <Hint label="Slash commands">
              <button
                type="button"
                onClick={() => {
                  lexicalRef.current?.insertText('/');
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Slash className="size-3.5" />
              </button>
            </Hint>

            {onStartHuddle ? (
              <Hint label="Start Voice Huddle">
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

          {/* Right Action: Send & Schedule */}
          <div className="flex items-center gap-1">
            {onSchedule ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-surface text-foreground border-border">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Schedule message</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  {['In 30 minutes', 'Tomorrow at 9:00 AM', 'Monday at 9:00 AM'].map((when) => (
                    <DropdownMenuItem
                      key={when}
                      onSelect={() => {
                        void onSend(`[Scheduled for ${when}]`);
                      }}
                      className="hover:bg-accent focus:bg-accent"
                    >
                      <Clock className="mr-2 size-3.5" />
                      {when}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <button
              type="button"
              onClick={() => {
                // Submit is handled by Enter in Lexical
              }}
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
          <strong className="font-semibold text-foreground">Shift+Enter</strong> for line break · Powered by Lexical
        </span>
      </div>
    </div>
  );
}
