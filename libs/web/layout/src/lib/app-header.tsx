import type { CurrentUser, WorkspaceSummary } from '@org/types';
import {
  Button,
  Hint,
  KbdShortcut,
  useRightPanelStore,
  useStatusModalStore,
  WorkspaceMenuSkeleton,
} from '@org/ui';
import type { ActivityIndicator } from '@org/notifications';
import { cn } from '@org/utils';
import {
  DesktopTitleBarInset,
  DesktopUpdateIndicator,
  DesktopWindowControls,
  DRAG,
  NO_DRAG,
  openExternal,
  useClaimsWindowChrome,
  useDesktop,
} from '@org/web-desktop';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  PanelLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AccountMenu } from './account-menu.js';
import { WorkspaceMenu } from './workspace-switcher.js';

export interface AppHeaderProps {
  user: CurrentUser;
  workspaceSlug: string;
  /**
   * Kept for callers; the header no longer carries a notification bell —
   * every notification lives in the Inbox, whose sidebar row holds the count.
   */
  workspaceId?: string;
  title: string;
  subtitle?: string;
  workspaces?: WorkspaceSummary[];
  currentWorkspace?: WorkspaceSummary;
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  unreadNotifications?: number;
  /** Unread state per workspace id, for the switcher's dots. */
  workspaceActivity?: Record<string, ActivityIndicator>;
  /**
   * Extra controls anchored to the two identity landmarks in the header
   * rather than left to float in the middle: `leftActions` render just
   * before the workspace switcher, `actions` (the right-side set) just
   * before the profile menu. A caller with something to add picks a side by
   * what it relates to — workspace-level chrome to the left, account-level
   * chrome to the right — instead of inventing a third position.
   */
  leftActions?: React.ReactNode;
  actions?: React.ReactNode;
}

