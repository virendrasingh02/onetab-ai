import {
  useChatPreferences,
  useUserPreferences,
} from '@org/common';
import type { MessageDensity, OpenChatPosition } from '@org/types';
import { Badge, Button, Switch } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlignJustify,
  ArrowDown,
  BookmarkCheck,
  CheckCircle2,
  Eye,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import React from 'react';

export function ChatSettingsPanel() {
  const { chat, updateChatPreferences } = useChatPreferences();
  const { resetPreferences } = useUserPreferences();

  const handleDensityChange = (density: MessageDensity) => {
    updateChatPreferences({ messageDensity: density });
  };

  const handleOpenPositionChange = (position: OpenChatPosition) => {
    updateChatPreferences({ openPosition: position });
  };

  const handleReadReceiptsToggle = (enabled: boolean) => {
    updateChatPreferences({ readReceipts: enabled });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <span>Chat & Messaging</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Customize message density, timeline scroll behavior, and read receipts across conversations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            className="h-8 text-xs gap-1.5 shrink-0"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset Defaults</span>
          </Button>
        </div>
      </div>

      {/* 1. Message Density */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Message Density
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 px-1">
            Choose how compactly messages and avatars are spaced in the timeline.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              'relative p-4 rounded-2xl border transition-all cursor-pointer select-none text-left flex flex-col justify-between gap-3',
              chat.messageDensity === 'comfy'
                ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'size-8 rounded-xl flex items-center justify-center shrink-0',
                    chat.messageDensity === 'comfy'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-muted text-muted-foreground',
                  )}
                >
                  <AlignJustify className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Comfy
                    </span>
                    <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                      Default
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Generous spacing with full 40px avatars and relaxed padding.
                  </p>
                </div>
              </div>
              {chat.messageDensity === 'comfy' && (
                <CheckCircle2 className="size-4 text-primary shrink-0" />
              )}
            </div>

            {/* Visual Comfy Preview Miniature */}
            <div className="rounded-xl border border-border/60 bg-surface/60 p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="size-6 rounded-full bg-primary/20 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-2 w-20 rounded bg-muted-foreground/30" />
                  <div className="h-1.5 w-36 rounded bg-muted-foreground/20" />
                </div>
              </div>
              <div className="flex items-center gap-2.5 pl-8">
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
              'relative p-4 rounded-2xl border transition-all cursor-pointer select-none text-left flex flex-col justify-between gap-3',
              chat.messageDensity === 'compact'
                ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'size-8 rounded-xl flex items-center justify-center shrink-0',
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
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tight 32px avatars and minimal padding to see more messages.
                  </p>
                </div>
              </div>
              {chat.messageDensity === 'compact' && (
                <CheckCircle2 className="size-4 text-primary shrink-0" />
              )}
            </div>

            {/* Visual Compact Preview Miniature */}
            <div className="rounded-xl border border-border/60 bg-surface/60 p-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-primary/20 shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-2 w-16 rounded bg-muted-foreground/30" />
                  <div className="h-1.5 w-24 rounded bg-muted-foreground/20" />
                </div>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <div className="h-1.5 w-32 rounded bg-muted-foreground/20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Open Chat Position */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Open Chat Position
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 px-1">
            Choose where the timeline scrolls when you open a channel or conversation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              'p-4 rounded-2xl border transition-all cursor-pointer select-none text-left flex items-start justify-between gap-3',
              chat.openPosition === 'last-read'
                ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                  chat.openPosition === 'last-read'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-muted text-muted-foreground',
                )}
              >
                <BookmarkCheck className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Last Read Message
                  </span>
                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                    Recommended
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Resumes right where you left off at the red new messages line.
                </p>
              </div>
            </div>
            {chat.openPosition === 'last-read' && (
              <CheckCircle2 className="size-4 text-primary shrink-0" />
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
              'p-4 rounded-2xl border transition-all cursor-pointer select-none text-left flex items-start justify-between gap-3',
              chat.openPosition === 'newest'
                ? 'border-primary/80 bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                : 'border-border bg-surface-inset hover:border-border-focus hover:bg-accent/30',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  Always lands at the very bottom of the conversation.
                </p>
              </div>
            </div>
            {chat.openPosition === 'newest' && (
              <CheckCircle2 className="size-4 text-primary shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* 3. Read Receipts */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
          Privacy & Read Indicators
        </h3>
        <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Eye className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-foreground">
                  Send and view read receipts
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Let other participants know when you have viewed their messages in channels and direct messages.
                </p>
              </div>
            </div>
            <Switch
              checked={chat.readReceipts}
              onCheckedChange={handleReadReceiptsToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
