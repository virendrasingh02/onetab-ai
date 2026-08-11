import { Hint, LoadingState } from '@org/ui';
import { cn } from '@org/utils';
import { Hash, Lock, PanelRight, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ChatLayoutProps {
  header: ReactNode;
  children: ReactNode;
  sidePanel?: ReactNode;
  sidePanelTitle?: string;
  onCloseSidePanel?: () => void;
  banner?: ReactNode;
  className?: string;
}

export function ChatLayout({
  header,
  children,
  sidePanel,
  sidePanelTitle,
  onCloseSidePanel,
  banner,
  className,
}: ChatLayoutProps) {
  return (
    <div className={cn('min-h-0 flex h-full flex-col bg-[#313338] text-[#dbdee1]', className)}>
      {banner}
      {header}

      <div className="min-h-0 flex flex-1 overflow-hidden relative">
        <div className="relative min-w-0 flex flex-1 flex-col overflow-hidden bg-[#313338]">{children}</div>

        {sidePanel ? (
          <aside
            aria-label={sidePanelTitle ?? 'Details'}
            className="w-80 flex shrink-0 flex-col border-l border-[#1f2023] bg-[#2b2d31] text-[#dbdee1] shadow-md"
          >
            <div className="h-12 flex shrink-0 items-center justify-between border-b border-[#1f2023] px-3.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white truncate">
                <Hash className="size-4 text-[#949ba4]" />
                <span className="truncate">{sidePanelTitle}</span>
              </h3>
              {onCloseSidePanel ? (
                <button
                  type="button"
                  aria-label="Close panel"
                  onClick={onCloseSidePanel}
                  className="rounded-md p-1 text-[#949ba4] hover:bg-[#35373c] hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">{sidePanel}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  isEncrypted?: boolean;
  memberCount?: number;
  onToggleMembers?: () => void;
  onToggleDetails?: () => void;
  actions?: ReactNode;
}

export function ChatHeader({
  title,
  subtitle,
  isEncrypted = false,
  memberCount,
  onToggleMembers,
  onToggleDetails,
  actions,
}: ChatHeaderProps) {
  return (
    <header className="h-12 flex shrink-0 items-center justify-between border-b border-[#1f2023] bg-[#2b2d31] px-4 shadow-xs">
      <div className="flex min-w-0 items-center gap-2">
        <Hash className="size-5 shrink-0 text-[#80848e]" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
            <span className="truncate">{title}</span>
            {isEncrypted ? (
              <Hint label="End-to-end encrypted">
                <Lock
                  className="size-3.5 shrink-0 text-[#949ba4]"
                  aria-label="End-to-end encrypted"
                />
              </Hint>
            ) : null}
          </h2>
          {subtitle ? (
            <p className="text-xs text-[#80848e] truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[#b5bac1]">
        {actions}

        {onToggleMembers ? (
          <Hint label="Channel Members">
            <button
              type="button"
              onClick={onToggleMembers}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-[#35373c] hover:text-white transition-colors"
            >
              <Users className="size-4" />
              <span>{memberCount ?? ''}</span>
            </button>
          </Hint>
        ) : null}

        {onToggleDetails ? (
          <Hint label="Details">
            <button
              type="button"
              aria-label="Toggle details"
              onClick={onToggleDetails}
              className="rounded-md p-1.5 hover:bg-[#35373c] hover:text-white transition-colors"
            >
              <PanelRight className="size-4" />
            </button>
          </Hint>
        ) : null}
      </div>
    </header>
  );
}

export interface ThreadPanelProps {
  rootSlot: ReactNode;
  repliesSlot: ReactNode;
  composerSlot: ReactNode;
  isLoading?: boolean;
  replyCount: number;
}

export function ThreadPanel({
  rootSlot,
  repliesSlot,
  composerSlot,
  isLoading = false,
  replyCount,
}: ThreadPanelProps) {
  if (isLoading) return <LoadingState label="Loading thread…" />;

  return (
    <div className="min-h-0 flex h-full flex-col bg-[#2b2d31] relative">
      <div className="border-b border-[#1f2023] pb-2 shrink-0">{rootSlot}</div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f2023] bg-[#232428] text-xs font-bold uppercase tracking-wider text-[#949ba4] shrink-0">
        <span>
          {replyCount === 0
            ? 'No replies yet'
            : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle bg-[#313338]">
        {repliesSlot}
      </div>

      <div className="shrink-0 sticky bottom-0 z-20 w-full bg-[#2b2d31]">
        {composerSlot}
      </div>
    </div>
  );
}

export function ChatSearchPlaceholder() {
  return (
    <div className="p-4 text-sm text-[#949ba4]">
      <p className="font-semibold text-white">Search in conversation</p>
      <p className="mt-1 text-xs text-[#80848e]">
        Full-text search across messages in Discord mode. Search results are filtered instantly.
      </p>
    </div>
  );
}
