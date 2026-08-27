import type { CurrentUser, WorkspaceSummary } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
  UserAvatar,
  useFocusStore,
  useRightPanelStore,
} from '@org/ui';
import type { ActivityIndicator } from '@org/notifications';
import { useLogout } from '@org/auth';
import { cn } from '@org/utils';
import { ProfileEditModal } from '@org/web-profile';
import {
  DesktopTitleBarInset,
  DesktopUpdateIndicator,
  DesktopWindowControls,
  DRAG,
  isDesktop,
  NO_DRAG,
  openDesktopApp,
  openExternal,
  useClaimsWindowChrome,
  useDesktop,
} from '@org/web-desktop';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Keyboard,
  Laptop,
  Palette,
  PanelLeft,
  Search,
  Settings,
  Smile,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceMenu } from './workspace-switcher.js';

export interface AppHeaderProps {
  user: CurrentUser;
  workspaceSlug: string;
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
  const logout = useLogout();
  const navigate = useNavigate();
  const { appInfo, toggleMaximize } = useDesktop();

  // This row draws the window's own drag strip and minimise/maximise/close
  // controls (see the section markup below) instead of leaving that to the
  // fallback `DesktopTitleBar`, so it tells that fallback to stand down for
  // as long as it's on screen — otherwise a workspace would show both.
  useClaimsWindowChrome();

  const isApple = appInfo
    ? appInfo.platform === 'darwin'
    : /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const searchShortcut = isApple ? '⌘K' : 'Ctrl K';

  const openStatusModal = useFocusStore((s) => s.openStatusModal);
  const _openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const isRightPanelOpen = useRightPanelStore((s) => s.open);
  const rightPanelView = useRightPanelStore((s) => s.view);
  const dismissRightPanel = useRightPanelStore((s) => s.dismiss);
  const setRightPanelView = useRightPanelStore((s) => s.setView);
  const [isSelfAway, setIsSelfAway] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const isAssistantActive = isRightPanelOpen && rightPanelView === 'assistant';

  const handleToggleAssistant = () => {
    if (isAssistantActive) {
      dismissRightPanel();
    } else {
      setRightPanelView('assistant');
    }
  };

  const handleShowShortcuts = () => {
    toast.info('Shortcuts: ⌘K Search, ⌘Shift J Downloads, Esc Close dialogs');
  };

