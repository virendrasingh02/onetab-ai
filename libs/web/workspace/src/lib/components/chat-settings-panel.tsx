import { DEFAULT_USER_PREFERENCES, useChatPreferences } from '@org/common';
import type {
  ChatContentWidth,
  MessageDensity,
  OpenChatPosition,
} from '@org/types';
import { Badge, Button, SettingsRow, Switch } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  AlignJustify,
  ArrowDown,
  AtSign,
  AlignCenterHorizontal,
  BookmarkCheck,
  CheckCircle2,
  CornerDownLeft,
  Eye,
  Link2,
  MessageSquare,
  MoveHorizontal,
  RotateCcw,
  Shrink,
  Sparkles,
} from 'lucide-react';

const CONTENT_WIDTH_OPTIONS: {
  value: ChatContentWidth;
  label: string;
  description: string;
  icon: typeof Shrink;
  /** Share of the miniature preview the column takes up. */
  previewWidth: string;
}[] = [
  {
    value: 'narrow',
    label: 'Narrow',
    description: 'A focused, centered column. Easiest to read on wide screens.',
    icon: Shrink,
    previewWidth: 'w-1/2',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced margins with room for long messages and tables.',
    icon: AlignCenterHorizontal,
    previewWidth: 'w-3/4',
  },
  {
    value: 'full',
    label: 'Full width',
    description: 'Messages and composer stretch edge to edge.',
    icon: MoveHorizontal,
    previewWidth: 'w-full',
  },
];

