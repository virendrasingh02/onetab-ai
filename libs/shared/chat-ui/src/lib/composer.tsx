import type { RoomMember, DetectedMention } from '@org/types';

import {
  EmojiGifPickerPopover,
  Hint,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@org/ui';
import {
  isVoiceRecordingSupported,
  useKeyboardInset,
  useSpeechToText,
} from '@org/hooks';
import { cn, formatBytes } from '@org/utils';
import {
  AtSign,
  CalendarClock,
  File as FileIcon,
  Film,
  Lock,
  Mic,
  Plus,
  Send,
  Slash,
  Smile,
  Speech,
  VenetianMask,
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
import {
  LexicalComposerInput,
  type LexicalEditorRef,
  type MentionCandidate,
} from './lexical-composer.js';
import { detectLinks, normalizeUrl } from './link-detector.js';
import { LinkPreviewCard } from './link-preview-card.js';
import { LinkPreviewSkeleton } from './link-preview-skeleton.js';
import { useLinkPreviewStore } from './use-link-preview.js';
import { DEFAULT_SLASH_COMMANDS, type SlashCommand } from './slash-commands.js';
import { VoiceRecorderBar } from './voice-recorder-bar.js';

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
        className="-right-1.5 -top-1.5 size-5 absolute flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/chip:opacity-100 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export interface ComposerProps {
  onSend: (body: string) => void | Promise<void>;
  onSchedule?: (body: string, scheduledFor: string) => void | Promise<void>;
  /** This conversation's still-pending scheduled sends, newest-first, so the
   *  schedule popover can show and cancel them instead of being a one-way trip. */
  pendingScheduled?: { id: string; body: string; scheduledFor: string }[];
  onCancelScheduled?: (id: string) => void;
  targetName?: string;
  workspaceId?: string;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList) => void;
  conversationId?: string | null;
  members?: RoomMember[];
  /**
   * The signed-in user's id. When it matches one of `members`, that entry is
   * tagged "you" and floated to the top of the `@` menu's people list so
   * mentioning yourself is an obvious, first-class option.
   */
  currentUserId?: string;
  agentMentions?: MentionCandidate[];
  appMentions?: MentionCandidate[];
  placeholder?: string;
  disabled?: boolean;
  /**
   * When set, the input is replaced entirely by a read-only notice carrying
   * this message — used for announcement channels where the viewer may not
   * post (brief §3). The Matrix room's power levels are the real gate; this
   * just keeps someone from typing a message that would bounce.
   */
  readOnlyMessage?: ReactNode;
  /**
   * When `allowed`, an "post anonymously" toggle appears in the action row; a
   * message sent with it on routes through `onSendAnonymously` (the server
   * posts it as a shared "Anonymous Participant" identity) instead of `onSend`
   * (brief §2).
   */
  anonymousPosting?: {
    allowed: boolean;
    onSendAnonymously: (text: string) => void | Promise<void>;
  };
  contextSlot?: ReactNode;
  enterToSend?: boolean;
  onMentionsChange?: (mentions: DetectedMention[]) => void;
  /** Off in the thread panel, where the reply box stays out of the way. */
  showFormatting?: boolean;

  slashCommands?: SlashCommand[];
  onStartHuddle?: () => void;
  /**
   * Presence of this prop is what shows the mic button (in addition to the
   * browser actually supporting recording) — the same "no prop, no control"
   * convention `onStartHuddle` already uses.
   */
  onSendVoice?: (
    blob: Blob,
    meta: { durationMs: number; waveform: number[]; mimeType: string },
    onProgress?: (percent: number) => void,
  ) => void | Promise<void>;
  /** When false, disables automatic link preview generation for this composer. Defaults to true. */
  linkPreviewsEnabled?: boolean;
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
  onSchedule,
  pendingScheduled = [],
  onCancelScheduled,
  onTyping,
  onAttach,
  conversationId,
  members = [],
  currentUserId,
  agentMentions,
  appMentions,
  placeholder = 'Message channel…',
  disabled = false,
  readOnlyMessage,
  anonymousPosting,
  contextSlot,
  enterToSend = true,
  onMentionsChange,
  showFormatting = true,
  slashCommands = DEFAULT_SLASH_COMMANDS,

  onStartHuddle,
  onSendVoice,
  linkPreviewsEnabled = true,
  className,
}: ComposerProps) {
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    tab: 'emoji' | 'gif';
  }>({ open: false, tab: 'emoji' });
  /* Collapsed by default, Slack-style — the formatting bar is for people who
     go looking for it, not a permanent fixture above every message. */
  const [toolbarOpen, setToolbarOpen] = useState(false);
  /* Drives the send button's active state. Fed by the editor's cheap
     empty ⇄ non-empty signal (`onEmptyChange`), not a markdown pass per key. */
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

  const [detectedUrls, setDetectedUrls] = useState<string[]>(() =>
    linkPreviewsEnabled && initialDraft
      ? detectLinks(initialDraft).map((l) => l.url)
      : [],
  );
  const [dismissedUrls, setDismissedUrls] = useState<Set<string>>(new Set());

  const fetchPreview = useLinkPreviewStore((s) => s.fetchPreview);
  const previews = useLinkPreviewStore((s) => s.previews);
  const loadingUrls = useLinkPreviewStore((s) => s.loadingUrls);

  useEffect(() => {
    if (linkPreviewsEnabled && initialDraft) {
      const links = detectLinks(initialDraft);
      for (const link of links) {
        void fetchPreview(link.url);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lexicalRef = useRef<LexicalEditorRef | null>(null);
  const fileInputId = useId();

  /*
   * Move the draft when the conversation changes: stash whatever is in the box
   * under the conversation being left (the editor still holds its text at this
   * point), then load the one being opened. Doing the stash here rather than
   * leaning on the debounced `onDraftChange` is what stops a fast switch from
   * dropping the last half-second of typing.
   */
  const prevConversationId = useRef(conversationId);
  useEffect(() => {
    if (prevConversationId.current === conversationId) return;
    const leaving = prevConversationId.current;
    prevConversationId.current = conversationId;

    if (leaving && lexicalRef.current) {
      setDraft(leaving, lexicalRef.current.getMarkdown());
    }
    const draft = conversationId ? getDraft(conversationId) : '';
    lexicalRef.current?.setMarkdown(draft);
    setHasContent(draft.trim().length > 0);
    setDismissedUrls(new Set());
    if (linkPreviewsEnabled) {
      const links = detectLinks(draft);
      setDetectedUrls(links.map((l) => l.url));
      for (const link of links) {
        void fetchPreview(link.url);
      }
    } else {
      setDetectedUrls([]);
    }
  }, [conversationId, getDraft, setDraft, linkPreviewsEnabled, fetchPreview]);

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

  /* Cheap empty ⇄ non-empty flip from the editor — just toggles the Send
     button, no serialisation. */
  const handleEmptyChange = useCallback((isEmpty: boolean) => {
    setHasContent(!isEmpty);
  }, []);

  /* Debounced snapshot of the editor for draft persistence — fires a couple of
     times a second at most, and once more the moment the box is emptied. */
  const handleDraftChange = useCallback(
    (markdown: string) => {
      if (conversationId) setDraft(conversationId, markdown);
      if (linkPreviewsEnabled) {
        const links = detectLinks(markdown);
        setDetectedUrls(links.map((l) => l.url));
        for (const link of links) {
          const norm = link.normalizedUrl || normalizeUrl(link.url);
          if (!dismissedUrls.has(norm)) {
            void fetchPreview(link.url);
          }
        }
      }
    },
    [conversationId, setDraft, linkPreviewsEnabled, dismissedUrls, fetchPreview],
  );

  const handleDismissPreview = useCallback((url: string) => {
    const norm = normalizeUrl(url);
    setDismissedUrls((prev) => new Set(prev).add(norm));
  }, []);

  const stagedUrls = useMemo(() => {
    if (!linkPreviewsEnabled) return [];
    return detectedUrls.filter((url) => !dismissedUrls.has(normalizeUrl(url)));
  }, [linkPreviewsEnabled, detectedUrls, dismissedUrls]);

  /* The editor's own send only fires with text in hand — attachments ride
     along whenever there are any, text or none. */
  /* Anonymous-posting toggle (brief §2). Reset whenever the toggle is no longer
     offered so a stale "on" can't leak a message to the wrong path. */
  const [anon, setAnon] = useState(false);
  const anonAllowed = anonymousPosting?.allowed ?? false;
  useEffect(() => {
    if (!anonAllowed && anon) setAnon(false);
  }, [anonAllowed, anon]);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customDatetime, setCustomDatetime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });

  const schedulePresets = useMemo(() => {
    const now = new Date();
    const in30m = new Date(now.getTime() + 30 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    const tomorrow9am = new Date(now);
    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    tomorrow9am.setHours(9, 0, 0, 0);

    const tomorrow1pm = new Date(now);
    tomorrow1pm.setDate(tomorrow1pm.getDate() + 1);
    tomorrow1pm.setHours(13, 0, 0, 0);

    const nextMonday = new Date(now);
    const day = nextMonday.getDay();
    const daysUntilMon = ((1 + 7 - day) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMon);
    nextMonday.setHours(9, 0, 0, 0);

    return [
      { label: 'In 30 minutes', time: in30m },
      { label: 'In 1 hour', time: in1h },
      { label: 'Tomorrow at 9:00 AM', time: tomorrow9am },
      { label: 'Tomorrow at 1:00 PM', time: tomorrow1pm },
      { label: 'Next Monday at 9:00 AM', time: nextMonday },
    ];
  }, [scheduleOpen]);

  const handleSchedule = useCallback(
    async (scheduledForIso: string) => {
      const content = lexicalRef.current?.getMarkdown().trim();
      if (!content) {
        toast.error('Please enter a message to schedule.');
        return;
      }
      if (!onSchedule) return;

      try {
        await onSchedule(content, scheduledForIso);
      } catch {
        // The caller's mutation already surfaces its own error toast.
        return;
      }

      lexicalRef.current?.clear();
      if (conversationId) clearDraft(conversationId);
      setHasContent(false);
      flushAttachments();
      setScheduleOpen(false);

      const formatted = new Date(scheduledForIso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      toast.success(`Message scheduled for ${formatted}`);
    },
    [conversationId, onSchedule, clearDraft, flushAttachments],
  );

  const handleComposerSend = useCallback(
    (body: string) => {
      setHasContent(false);
      flushAttachments();
      setDismissedUrls(new Set());
      setDetectedUrls([]);
      if (conversationId) {
        clearDraft(conversationId);
      }
      if (!body) return;
      if (anon && anonymousPosting?.allowed) {
        return anonymousPosting.onSendAnonymously(body);
      }
      return onSend(body);
    },
    [flushAttachments, onSend, conversationId, clearDraft, anon, anonymousPosting],
  );

  const canSend = hasContent || attachments.length > 0;

  /* --- speech-to-text (dictate into the text box; never auto-sent) -------- */
  const speech = useSpeechToText();
  const dictatedLengthRef = useRef(0);

  // Each newly *confirmed* chunk of speech lands in the editor once; interim
  // (not-yet-final) text is deliberately not inserted — there is no API here
  // to edit an already-inserted range, so showing it live would mean typing
  // it twice.
  useEffect(() => {
    if (!speech.listening) return;
    const delta = speech.finalText.slice(dictatedLengthRef.current);
    if (delta) {
      lexicalRef.current?.insertText(delta);
      dictatedLengthRef.current = speech.finalText.length;
    }
  }, [speech.finalText, speech.listening]);

  /* --- voice messages ------------------------------------------------------
   * Recording takes over the whole input row (see the render below), which is
   * what gives the "no conflicting state" rule for free — the attach/emoji/
   * slash/huddle controls simply aren't on screen while it's active. The one
   * thing that needs an explicit guard is *starting* a recording (or
   * dictation) with attachments already staged, since those would otherwise
   * silently vanish under the recorder bar.
   */
  const voiceSupported = useMemo(() => isVoiceRecordingSupported(), []);
  const [recordingActive, setRecordingActive] = useState(false);
  const canStartVoiceAction = !disabled && attachments.length === 0;

  const startRecording = useCallback(() => {
    if (!canStartVoiceAction) return;
    if (speech.listening) speech.stop();
    setRecordingActive(true);
  }, [canStartVoiceAction, speech]);

  const toggleDictate = useCallback(() => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    if (!canStartVoiceAction) return;
    speech.reset();
    dictatedLengthRef.current = 0;
    lexicalRef.current?.focus();
    speech.start();
  }, [speech, canStartVoiceAction]);

  /*
   * Keep the box above the on-screen keyboard. On engines that honour
   * `interactive-widget=resizes-content` the layout viewport already shrinks and
   * this stays 0; on iOS Safari it does not, so we pad the sticky footer by the
   * covered height instead. `env(safe-area-inset-bottom)` covers the resting
   * (home-indicator) case — it collapses to 0 while the keyboard is up.
   */
  const keyboard = useKeyboardInset();
  const composerPadBottom = keyboard.isOpen
    ? `${keyboard.height}px`
    : 'max(1rem, env(safe-area-inset-bottom))';

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const people: MentionCandidate[] = members.map((member) => ({
      id: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
      kind: 'user' as const,
      isSelf: !!currentUserId && member.userId === currentUserId,
    }));
    // "You" leads the roster — mentioning yourself (a note, a task you're
    // claiming) shouldn't mean scrolling the whole member list to find it.
    people.sort((a, b) => Number(b.isSelf ?? false) - Number(a.isSelf ?? false));

    return [
      ...GROUP_MENTIONS,
      ...people,
      ...(agentMentions ?? DEFAULT_AI_AGENT_MENTIONS),
      ...(appMentions ?? DEFAULT_APP_MENTIONS),
    ];
  }, [members, currentUserId, agentMentions, appMentions]);

  const handleSelectGif = (gif: { url: string; title: string }) => {
    void onSend(`![${gif.title || 'GIF'}](${gif.url})`);
    setPickerState({ open: false, tab: 'emoji' });
  };

  if (readOnlyMessage) {
    return (
      <div
        className={cn(
          'bottom-0 px-3 pt-3 sm:px-4 sm:pt-4 sticky z-20 shrink-0 bg-background',
          className,
        )}
        style={{ paddingBottom: composerPadBottom }}
      >
        {contextSlot}
        <div className="gap-2.5 px-4 py-3 flex items-center rounded-xl border border-border bg-surface-muted text-xs text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          <span>{readOnlyMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bottom-0 px-3 pt-3 sm:px-4 sm:pt-4 sticky z-20 shrink-0 bg-background',
        className,
      )}
      style={{ paddingBottom: composerPadBottom }}
    >
      {contextSlot}

      {anon && anonAllowed ? (
        <div className="gap-1.5 mb-1.5 px-2.5 py-1 text-[11px] flex items-center rounded-md bg-primary/10 text-primary-text">
          <VenetianMask className="size-3" />
          This message will be posted as “Anonymous Participant”.
        </div>
      ) : null}

      {recordingActive && onSendVoice ? (
        <VoiceRecorderBar
          onCancel={() => setRecordingActive(false)}
          onSent={() => setRecordingActive(false)}
          onSend={onSendVoice}
        />
      ) : (
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
          enterToSend={enterToSend}
          onTyping={onTyping}
          onEmptyChange={handleEmptyChange}
          onDraftChange={handleDraftChange}
          onMentionsChange={onMentionsChange}
          disabled={disabled}
          showToolbar={showFormatting && toolbarOpen}

          hasPendingAttachments={attachments.length > 0}
          members={mentionCandidates}
          slashCommands={slashCommands}
          onRegisterRef={(ref) => {
            lexicalRef.current = ref;
          }}
        />

        {/* Staged Link Previews */}
        {stagedUrls.length > 0 ? (
          <div className="px-3 pb-2 pt-0.5 space-y-2">
            {stagedUrls.map((url) => {
              const norm = normalizeUrl(url);
              const preview = previews[norm];
              const isLoading = loadingUrls[norm];
              if (isLoading && !preview) {
                return (
                  <div key={url} className="relative">
                    <LinkPreviewSkeleton compact />
                    <button
                      type="button"
                      onClick={() => handleDismissPreview(url)}
                      className="absolute right-1.5 top-1.5 size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      aria-label="Remove link preview"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              }
              if (!preview || preview.status === 'error') {
                return null;
              }
              return (
                <LinkPreviewCard
                  key={url}
                  preview={preview}
                  compact
                  onRemove={() => handleDismissPreview(url)}
                />
              );
            })}
          </div>
        ) : null}

        {/* Action bar. On phones the secondary buttons (formatting, @, /, GIF,
            huddle) are hidden — `@` and `/` still open their menus when typed,
            GIF lives in the emoji picker's second tab — leaving a row of full
            44px targets that fits a 320px screen. The left cluster scrolls
            horizontally as a backstop rather than wrapping or clipping. */}
        <div className="px-2.5 py-1.5 flex items-center justify-between rounded-b-xl border-t border-border bg-surface-raised">
          <div className="gap-1 flex min-w-0 flex-1 items-center overflow-x-auto no-scrollbar">
            <Hint label="Attach file or media">
              <button
                type="button"
                aria-label="Attach file or media"
                onClick={() => document.getElementById(fileInputId)?.click()}
                className="size-7 shrink-0 touch-target flex items-center justify-center rounded-full bg-accent text-foreground transition-colors hover:bg-selected"
              >
                <Plus className="size-4" aria-hidden="true" />
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
                    'max-sm:hidden h-7 min-w-7 px-1.5 text-xs font-bold flex items-center justify-center rounded-md transition-colors',
                    toolbarOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  Aa
                </button>
              </Hint>
            ) : null}

            <span className="max-sm:hidden mx-1 h-4 w-px bg-accent/50" />

            {/* Typing the trigger is what opens the menu, so these buttons do
                exactly that rather than duplicating the menu themselves. Hidden
                on phones — typing `@` / `/` still opens the menu. */}
            <Hint label="Mention someone (@)">
              <button
                type="button"
                aria-label="Mention someone (@)"
                onClick={() => {
                  lexicalRef.current?.focus();
                  lexicalRef.current?.insertText('@');
                }}
                className="max-sm:hidden size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <AtSign className="size-4" aria-hidden="true" />
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
                  'size-7 shrink-0 touch-target flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  pickerState.open && 'bg-primary text-primary-foreground',
                )}
              >
                <Smile className="size-4" aria-hidden="true" />
              </button>
            </EmojiGifPickerPopover>

            {/* Mic and dictate stay visible at every breakpoint (unlike the
                secondary buttons above/below) — the brief calls for the mic
                to stay reachable on phones specifically. */}
            {voiceSupported && onSendVoice ? (
              <Hint label="Record a voice message">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!canStartVoiceAction}
                  aria-label="Record voice message"
                  className="size-7 shrink-0 touch-target flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <Mic className="size-4" aria-hidden="true" />
                </button>
              </Hint>
            ) : null}

            <Hint label="Open GIF picker">
              <button
                type="button"
                aria-label="Open GIF picker"
                onClick={() =>
                  setPickerState((current) => ({
                    open: !current.open || current.tab !== 'gif',
                    tab: 'gif',
                  }))
                }
                className={cn(
                  'max-sm:hidden gap-1 px-1.5 py-1 text-xs font-bold flex items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  pickerState.open &&
                    pickerState.tab === 'gif' &&
                    'bg-primary text-primary-foreground',
                )}
              >
                <Film className="size-3.5" aria-hidden="true" />
                <span className="tracking-wider text-[10px] uppercase">
                  GIF
                </span>
              </button>
            </Hint>

            <Hint label="Slash commands (/)">
              <button
                type="button"
                aria-label="Slash commands (/)"
                onClick={() => {
                  lexicalRef.current?.focus();
                  lexicalRef.current?.insertText('/');
                }}
                className="max-sm:hidden size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Slash className="size-3.5" aria-hidden="true" />
              </button>
            </Hint>

            {onStartHuddle ? (
              <Hint label="Start voice huddle">
                <button
                  type="button"
                  aria-label="Start voice huddle"
                  onClick={onStartHuddle}
                  className="max-sm:hidden size-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Video className="size-4" aria-hidden="true" />
                </button>
              </Hint>
            ) : null}
          </div>

          <div className="gap-1 flex shrink-0 items-center">
            {anonAllowed ? (
              <Hint
                label={
                  anon
                    ? 'Posting anonymously — click to post as yourself'
                    : 'Post anonymously'
                }
              >
                <button
                  type="button"
                  aria-pressed={anon}
                  aria-label="Toggle anonymous posting"
                  onClick={() => setAnon((v) => !v)}
                  className={cn(
                    'size-7 touch-target flex items-center justify-center rounded-md transition-colors',
                    anon
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <VenetianMask className="size-3.5" />
                </button>
              </Hint>
            ) : null}

            {/* Dictate moved to right side */}
            {speech.supported ? (
              <Hint
                label={speech.listening ? 'Stop dictating' : 'Dictate (speech to text)'}
              >
                <button
                  type="button"
                  onClick={toggleDictate}
                  disabled={!speech.listening && !canStartVoiceAction}
                  aria-label={speech.listening ? 'Stop dictating' : 'Dictate speech to text'}
                  aria-pressed={speech.listening}
                  className={cn(
                    'size-7 shrink-0 touch-target flex items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40',
                    speech.listening
                      ? 'bg-primary text-primary-foreground motion-safe:animate-pulse'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Speech className="size-4" />
                </button>
              </Hint>
            ) : null}

            {/* Schedule message button & popover — same "no prop, no control"
                convention as onStartHuddle/onSendVoice below. */}
            {onSchedule ? (
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <div>
                  <Hint label="Schedule message">
                    <button
                      type="button"
                      aria-label="Schedule message"
                      disabled={disabled}
                      className={cn(
                        'size-7 shrink-0 touch-target flex items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40',
                        scheduleOpen
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <CalendarClock className="size-4" />
                    </button>
                  </Hint>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-72 p-3 space-y-3 bg-popover text-popover-foreground border border-border shadow-md rounded-lg z-50"
              >
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 pb-1 border-b border-border">
                  <CalendarClock className="size-3.5 text-primary" />
                  <span>Schedule message</span>
                </div>

                {pendingScheduled.length > 0 ? (
                  <div className="space-y-1 pb-2 border-b border-border">
                    <div className="text-[11px] font-medium text-muted-foreground mb-1">
                      Pending in this conversation
                    </div>
                    {pendingScheduled.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-2 px-2 py-1.5 rounded bg-accent/40 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-foreground">{item.body}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(item.scheduledFor).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        {onCancelScheduled ? (
                          <button
                            type="button"
                            onClick={() => onCancelScheduled(item.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="Cancel scheduled message"
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground mb-1">
                    Quick options
                  </div>
                  {schedulePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => void handleSchedule(preset.time.toISOString())}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-xs flex justify-between items-center text-foreground transition-colors"
                    >
                      <span>{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {preset.time.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-[11px] font-medium text-muted-foreground block">
                    Custom date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={customDatetime}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setCustomDatetime(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    disabled={!customDatetime}
                    onClick={() => {
                      if (!customDatetime) return;
                      const targetDate = new Date(customDatetime);
                      if (
                        isNaN(targetDate.getTime()) ||
                        targetDate.getTime() <= Date.now()
                      ) {
                        toast.error('Please select a future date and time');
                        return;
                      }
                      void handleSchedule(targetDate.toISOString());
                    }}
                    className="w-full py-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium rounded transition-colors"
                  >
                    Schedule Send
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            ) : null}

            <Hint label="Send message">
              <button
                type="button"
                onClick={() => lexicalRef.current?.send()}
                disabled={disabled || !canSend}
                aria-label="Send message"
                className={cn(
                  'size-7 shrink-0 touch-target flex items-center justify-center rounded-full transition-colors',
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
      )}

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
    </div>
  );
}