  const handle = `@${user.email.split('@')[0]}`;

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
            <div style={NO_DRAG} className="max-w-52 sm:max-w-64 min-w-0 flex items-center">
              <WorkspaceMenu
                workspaces={workspaces}
                current={currentWorkspace}
                userEmail={user.email}
                workspaceActivity={workspaceActivity}
              />
            </div>
          ) : null}

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
                  'size-7 p-0 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground',
                  'opacity-0 transition-opacity duration-(--duration-fast) ease-standard',
                  'group-focus-within/left:opacity-100 group-hover/left:opacity-100 focus-visible:opacity-100',
                )}
              >
                <PanelLeft className="size-4" />
              </Button>
            </Hint>
          ) : null}
        </div>

        {/* Center Section: Both < > Arrows and Search Bar Centered Together */}
        <div style={NO_DRAG} className="gap-1.5 sm:gap-2 flex shrink-0 items-center justify-center">
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
              'text-xs bg-white shadow-2xs border border-border/80 text-muted-foreground dark:bg-card',
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
            <kbd className="px-1.5 py-0.5 rounded ml-auto shrink-0 border border-border/60 bg-muted/60 font-mono text-[10px] text-subtle">
              {searchShortcut}
            </kbd>
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
              className="sm:hidden size-7 p-0 flex text-muted-foreground hover:text-foreground"
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
              onClick={() => void openExternal('https://github.com/onetab-ai')}
            >
              <HelpCircle className="size-4" />
            </Button>
          </Hint>

          {/* Ask AI Assistant Button placed near the Profile Icon */}
          <Hint
            label={isAssistantActive ? 'Close AI Assistant' : 'Ask AI Assistant'}
          >
            <Button
              variant={isAssistantActive ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToggleAssistant}
              aria-pressed={isAssistantActive}
              aria-label={isAssistantActive ? 'Close AI assistant' : 'Ask AI'}
              style={NO_DRAG}
              className="gap-1 px-2 text-xs font-medium sm:gap-1.5 sm:px-3 h-7 cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              <span className="sm:inline hidden">Ask AI</span>
            </Button>
          </Hint>

          {/* Update nudge — no-op outside the desktop shell */}
          <div style={NO_DRAG}>
            <DesktopUpdateIndicator />
          </div>

          {/* Caller-supplied actions anchor here, right against the profile menu */}
          {actions ? <div style={NO_DRAG}>{actions}</div> : null}

          {/* Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                style={NO_DRAG}
                className="ml-1 cursor-pointer rounded-full transition-transform outline-none hover:scale-105 focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <UserAvatar
                  name={user.displayName ?? user.name}
                  src={user.avatarUrl}
                  seed={user.id}
                  size="sm"
                  presence={isSelfAway ? 'away' : 'online'}
                  statusEmoji={user.statusEmoji}
                  statusText={user.statusText}
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-68 sm:w-72 p-2 rounded-2xl border border-border bg-popover text-foreground shadow-2xl space-y-1 select-none animate-in fade-in zoom-in-95 duration-100"
            >
              {/* Header Identity Row: Avatar, name, handle, active status */}
              <div
                onClick={() => {
                  navigate(`/w/${workspaceSlug}/profile`);
                }}
                className="gap-3 p-2.5 flex items-center rounded-xl cursor-pointer hover:bg-accent/60 transition-colors"
              >
                <UserAvatar
                  name={user.displayName ?? user.name}
                  src={user.avatarUrl}
                  seed={user.id}
                  shape="rounded"
                  size="md"
                  presence={isSelfAway ? 'away' : 'online'}
                  className="size-10 rounded-xl ring-1 ring-border/50 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold tracking-tight text-foreground truncate">
                    {user.displayName ?? user.name}
                  </h4>
                  <div className="gap-1.5 mt-0.5 flex items-center text-xs text-muted-foreground font-mono">
                    <span>{handle}</span>
                    <span>•</span>
                    <span className={cn('font-sans font-medium', isSelfAway ? 'text-warning' : 'text-success')}>
                      {isSelfAway ? 'Away' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Update your status button box */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={openStatusModal}
                  className="gap-2.5 px-3 py-2 w-full flex items-center rounded-xl border border-border/80 bg-surface-inset/60 text-muted-foreground hover:text-foreground hover:bg-surface-inset hover:border-border transition-colors text-left"
                >
                  <Smile className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">
                    {user.statusText ? (
                      <span className="text-foreground">
                        {user.statusEmoji ? `${user.statusEmoji} ` : ''}
                        {user.statusText}
                      </span>
                    ) : (
                      'Update your status'
                    )}
                  </span>
                </button>
              </div>

              {/* Set yourself as away */}
              <DropdownMenuItem
                onClick={() => {
                  setIsSelfAway((prev) => !prev);
                  toast.success(
                    !isSelfAway ? 'Status set to away' : 'Status set to active',
                  );
                }}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60"
              >
                <span>
                  Set yourself as{' '}
                  <strong>{isSelfAway ? 'active' : 'away'}</strong>
                </span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-border/60" />

              {/* View profile */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/profile`)}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5"
              >
                <User className="size-3.5 text-muted-foreground" />
                <span>View profile</span>
              </DropdownMenuItem>

              {/* Edit profile */}
              <DropdownMenuItem
                onClick={() => setEditProfileOpen(true)}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5"
              >
                <UserCheck className="size-3.5 text-primary" />
                <span>Edit profile</span>
              </DropdownMenuItem>

              {/* Preferences */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/settings?tab=preferences`)}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5"
              >
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Preferences</span>
              </DropdownMenuItem>

              {/* Theme Customization */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/settings?tab=theme`)}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5"
              >
                <Palette className="size-3.5 text-primary" />
                <span>Theme customization</span>
              </DropdownMenuItem>

              {/* Account settings */}
              <DropdownMenuItem
                onClick={() => navigate(`/w/${workspaceSlug}/settings?tab=profile`)}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5"
              >
                <Settings className="size-3.5 text-muted-foreground" />
                <span>Account settings</span>
              </DropdownMenuItem>

              {/* Keyboard shortcuts */}
              <DropdownMenuItem
                onClick={handleShowShortcuts}
                className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 gap-2.5 justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Keyboard className="size-3.5 text-muted-foreground" />
                  <span>Keyboard shortcuts</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">⌘/</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-border/60" />

              {/* Open Desktop App */}
              {!isDesktop && (
                <DropdownMenuItem
                  onClick={() => void openDesktopApp({ route: 'open' })}
                  className="px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent/60 justify-between text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Laptop className="size-3.5" />
                    <span>Open Desktop App</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">App</span>
                </DropdownMenuItem>
              )}

              {/* Sign out */}
              <DropdownMenuItem
                onClick={() => logout.mutate()}
                className="px-2.5 py-2 text-xs font-medium text-destructive cursor-pointer rounded-lg hover:bg-destructive/10"
              >
                <span>
                  Sign out of {currentWorkspace?.name ?? 'relibit labs'}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Windows/Linux window controls */}
          <DesktopWindowControls />
        </div>
      </header>

      {/* Profile Edit Dialog accessible directly from header */}
      <ProfileEditModal
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        user={user}
      />
    </>
  );
}