export function ChatSettingsPanel() {
  const { chat, updateChatPreferences } = useChatPreferences();

  // Only the chat half — a full `resetPreferences()` would also wipe the
  // user's notification display + sound settings from an unrelated page.
  const resetChatDefaults = () =>
    updateChatPreferences(DEFAULT_USER_PREFERENCES.chat);

  const handleDensityChange = (density: MessageDensity) => {
    updateChatPreferences({ messageDensity: density });
  };

  const handleContentWidthChange = (width: ChatContentWidth) => {
    updateChatPreferences({ contentWidth: width });
  };
  const contentWidth = chat.contentWidth ?? 'full';

  const handleOpenPositionChange = (position: OpenChatPosition) => {
    updateChatPreferences({ openPosition: position });
  };

  const handleReadReceiptsToggle = (enabled: boolean) => {
    updateChatPreferences({ readReceipts: enabled });
  };

  const handleEnterToSendToggle = (enabled: boolean) => {
    updateChatPreferences({ enterToSend: enabled });
  };

  const handleSendTypingNoticeToggle = (enabled: boolean) => {
    updateChatPreferences({ sendTypingNotice: enabled });
  };

  const handleShowTypingIndicatorsToggle = (enabled: boolean) => {
    updateChatPreferences({ showTypingIndicators: enabled });
  };

  const handleMentionWarningsToggle = (enabled: boolean) => {
    updateChatPreferences({ mentionWarningsEnabled: enabled });
  };

  const handleLinkPreviewsToggle = (enabled: boolean) => {
    updateChatPreferences({ linkPreviewsEnabled: enabled });
  };

  const handleAllowDirectMessagesFromChange = (
    value: 'everyone' | 'members' | 'admins',
  ) => {
    updateChatPreferences({ allowDirectMessagesFrom: value });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <div className="gap-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight gap-2 flex items-center text-foreground">
              <MessageSquare className="size-5 text-primary" />
              <span>Chat & Messaging</span>
            </h1>
            <p className="text-xs mt-1 text-muted-foreground">
              Customize message density, chat width, timeline scroll behavior,
              and read receipts across conversations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetChatDefaults}
            className="h-8 text-xs gap-1.5 shrink-0"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Defaults</span>
          </Button>
        </div>
      </div>

      {/* 1. Message Density */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
            Message Density
          </h3>
          <p className="text-xs mt-0.5 px-1 text-muted-foreground">
            Choose how compactly messages and avatars are spaced in the
            timeline.
          </p>
        </div>

        <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
          {/* Comfy Option Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleDensityChange('comfy')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleDensityChange('comfy');
              }
            }}
            className={cn(
              'p-4 gap-3 relative flex cursor-pointer flex-col justify-between rounded-xl border text-left transition-all select-none',
              chat.messageDensity === 'comfy'
                ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
            )}
          >
            <div className="gap-2 flex items-start justify-between">
              <div className="gap-2.5 flex items-center">
                <div
                  className={cn(
                    'size-8 flex shrink-0 items-center justify-center rounded-xl',
                    chat.messageDensity === 'comfy'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-muted text-muted-foreground',
                  )}
                >
                  <AlignJustify className="size-4" />
                </div>
                <div>
                  <div className="gap-2 flex items-center">
                    <span className="text-sm font-semibold text-foreground">
                      Comfy
                    </span>
                    <Badge
                      variant="neutral"
                      className="py-0 px-1.5 text-[10px]"
                    >
                      Default
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Generous spacing with full 40px avatars and relaxed padding.
                  </p>
                </div>
              </div>
              {chat.messageDensity === 'comfy' && (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              )}
            </div>

            {/* Visual Comfy Preview Miniature */}
            <div className="p-3 space-y-2 rounded-xl border border-border/60 bg-surface/60">
              <div className="gap-2.5 flex items-center">
                <div className="size-6 shrink-0 rounded-full bg-primary/20" />
                <div className="space-y-1 flex-1">
                  <div className="h-2 w-20 rounded bg-muted-foreground/30" />
                  <div className="h-1.5 w-36 rounded bg-muted-foreground/20" />
                </div>
              </div>
              <div className="gap-2.5 pl-8 flex items-center">
                <div className="h-1.5 w-28 rounded bg-muted-foreground/20" />
              </div>
            </div>
          </div>

          {/* Compact Option Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleDensityChange('compact')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleDensityChange('compact');
              }
            }}
            className={cn(
              'p-4 gap-3 relative flex cursor-pointer flex-col justify-between rounded-xl border text-left transition-all select-none',
              chat.messageDensity === 'compact'
                ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
            )}
          >
            <div className="gap-2 flex items-start justify-between">
              <div className="gap-2.5 flex items-center">
                <div
                  className={cn(
                    'size-8 flex shrink-0 items-center justify-center rounded-xl',
                    chat.messageDensity === 'compact'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-muted text-muted-foreground',
                  )}
                >
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">
                    Compact
                  </span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Tight 32px avatars and minimal padding to see more messages.
                  </p>
                </div>
              </div>
              {chat.messageDensity === 'compact' && (
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
              )}
            </div>

            {/* Visual Compact Preview Miniature */}
            <div className="p-2.5 space-y-1 rounded-xl border border-border/60 bg-surface/60">
              <div className="gap-2 flex items-center">
                <div className="size-5 shrink-0 rounded-full bg-primary/20" />
                <div className="gap-2 flex flex-1 items-center">
                  <div className="h-2 w-16 rounded bg-muted-foreground/30" />
                  <div className="h-1.5 w-24 rounded bg-muted-foreground/20" />
                </div>
              </div>
              <div className="gap-2 pl-7 flex items-center">
                <div className="h-1.5 w-32 rounded bg-muted-foreground/20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Chat Width */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
            Chat Width
          </h3>
          <p className="text-xs mt-0.5 px-1 text-muted-foreground">
            How wide messages and the composer can grow on large screens.
            Smaller screens always use the full width.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Chat width"
          className="sm:grid-cols-3 gap-4 grid grid-cols-1"
        >
          {CONTENT_WIDTH_OPTIONS.map((option) => {
            const selected = contentWidth === option.value;
            const Icon = option.icon;
            return (
              <div
                key={option.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => handleContentWidthChange(option.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleContentWidthChange(option.value);
                  }
                }}
                className={cn(
                  'p-4 gap-3 relative flex cursor-pointer flex-col justify-between rounded-xl border text-left transition-all select-none',
                  selected
                    ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                    : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
                )}
              >
                <div className="gap-2 flex items-start justify-between">
                  <div className="gap-2.5 flex items-center">
                    <div
                      className={cn(
                        'size-8 flex shrink-0 items-center justify-center rounded-xl',
                        selected
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="gap-2 flex items-center">
                        <span className="text-sm font-semibold text-foreground">
                          {option.label}
                        </span>
                        {option.value === 'full' ? (
                          <Badge
                            variant="neutral"
                            className="py-0 px-1.5 text-[10px]"
                          >
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  {selected && (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  )}
                </div>

                {/* Miniature: a message column + composer at this width */}
                <div className="p-2.5 gap-1.5 flex flex-col items-center rounded-xl border border-border/60 bg-surface/60">
                  <div className={cn('space-y-1.5', option.previewWidth)}>
                    <div className="gap-1.5 flex items-center">
                      <div className="size-4 shrink-0 rounded-full bg-primary/20" />
                      <div className="h-1.5 rounded flex-1 bg-muted-foreground/25" />
                    </div>
                    <div className="h-1.5 ml-5.5 rounded bg-muted-foreground/20" />
                    <div className="h-3 rounded-md border border-border bg-surface" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Open Chat Position */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
            Open Chat Position
          </h3>
          <p className="text-xs mt-0.5 px-1 text-muted-foreground">
            Choose where the timeline scrolls when you open a channel or
            conversation.
          </p>
        </div>

        <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
          {/* Last Read Option */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenPositionChange('last-read')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleOpenPositionChange('last-read');
              }
            }}
            className={cn(
              'p-4 gap-3 flex cursor-pointer items-start justify-between rounded-xl border text-left transition-all select-none',
              chat.openPosition === 'last-read'
                ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
            )}
          >
            <div className="gap-3 flex items-start">
              <div
                className={cn(
                  'size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl',
                  chat.openPosition === 'last-read'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-muted text-muted-foreground',
                )}
              >
                <BookmarkCheck className="size-4" />
              </div>
              <div>
                <div className="gap-2 flex items-center">
                  <span className="text-sm font-semibold text-foreground">
                    Last Read Message
                  </span>
                  <Badge variant="neutral" className="py-0 px-1.5 text-[10px]">
                    Recommended
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Resumes right where you left off at the red new messages line.
                </p>
              </div>
            </div>
            {chat.openPosition === 'last-read' && (
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
            )}
          </div>

          {/* Newest Message Option */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenPositionChange('newest')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleOpenPositionChange('newest');
              }
            }}
            className={cn(
              'p-4 gap-3 flex cursor-pointer items-start justify-between rounded-xl border text-left transition-all select-none',
              chat.openPosition === 'newest'
                ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
            )}
          >
            <div className="gap-3 flex items-start">
              <div
                className={cn(
                  'size-8 mt-0.5 flex shrink-0 items-center justify-center rounded-xl',
                  chat.openPosition === 'newest'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-muted text-muted-foreground',
                )}
              >
                <ArrowDown className="size-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Newest Message
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Always lands at the very bottom of the conversation.
                </p>
              </div>
            </div>
            {chat.openPosition === 'newest' && (
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
            )}
          </div>
        </div>
      </div>

      {/* 4. Privacy & Read Indicators */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
          Privacy & Indicators
        </h3>
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {/* Read Receipts */}
          <SettingsRow
            icon={<Eye />}
            title={<>Send and view read receipts</>}
            description={
              <>
                Let other participants know when you have viewed their messages
                in channels and direct messages.
              </>
            }
          >
            <Switch
              checked={chat.readReceipts}
              onCheckedChange={handleReadReceiptsToggle}
            />
          </SettingsRow>

          {/* Typing Notifications */}
          <SettingsRow
            icon={<Activity />}
            title={<>Send typing indicators</>}
            description={
              <>
                Broadcast when you are actively composing a reply in a channel
                or thread.
              </>
            }
          >
            <Switch
              checked={chat.sendTypingNotice ?? true}
              onCheckedChange={handleSendTypingNoticeToggle}
            />
          </SettingsRow>

          {/* Show others' typing indicators */}
          <SettingsRow
            icon={<Activity />}
            title={<>Show typing indicators</>}
            description={
              <>See when someone else is actively composing a reply.</>
            }
          >
            <Switch
              checked={chat.showTypingIndicators ?? true}
              onCheckedChange={handleShowTypingIndicatorsToggle}
            />
          </SettingsRow>
        </div>
      </div>

      {/* 5. Composer & Sending Controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
          Composer & Smart Feedback
        </h3>
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {/* Enter to Send */}
          <SettingsRow
            icon={<CornerDownLeft />}
            title={<>Press Enter to send</>}
            description={
              <>
                Press Enter to send your message, and Shift+Enter to start a new
                line. When disabled, Enter adds a new line.
              </>
            }
          >
            <Switch
              checked={chat.enterToSend ?? true}
              onCheckedChange={handleEnterToSendToggle}
            />
          </SettingsRow>

          {/* Mention Warnings */}
          <SettingsRow
            icon={<AtSign />}
            title={<>Mention reachability warnings</>}
            description={
              <>
                After you mention a teammate, agent, or app who isn't in the
                conversation, show a private "Only visible to you" notice with a
                one-click way to add them.
              </>
            }
          >
            <Switch
              checked={chat.mentionWarningsEnabled ?? true}
              onCheckedChange={handleMentionWarningsToggle}
            />
          </SettingsRow>

          {/* Link Previews */}
          <SettingsRow
            icon={<Link2 />}
            title={<>Show link previews by default</>}
            description={
              <>
                Display rich preview cards with titles, descriptions, and media
                for links shared in messages.
              </>
            }
          >
            <Switch
              checked={chat.linkPreviewsEnabled ?? true}
              onCheckedChange={handleLinkPreviewsToggle}
            />
          </SettingsRow>
        </div>
      </div>

      {/* 6. Direct Message Permissions */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
            Direct Message Privacy
          </h3>
          <p className="text-xs mt-0.5 px-1 text-muted-foreground">
            Choose who can initiate direct conversations with you in this
            workspace.
          </p>
        </div>

        <div className="sm:grid-cols-3 gap-3 grid grid-cols-1">
          {(
            [
              {
                id: 'everyone',
                label: 'Everyone',
                description: 'Anyone in the workspace can DM you.',
              },
              {
                id: 'members',
                label: 'Members Only',
                description: 'Workspace members and admins only.',
              },
              {
                id: 'admins',
                label: 'Admins Only',
                description: 'Only workspace admins can initiate DMs.',
              },
            ] as const
          ).map((opt) => {
            const isSelected =
              (chat.allowDirectMessagesFrom ?? 'everyone') === opt.id;
            return (
              <div
                key={opt.id}
                role="button"
                tabIndex={0}
                onClick={() => handleAllowDirectMessagesFromChange(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleAllowDirectMessagesFromChange(opt.id);
                  }
                }}
                className={cn(
                  'p-3.5 gap-2 flex cursor-pointer flex-col justify-between rounded-xl border text-left transition-all select-none',
                  isSelected
                    ? 'border-primary/80 bg-primary/5 shadow-xs ring-2 ring-primary/20'
                    : 'hover:border-border-focus border-border bg-surface shadow-xs hover:bg-accent/30',
                )}
              >
                <div className="gap-2 flex items-start justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {opt.label}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                  )}
                </div>
                <p className="leading-relaxed text-[11px] text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