export function AppHeader({
  user,
  workspaceSlug,
  workspaces,
  currentWorkspace,
  onOpenSearch,
  onToggleSidebar,
  sidebarOpen = true,
  unreadNotifications: _unreadNotifications = 0,
  workspaceActivity,
  leftActions,
  actions,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { toggleMaximize } = useDesktop();

  // This row draws the window's own drag strip and minimise/maximise/close
  // controls (see the section markup below) instead of leaving that to the
  // fallback `DesktopTitleBar`, so it tells that fallback to stand down for
  // as long as it's on screen — otherwise a workspace would show both.
  useClaimsWindowChrome();

  const openStatusModal = useStatusModalStore((s) => s.openStatusModal);
  const isRightPanelOpen = useRightPanelStore((s) => s.open);
  const rightPanelView = useRightPanelStore((s) => s.view);
  const dismissRightPanel = useRightPanelStore((s) => s.dismiss);
  const setRightPanelView = useRightPanelStore((s) => s.setView);

  const isAssistantActive = isRightPanelOpen && rightPanelView === 'assistant';

  const handleToggleAssistant = () => {
    if (isAssistantActive) {
      dismissRightPanel();
    } else {
      setRightPanelView('assistant');
    }
  };

  return (
    <>
      <header
        style={DRAG}
        onDoubleClick={toggleMaximize}
        className="h-11 gap-2 px-2.5 sm:gap-3 sm:px-4 flex shrink-0 items-center select-none"
      >
        {/*
          Left Section: macOS traffic-light inset, Workspace Switcher, then
          Sidebar Toggle.
        */}
        <div className="group/left min-w-0 gap-1.5 sm:gap-2 flex flex-1 items-center">
          <DesktopTitleBarInset />

          {leftActions ? <div style={NO_DRAG}>{leftActions}</div> : null}

          {currentWorkspace && workspaces ? (
            <div
              style={NO_DRAG}
              className="max-w-64 sm:max-w-80 min-w-0 flex items-center"
            >
              <WorkspaceMenu
                workspaces={workspaces}
                current={currentWorkspace}
                userEmail={user.email}
                workspaceActivity={workspaceActivity}
              />
            </div>
          ) : (
            <div
              style={NO_DRAG}
              className="max-w-64 sm:max-w-80 min-w-0 flex items-center"
            >
              <WorkspaceMenuSkeleton />
            </div>
          )}

          {onToggleSidebar ? (
            <Hint label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleSidebar}
                aria-label="Toggle sidebar"
                aria-expanded={sidebarOpen}
                style={NO_DRAG}
                className={cn(
                  'size-7 p-0 touch-target shrink-0 cursor-pointer text-muted-foreground hover:text-foreground',
                  // Always visible on touch/phone — there is no hover to reveal
                  // it, and it is the only route into the navigation drawer.
                  // From `md` up it stays a quiet hover affordance as before.
                  'opacity-100 transition-opacity duration-(--duration-fast) ease-standard',
                  'md:opacity-0 md:group-focus-within/left:opacity-100 md:group-hover/left:opacity-100 focus-visible:opacity-100',
                )}
              >
                <PanelLeft className="size-4" />
              </Button>
            </Hint>
          ) : null}
        </div>

        {/* Center Section: Both < > Arrows and Search Bar Centered Together */}
        <div
          style={NO_DRAG}
          className="gap-1.5 sm:gap-2 flex shrink-0 items-center justify-center"
        >
          <div className="gap-0.5 sm:flex hidden items-center">
            <Hint label="Go back">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </Hint>

            <Hint label="Go forward">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(1)}
                aria-label="Go forward"
                className="size-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </Button>
            </Hint>
          </div>

          <button
            type="button"
            onClick={onOpenSearch}
            className={cn(
              'h-7.5 w-52 sm:w-64 md:w-80 gap-2 px-2.5 sm:flex hidden items-center rounded-lg',
              'text-xs shadow-2xs border border-border/80 bg-card text-muted-foreground',
              'cursor-pointer transition-colors duration-(--duration-fast) ease-standard',
              'hover:border-border-strong hover:bg-accent/40 hover:text-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <Search
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">Search…</span>
            <KbdShortcut
              keys={['mod', 'K']}
              size="xs"
              variant="muted"
              className="ml-auto shrink-0"
            />
          </button>
        </div>

        {/* Right Section: Utilities, Ask AI Button, Update Nudge, Actions and Profile Avatar */}
        <div className="gap-1 sm:gap-1.5 flex flex-1 shrink-0 items-center justify-end">
          {/* Status Pill (Slack style) */}
          {user.statusText || user.statusEmoji ? (
            <Hint
              label={
                user.statusText
                  ? `${user.statusEmoji ?? ''} ${user.statusText}`
                  : 'Update status'
              }
            >
              <button
                type="button"
                onClick={openStatusModal}
                style={NO_DRAG}
                className="h-7 max-w-40 gap-1.5 px-2 md:flex text-xs font-medium hidden cursor-pointer items-center rounded-full border border-primary/30 bg-primary/10 text-foreground transition-colors hover:bg-primary/20"
              >
                <span className="text-sm">{user.statusEmoji || '💬'}</span>
                <span className="truncate">
                  {user.statusText || 'Status set'}
                </span>
              </button>
            </Hint>
          ) : null}

          {/* Mobile Search Button */}
          <Hint label="Search">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenSearch}
              aria-label="Search"
              style={NO_DRAG}
              className="sm:hidden size-7 p-0 flex touch-target text-muted-foreground hover:text-foreground"
            >
              <Search className="size-4" />
            </Button>
          </Hint>

          {/* Help & Resources */}
          <Hint label="Help & Resources">
            <Button
              variant="ghost"
              size="sm"
              style={NO_DRAG}
              className="gap-1 sm:flex hidden cursor-pointer"
              aria-label="Help & Resources"
              onClick={() => void openExternal('https://github.com/onetab-ai')}
            >
              <HelpCircle className="size-4" />
            </Button>
          </Hint>

          {/* Ask AI Assistant Button placed near the Profile Icon */}
          <Hint
            label={
              isAssistantActive ? 'Close AI Assistant' : 'Ask AI Assistant'
            }
          >
            <Button
              variant={isAssistantActive ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToggleAssistant}
              aria-pressed={isAssistantActive}
              aria-label={isAssistantActive ? 'Close AI assistant' : 'Ask AI'}
              style={NO_DRAG}
              className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3 h-7 touch-target cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              <span className="sm:inline hidden">Ask AI</span>
            </Button>
          </Hint>

          {/* Update nudge — desktop app update only */}
          <div style={NO_DRAG} className="gap-1.5 flex items-center">
            <DesktopUpdateIndicator />
          </div>

          {/* Caller-supplied actions anchor here, right against the profile menu */}
          {actions ? <div style={NO_DRAG}>{actions}</div> : null}

          {/* Profile Avatar Dropdown */}
          <AccountMenu
            user={user}
            workspaceSlug={workspaceSlug}
            workspaceName={currentWorkspace?.name}
            className="ml-1"
          />

          {/* Windows/Linux window controls */}
          <DesktopWindowControls
            className="-mr-2.5 ml-1 sm:-mr-4"
            buttonClassName="h-11"
          />
        </div>
      </header>
    </>
  );
}
