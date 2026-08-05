import { Button, Hint, LoadingState } from '@org/ui';
import { cn } from '@org/utils';
import { Lock, PanelRight, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ChatLayoutProps {
  header: ReactNode;
  /** Message list plus composer. */
  children: ReactNode;
  /** Thread panel or member list; hidden when null. */
  sidePanel?: ReactNode;
  sidePanelTitle?: string;
  onCloseSidePanel?: () => void;
  banner?: ReactNode;
  className?: string;
}

/**
 * Two-pane chat surface: conversation plus an optional right panel.
 *
 * The panel is a sibling rather than an overlay so opening a thread narrows
 * the conversation instead of covering it — the pattern that makes it possible
 * to follow both at once.
 */
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
    <div className={cn('min-h-0 flex h-full flex-col', className)}>
      {banner}
      {header}

      <div className="min-h-0 flex flex-1">
        <div className="min-w-0 flex flex-1 flex-col">{children}</div>

        {sidePanel ? (
          <aside
            aria-label={sidePanelTitle ?? 'Details'}
            className="w-80 flex shrink-0 flex-col border-l"
          >
            <div className="h-12 gap-2 px-3 flex shrink-0 items-center border-b">
              <h3 className="text-sm font-semibold flex-1 truncate">
                {sidePanelTitle}
              </h3>
              {onCloseSidePanel ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close panel"
                  onClick={onCloseSidePanel}
                >
                  <X />
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidePanel}</div>
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
    <header className="h-12 gap-2 px-4 flex shrink-0 items-center border-b">
      <div className="min-w-0 flex-1">
        <h2 className="gap-1.5 text-sm font-semibold flex items-center truncate">
          <span className="truncate">{title}</span>
          {isEncrypted ? (
            <Hint label="End-to-end encrypted">
              <Lock
                className="size-3 shrink-0 text-muted-foreground"
                aria-label="End-to-end encrypted"
              />
            </Hint>
          ) : null}
        </h2>
        {subtitle ? (
          <p className="text-xs truncate text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {actions}

      {onToggleMembers ? (
        <Hint label="Members">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMembers}
            leadingIcon={<Users />}
          >
            {memberCount ?? ''}
          </Button>
        </Hint>
      ) : null}

      {onToggleDetails ? (
        <Hint label="Details">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle details"
            onClick={onToggleDetails}
          >
            <PanelRight />
          </Button>
        </Hint>
      ) : null}
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

/** Thread view: the root message, its replies and a scoped composer. */
export function ThreadPanel({
  rootSlot,
  repliesSlot,
  composerSlot,
  isLoading = false,
  replyCount,
}: ThreadPanelProps) {
  if (isLoading) return <LoadingState label="Loading thread…" />;

  return (
    <div className="min-h-0 flex h-full flex-col">
      <div className="pb-2 border-b">{rootSlot}</div>

      <p className="px-4 py-2 text-xs font-medium text-muted-foreground">
        {replyCount === 0
          ? 'No replies yet'
          : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
      </p>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
        {repliesSlot}
      </div>

      {composerSlot}
    </div>
  );
}

/** Placeholder for in-conversation search, which lands with server-side search. */
export function ChatSearchPlaceholder() {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      <p className="font-medium">Search in conversation</p>
      <p className="mt-1 text-xs">
        Full-text search across messages requires server-side search on the
        homeserver, which is not available for encrypted rooms. This arrives
        with the search service in a later phase.
      </p>
    </div>
  );
}
