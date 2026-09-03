import type { RoomMember } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmojiGifPickerPopover,
  Hint,
} from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  AtSign,
  ChevronDown,
  Clock,
  File as FileIcon,
  Film,
  LayoutGrid,
  Plus,
  Send,
  Slash,
  Smile,
  Video,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDraftsStore } from './drafts-store.js';
import { SendCardDialog } from './cards/send-card-dialog.js';
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

const DEFAULT_AI_AGENT_MENTIONS: MentionCandidate[] = [
  {
    id: 'agent-copilot',
    name: 'copilot',
    subtitle: 'OneTab Copilot — Channel AI Assistant & Q&A',
    kind: 'agent',
    badge: 'AI AGENT',
  },
  {
    id: 'agent-codereview',
    name: 'codereview',
    subtitle: 'Code Reviewer AI — Automated PR & diff inspection',
    kind: 'agent',
    badge: 'AI AGENT',
  },
  {
    id: 'agent-triage',
    name: 'triage',
    subtitle: 'Incident & Bug Triage — SRE error responder',
    kind: 'agent',
    badge: 'AI AGENT',
  },
  {
    id: 'agent-standup',
    name: 'standup',
    subtitle: 'Daily Standup Bot — Async recaps & blocker tracking',
    kind: 'agent',
    badge: 'AI AGENT',
  },
  {
    id: 'agent-docs',
    name: 'docs',
    subtitle: 'Docs & Knowledge AI — Markdown & wiki synthesizer',
    kind: 'agent',
    badge: 'AI AGENT',
  },
  {
    id: 'agent-data',
    name: 'data',
    subtitle: 'SQL & Data Analyst — Metric queries & visualizations',
    kind: 'agent',
    badge: 'AI AGENT',
  },
];

const DEFAULT_APP_MENTIONS: MentionCandidate[] = [
  {
    id: 'app-github',
    name: 'github-app',
    subtitle: 'GitHub — Pull requests, reviews & CI workflows',
    kind: 'app',
    badge: 'APP',
  },
  {
    id: 'app-linear',
    name: 'linear-bot',
    subtitle: 'Linear — Issue tracker & cycle progress',
    kind: 'app',
    badge: 'APP',
  },
  {
    id: 'app-sentry',
    name: 'sentry-bot',
    subtitle: 'Sentry — Realtime uncaught exception alerts',
    kind: 'app',
    badge: 'APP',
  },
  {
    id: 'app-jira',
    name: 'jira-bot',
    subtitle: 'Jira Software — Sprint backlog & status updates',
    kind: 'app',
    badge: 'APP',
  },
  {
    id: 'app-figma',
    name: 'figma-bot',
    subtitle: 'Figma — Design updates & frame comments',
    kind: 'app',
    badge: 'APP',
  },
  {
    id: 'app-gdrive',
    name: 'gdrive-bot',
    subtitle: 'Google Drive — Document attachments & sync',
    kind: 'app',
    badge: 'APP',
  },
];

/** An upload staged in the composer, not sent yet. */
interface StagedAttachment {
  id: string;
  file: File;
  /** Object URL for an image file; unset for anything else. */
  previewUrl?: string;
}

function toStagedAttachments(files: Iterable<File>): StagedAttachment[] {
  return Array.from(files, (file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    file,
    previewUrl: file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : undefined,
  }));
}

/**
 * One staged upload, before it has gone anywhere.
 *
 * An image gets an actual thumbnail — the point of a preview is seeing what
 * you're about to post, not trusting the filename. Everything else gets an
 * icon-and-name chip the same size, so the strip lines up either way.
 */
function StagedAttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: StagedAttachment;
  onRemove: () => void;
}) {
  const { file, previewUrl } = attachment;
  const caption = `${file.name} · ${formatBytes(file.size)}`;

  return (
    <div className="group/chip relative shrink-0">
      {previewUrl ? (
        <Hint label={caption}>
          <div className="size-16 overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={previewUrl}
              alt={file.name}
              className="size-full object-cover"
            />
          </div>
        </Hint>
      ) : (
        <div className="h-16 w-44 gap-2 px-2.5 flex items-center rounded-lg border border-border bg-surface-raised">
          <span className="size-8 flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-medium block truncate text-foreground">
              {file.name}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {formatBytes(file.size)}
            </span>
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="-right-1.5 -top-1.5 size-5 absolute flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/chip:opacity-100 hover:text-destructive focus-visible:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export interface ComposerProps {
  onSend: (body: string) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList) => void;
  conversationId?: string | null;
  members?: RoomMember[];
  agentMentions?: MentionCandidate[];
  appMentions?: MentionCandidate[];
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
  onSendCard?: (
    cardId: string,
    version: number,
    data: Record<string, unknown>,
  ) => void | Promise<void>;
  className?: string;
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
  conversationId,
  members = [],
  agentMentions,
  appMentions,
  placeholder = 'Message channel…',
  disabled = false,
  contextSlot,
  showFormatting = true,
  slashCommands = DEFAULT_SLASH_COMMANDS,
  onSchedule,
  onStartHuddle,
  onSendCard,
  className,
}: ComposerProps) {
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    tab: 'emoji' | 'gif';
  }>({ open: false, tab: 'emoji' });
  const [sendCardOpen, setSendCardOpen] = useState(false);
  /* Collapsed by default, Slack-style — the formatting bar is for people who
     go looking for it, not a permanent fixture above every message. */
  const [toolbarOpen, setToolbarOpen] = useState(false);
  /* Drives the send button's active state. Read from the editor rather than
     trusted from `isTyping`, which the editor reports as `true` on every
     change including the one that empties it. */
  const [hasContent, setHasContent] = useState(false);
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const getDraft = useDraftsStore((s) => s.getDraft);
  const setDraft = useDraftsStore((s) => s.setDraft);
  const clearDraft = useDraftsStore((s) => s.clearDraft);

  const initialDraft = useMemo(
    () => (conversationId ? getDraft(conversationId) : ''),
    [conversationId, getDraft],
  );

  const lexicalRef = useRef<LexicalEditorRef | null>(null);
  const fileInputId = useId();

  // Sync draft when conversationId changes
  const prevConversationId = useRef(conversationId);
  useEffect(() => {
    if (prevConversationId.current !== conversationId) {
      prevConversationId.current = conversationId;
      const draft = conversationId ? getDraft(conversationId) : '';
      if (lexicalRef.current) {
        lexicalRef.current.setMarkdown(draft);
        setHasContent(draft.trim().length > 0);
      }
    }
  }, [conversationId, getDraft]);

  // Object URLs are only good for as long as the tab is open — revoke each
  // one when its chip goes away, and sweep whatever's left on unmount so a
  // conversation switch mid-upload doesn't leak them.
  const attachmentsRef = useRef<StagedAttachment[]>(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, []);

  const stageFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files || files.length === 0) return;
      setAttachments((current) => [...current, ...toStagedAttachments(files)]);
    },
    [],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  }, []);

  /** Hands the staged files to the host and clears the strip. Sending itself
   *  is fire-and-forget from here — upload progress belongs on the message
   *  it becomes, not on a preview that no longer exists. */
  const flushAttachments = useCallback(() => {
    if (attachments.length === 0) return;
    if (onAttach) {
      const dataTransfer = new DataTransfer();
      for (const attachment of attachments)
        dataTransfer.items.add(attachment.file);
      void onAttach(dataTransfer.files);
    }
    for (const attachment of attachments) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachments([]);
  }, [attachments, onAttach]);

  const handleTyping = (isTyping: boolean) => {
    onTyping?.(isTyping);
    const content = lexicalRef.current?.getMarkdown() ?? '';
    const notEmpty = content.trim().length > 0;
    setHasContent(notEmpty);
    if (conversationId) {
      setDraft(conversationId, content);
    }
  };

  /* The editor's own send only fires with text in hand — attachments ride
     along whenever there are any, text or none. */
  const handleComposerSend = useCallback(
    (body: string) => {
      flushAttachments();
      if (conversationId) {
        clearDraft(conversationId);
      }
      if (body) return onSend(body);
    },
    [flushAttachments, onSend, conversationId, clearDraft],
  );

  const canSend = hasContent || attachments.length > 0;

  const mentionCandidates = useMemo<MentionCandidate[]>(
    () => [
      ...GROUP_MENTIONS,
      ...(agentMentions ?? DEFAULT_AI_AGENT_MENTIONS),
      ...(appMentions ?? DEFAULT_APP_MENTIONS),
      ...members.map((member) => ({
        id: member.userId,
        name: member.displayName,
        avatarUrl: member.avatarUrl,
        kind: 'user' as const,
      })),
    ],
    [members, agentMentions, appMentions],
  );

  const handleSelectGif = (gif: { url: string; title: string }) => {
    void onSend(`![${gif.title || 'GIF'}](${gif.url})`);
    setPickerState({ open: false, tab: 'emoji' });
  };

  return (
    <div
      className={cn(
        'bottom-0 p-3 sm:p-4 sticky z-20 shrink-0 bg-background',
        className,
      )}
    >
      {contextSlot}

      <div
        className={cn(
          'relative flex flex-col rounded-xl border border-border bg-surface transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
          isDraggingOver && 'border-primary ring-2 ring-primary/40',
          disabled && 'pointer-events-none opacity-60',
        )}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          setIsDraggingOver(false);
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          stageFiles(event.dataTransfer.files);
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length > 0) stageFiles(files);
        }}
      >
        {isDraggingOver ? (
          <div className="inset-0 text-xs font-semibold pointer-events-none absolute z-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary-text">
            Drop to attach
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="gap-2 px-3 py-2.5 flex scrollbar-none items-start overflow-x-auto border-b border-border">
            {attachments.map((attachment) => (
              <StagedAttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={() => removeAttachment(attachment.id)}
              />
            ))}
          </div>
        ) : null}

        <LexicalComposerInput
          placeholder={placeholder}
          initialMarkdown={initialDraft}
          onSend={handleComposerSend}
          onTyping={handleTyping}
          disabled={disabled}
          showToolbar={showFormatting && toolbarOpen}
          hasPendingAttachments={attachments.length > 0}
          members={mentionCandidates}
          slashCommands={slashCommands}
          onRegisterRef={(ref) => {
            lexicalRef.current = ref;
          }}
        />

        {/* Action bar */}
        <div className="px-2.5 py-1.5 flex items-center justify-between rounded-b-xl border-t border-border bg-surface-raised">
          <div className="gap-1 flex items-center">
            <Hint label="Attach file or media">
              <button
                type="button"
                onClick={() => document.getElementById(fileInputId)?.click()}
                className="size-7 flex items-center justify-center rounded-full bg-accent text-foreground transition-colors hover:bg-selected"
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
                stageFiles(event.target.files);
                event.target.value = '';
              }}
            />

            {showFormatting ? (
              <Hint label={toolbarOpen ? 'Hide formatting' : 'Formatting'}>
                <button
                  type="button"
                  aria-pressed={toolbarOpen}
                  aria-label="Toggle formatting bar"
                  onClick={() => setToolbarOpen((open) => !open)}
                  className={cn(
                    'h-7 min-w-7 px-1.5 text-xs font-bold flex items-center justify-center rounded-md transition-colors',
                    toolbarOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  Aa
                </button>
              </Hint>
            ) : null}

            <Hint label="Send Universal Card">
              <button
                type="button"
                onClick={() => setSendCardOpen(true)}
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LayoutGrid className="size-4 text-primary" />
              </button>
            </Hint>

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
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <AtSign className="size-4" />
              </button>
            </Hint>

            <EmojiGifPickerPopover
              open={pickerState.open}
              onOpenChange={(open) =>
                setPickerState((current) => ({ ...current, open }))
              }
              tab={pickerState.tab}
              onTabChange={(tab) =>
                setPickerState((current) => ({ ...current, tab }))
              }
              side="top"
              align="start"
              onEmojiSelect={(emoji) => lexicalRef.current?.insertText(emoji.emoji)}
              onGifSelect={handleSelectGif}
            >
              <button
                type="button"
                title="Emoji & GIFs"
                aria-label="Insert emoji or GIF"
                className={cn(
                  'size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  pickerState.open && 'bg-primary text-primary-foreground',
                )}
              >
                <Smile className="size-4" />
              </button>
            </EmojiGifPickerPopover>

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
                  'gap-1 px-1.5 py-1 text-xs font-bold flex items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  pickerState.open &&
                    pickerState.tab === 'gif' &&
                    'bg-primary text-primary-foreground',
                )}
              >
                <Film className="size-3.5" />
                <span className="tracking-wider text-[10px] uppercase">
                  GIF
                </span>
              </button>
            </Hint>

            <Hint label="Slash commands (/)">
              <button
                type="button"
                onClick={() => {
                  lexicalRef.current?.focus();
                  lexicalRef.current?.insertText('/');
                }}
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Slash className="size-3.5" />
              </button>
            </Hint>

            {onStartHuddle ? (
              <Hint label="Start voice huddle">
                <button
                  type="button"
                  onClick={onStartHuddle}
                  className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Video className="size-4" />
                </button>
              </Hint>
            ) : null}
          </div>

          <div className="gap-1 flex items-center">
            {onSchedule ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Schedule message"
                    className="size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-border bg-surface text-foreground"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Schedule message
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  {[
                    'In 30 minutes',
                    'Tomorrow at 9:00 AM',
                    'Monday at 9:00 AM',
                  ].map((when) => (
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
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Hint label="Send message">
              <button
                type="button"
                onClick={() => lexicalRef.current?.send()}
                disabled={disabled || !canSend}
                aria-label="Send message"
                className={cn(
                  'size-7 flex items-center justify-center rounded-full transition-colors',
                  canSend && !disabled
                    ? 'bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95'
                    : 'bg-transparent text-muted-foreground/40',
                )}
              >
                <Send className="size-3.5" />
              </button>
            </Hint>
          </div>
        </div>
      </div>

      {/* <div className="mt-1 px-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">Enter</strong> to send ·{' '}
          <strong className="font-semibold text-foreground">Shift+Enter</strong> for
          a line break · <strong className="font-semibold text-foreground">@</strong>{' '}
          people, <strong className="font-semibold text-foreground">/</strong>{' '}
          commands, <strong className="font-semibold text-foreground">:</strong>{' '}
          emoji · markdown as you type
        </span>
      </div> */}

      <SendCardDialog
        open={sendCardOpen}
        onOpenChange={setSendCardOpen}
        onSendCard={async (cardId, version, data) => {
          if (onSendCard) {
            await onSendCard(cardId, version, data);
          } else {
            // Text fallback if onSendCard not directly attached
            await onSend(`Sent card: ${cardId} (v${version})`);
          }
        }}
      />
    </div>
  );
}
